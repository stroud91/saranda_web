"""Photo uploads.

A file from the internet is never trusted or kept as it arrived:

- only JPEG, PNG and WebP are accepted, judged by decoding the file, not by
  its name or the browser's say-so;
- size and pixel limits are checked before the image is decoded, so a small
  file can't blow up into gigabytes in memory;
- every photo is re-drawn and saved again as a JPEG, which drops anything
  hidden in the original (location and camera data, scripts, a second file
  glued on the end);
- files get a random name of our choosing and live in a folder of their own,
  outside the code, and are only ever served back as ``image/jpeg``.
"""
import io
import os
import re
import secrets
from datetime import timedelta

from flask import current_app
from PIL import Image, ImageOps

from app.models import CarRental, Hotel, Tour, Upload, db
from app.models.db import utcnow

FORMATS = ("JPEG", "PNG", "WEBP")  # the only decoders Pillow is allowed to try
MAX_PIXELS = 50_000_000  # JPEG, which can be decoded at a reduced size
MAX_PIXELS_OTHER = 24_000_000  # PNG and WebP are decoded whole, so the limit is lower
MIN_SIDE = 300
SIZES = (("", 1600), ("_s", 640))
URL_PATTERN = r"/media/u/[a-f0-9]{32}\.jpg"
_URL = re.compile(rf"^/media/u/([a-f0-9]{{32}})\.jpg$")
_NAME = re.compile(r"^[a-f0-9]{32}(_s)?\.jpg$")
MAX_PER_LISTING = 12

# Refuse outright anything far beyond our own limit (Pillow's own bomb guard).
Image.MAX_IMAGE_PIXELS = MAX_PIXELS * 2


class UploadError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def max_bytes():
    return int(current_app.config.get("UPLOAD_MAX_MB", 10)) * 1024 * 1024


def folder():
    path = current_app.config.get("UPLOAD_DIR") or os.path.join(current_app.instance_path, "uploads")
    os.makedirs(path, exist_ok=True)
    return path


def path_for(name):
    """Where a served file lives, or None if the name isn't one of ours."""
    if not _NAME.match(name or ""):
        return None
    return os.path.join(folder(), name)


def _decode(data):
    try:
        with Image.open(io.BytesIO(data), formats=FORMATS) as probe:
            if probe.format not in FORMATS:
                raise UploadError("Use a JPEG, PNG or WebP photo")
            width, height = probe.size
            limit = MAX_PIXELS if probe.format == "JPEG" else MAX_PIXELS_OTHER
            if width * height > limit:
                raise UploadError(f"That photo is too large. Use one under {limit // 1_000_000} megapixels.")
            if min(width, height) < MIN_SIDE:
                raise UploadError(f"That photo is too small. Use one at least {MIN_SIDE} pixels on each side.")
            probe.verify()
        with Image.open(io.BytesIO(data), formats=FORMATS) as image:
            if image.format == "JPEG":
                image.draft("RGB", (SIZES[0][1] * 2, SIZES[0][1] * 2))  # decode big photos at a fraction of their size
            image.load()
            image = ImageOps.exif_transpose(image)  # turn it the right way up before the camera data goes
            if image.mode in ("RGBA", "LA", "P"):
                image = image.convert("RGBA")
                flat = Image.new("RGB", image.size, (255, 255, 255))
                flat.paste(image, mask=image.getchannel("A"))
                return flat
            return image.convert("RGB")
    except UploadError:
        raise
    except Exception:  # Pillow raises many kinds of error for broken or hostile files
        raise UploadError("That file isn't a photo we can read") from None


def save(stream, business_id, user_id):
    """Check, re-encode and store one photo. Returns the Upload row (not yet committed)."""
    limit = max_bytes()
    data = stream.read(limit + 1)
    if not data:
        raise UploadError("Choose a photo to upload")
    if len(data) > limit:
        raise UploadError(f"That photo is over {limit // (1024 * 1024)} MB. Choose a smaller one.", 413)
    image = _decode(data)
    token = secrets.token_hex(16)
    total, stored, written = 0, None, []
    try:
        for suffix, side in SIZES:
            copy = image.copy()
            copy.thumbnail((side, side), Image.LANCZOS)
            final = os.path.join(folder(), f"{token}{suffix}.jpg")
            written += [final + ".part", final]
            copy.save(final + ".part", "JPEG", quality=84, optimize=True, progressive=True)  # no EXIF is passed on
            os.replace(final + ".part", final)
            total += os.path.getsize(final)
            stored = stored or copy.size
    except OSError:  # disk full, folder not writable: leave nothing half-written behind
        for path in written:
            try:
                os.remove(path)
            except FileNotFoundError:
                pass
        current_app.logger.exception("could not store an uploaded photo")
        raise UploadError("The photo couldn't be saved. Please try again.", 500) from None
    upload = Upload(token=token, business_id=business_id, user_id=user_id, width=stored[0], height=stored[1], size=total)
    db.session.add(upload)
    return upload


def check_owned(urls, business_id):
    """Every address must be a photo this business (or, for None, the site itself) uploaded.

    Returns the cleaned list, or None if any entry isn't theirs — so nobody can
    attach another business's photo, or point a listing at an outside address.
    """
    urls = list(dict.fromkeys(urls or []))
    tokens = []
    for url in urls:
        match = _URL.match(url if isinstance(url, str) else "")
        if not match:
            return None
        tokens.append(match.group(1))
    if not tokens:
        return []
    query = Upload.query.filter(Upload.token.in_(tokens))
    query = query.filter(Upload.business_id.is_(None)) if business_id is None else query.filter(Upload.business_id == business_id)
    return urls if query.count() == len(tokens) else None


def _in_use():
    used = set()
    for model in (Hotel, Tour, CarRental):
        for row in model.query.with_entities(model.image_urls, model.pending_changes).all():
            for url in (row[0] or []) + ((row[1] or {}).get("image_urls") or []):
                match = _URL.match(url) if isinstance(url, str) else None
                if match:
                    used.add(match.group(1))
    return used


def remove(upload):
    for suffix, _ in SIZES:
        try:
            os.remove(os.path.join(folder(), f"{upload.token}{suffix}.jpg"))
        except FileNotFoundError:
            pass
    db.session.delete(upload)


def cleanup(older_than_hours=48, business_id=False):
    """Delete photos that were uploaded but aren't on any listing (kept two days, in case a
    form is still open). ``business_id`` limits it to one owner's photos (None: the site's own)."""
    used = _in_use()
    query = Upload.query.filter(Upload.created_at < utcnow() - timedelta(hours=older_than_hours))
    if business_id is not False:
        query = query.filter(Upload.business_id.is_(None) if business_id is None else Upload.business_id == business_id)
    stale = [u for u in query.all() if u.token not in used]
    for upload in stale:
        remove(upload)
    db.session.commit()
    return len(stale)


def forget_business(business_id):
    """A business closed: delete every photo it uploaded. The caller commits."""
    for upload in Upload.query.filter_by(business_id=business_id).all():
        remove(upload)

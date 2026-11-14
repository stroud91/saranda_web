"""Photo uploads: what is accepted, what is stored, who may attach what, and
how photos move through the host's review."""
import io
import os
from datetime import timedelta

import pytest
from PIL import Image

from app.extensions import db
from app.models import Hotel, Upload
from app.models.db import utcnow
from app.services import uploads
from tests.test_partners import ACTIVITY, HOST, RENTAL, STAY, account, approve, make_business

XHR = {"X-Requested-With": "fetch"}


def photo(size=(2400, 1600), fmt="JPEG", mode="RGB", exif=None, tail=b""):
    image = Image.new("RGBA" if mode != "RGB" else "RGB", size, (30, 120, 200) if mode == "RGB" else (30, 120, 200, 128))
    if mode == "P":
        image = image.convert("RGB").convert("P")
    out = io.BytesIO()
    image.save(out, fmt, **({"exif": exif} if exif else {}))
    return out.getvalue() + tail


def send(client, data=None, name="terrace.jpg", scope="business", headers=XHR, **extra):
    body = {"scope": scope, **extra}
    if data is not None:
        body["file"] = (io.BytesIO(data), name)
    return client.post("/api/uploads/", data=body, content_type="multipart/form-data", headers=headers)


def gps_exif():
    exif = Image.Exif()
    exif[0x0112] = 6  # orientation: rotated a quarter turn
    exif[0x010F] = "PhoneMaker"
    gps = exif.get_ifd(0x8825)
    gps[1], gps[2] = "N", (39.0, 52.0, 30.0)
    return exif.tobytes()


@pytest.fixture()
def host(app):
    return account(app, HOST)


@pytest.fixture()
def owner(app):
    client = account(app, "owner@bluebay.example")
    make_business(client)
    return client


def stored(app, url):
    return os.path.join(app.config["UPLOAD_DIR"], url.rsplit("/", 1)[1])


def files(app):
    folder = app.config["UPLOAD_DIR"]
    return os.listdir(folder) if os.path.isdir(folder) else []


def test_a_photo_is_re_encoded_stripped_and_served_as_a_jpeg(app, owner, client):
    r = send(owner, photo(exif=gps_exif(), tail=b"<?php system($_GET['c']); ?><script>alert(1)</script>"))
    assert r.status_code == 201, r.get_json()
    info = r.get_json()
    assert info["url"].startswith("/media/u/") and info["thumb"].endswith("_s.jpg")
    assert (info["width"], info["height"]) == (1067, 1600)  # turned upright, as the camera meant it, and scaled down

    with open(stored(app, info["url"]), "rb") as fh:
        raw = fh.read()
    assert b"php" not in raw and b"script" not in raw and b"PhoneMaker" not in raw  # nothing rides along
    with Image.open(io.BytesIO(raw)) as saved:
        assert saved.format == "JPEG" and max(saved.size) == 1600 and not saved.getexif()
    with Image.open(stored(app, info["thumb"])) as small:
        assert max(small.size) == 640

    # Anyone can view it (listings are public), and it is always sent as an image.
    got = client.get(info["url"])
    assert got.status_code == 200 and got.mimetype == "image/jpeg"
    assert got.headers["X-Content-Type-Options"] == "nosniff" and "immutable" in got.headers["Cache-Control"]
    assert client.get(info["thumb"]).status_code == 200
    token = info["url"].rsplit("/", 1)[1][:-4]
    for name in (f"{token}.png", f"{token.upper()}.jpg", f"{token}.jpg.part", "..%2f..%2f.env", f"{token}_x.jpg", "a.jpg"):
        assert client.get(f"/media/u/{name}").status_code == 404, name


def test_png_and_webp_are_accepted_and_flattened(app, owner):
    for fmt, mode in (("PNG", "RGBA"), ("WEBP", "RGB"), ("PNG", "P")):
        r = send(owner, photo((900, 600), fmt, mode), name=f"x.{fmt.lower()}")
        assert r.status_code == 201, (fmt, mode, r.get_json())
        with Image.open(stored(app, r.get_json()["url"])) as saved:
            assert saved.format == "JPEG" and saved.mode == "RGB"


def test_files_that_are_not_photos_are_refused(app, owner, monkeypatch):
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>'
    gif = photo((600, 600), "GIF", "P")
    for data, name in ((b"just some text", "notes.jpg"), (svg, "logo.svg"), (svg, "logo.jpg"), (gif, "anim.gif"),
                       (b"\xff\xd8\xff\xe0" + b"\x00" * 500, "broken.jpg"), (b"<html><script>x</script></html>", "page.png")):
        r = send(owner, data, name=name)
        assert r.status_code == 400 and r.get_json()["error"], name
    assert send(owner, photo((200, 200))).status_code == 400  # too small to be a listing photo
    assert send(owner).status_code == 400  # no file at all
    assert send(owner, b"").status_code == 400

    monkeypatch.setattr(uploads, "MAX_PIXELS_OTHER", 1_000_000)  # a small file that unpacks into a huge picture
    assert "too large" in send(owner, photo((1500, 1500), "PNG")).get_json()["error"]
    monkeypatch.setattr(uploads, "MAX_PIXELS", 2_000_000)
    assert "too large" in send(owner, photo((2000, 1500))).get_json()["error"]
    monkeypatch.undo()

    # A file type Pillow could read but we don't accept is never handed to its decoder.
    for fmt in ("BMP", "TIFF", "ICO"):
        assert send(owner, photo((600, 600), fmt), name=f"x.{fmt.lower()}").status_code == 400, fmt

    app.config["UPLOAD_MAX_MB"] = 1
    assert send(owner, photo() + os.urandom(1_100_000)).status_code == 413
    assert Upload.query.count() == 0 and not files(app)


def test_who_may_upload(app, owner, host, client):
    data = photo((800, 600))
    assert send(client, data).status_code == 401  # signed out
    guest = account(app, "guest@example.test")
    assert send(guest, data).status_code == 404  # no business
    assert send(guest, data, scope="house").status_code == 404
    assert send(owner, data, scope="house").status_code == 404  # only the host adds the site's own photos
    assert send(host, data, scope="house").status_code == 201
    unverified = account(app, "new@harbour.example", verify=False)
    assert send(unverified, data).status_code == 404

    # Only our own page's script can upload: a plain cross-site form can't add the header,
    # and other content types are turned away before the file is read.
    assert send(owner, data, headers={}).status_code == 400
    assert send(owner, data, headers={**XHR, "Origin": "https://evil.example"}).status_code == 403
    assert owner.post("/api/uploads/", json={"file": "x"}, headers=XHR).status_code == 415
    assert owner.post("/api/uploads/", data=data, content_type="image/jpeg", headers=XHR).status_code == 415
    # ...and multipart is accepted nowhere else.
    assert owner.post("/api/partner/listings/stays", data={"hotel_name": "x"}, content_type="multipart/form-data").status_code == 415

    app.config["PARTNER_MAX_PHOTOS"] = 2
    assert send(owner, data).status_code == 201 and send(owner, data).status_code == 201
    full = send(owner, data)
    assert full.status_code == 409 and "limit" in full.get_json()["error"]


def test_photos_can_only_go_on_your_own_listings(app, owner, host):
    mine = send(owner, photo((800, 600))).get_json()["url"]
    house = send(host, photo((800, 600)), scope="house").get_json()["url"]
    other = account(app, "owner@harbour.example")
    make_business(other, name="Harbour Boats", email="hi@harbour.example")
    theirs = send(other, photo((800, 600))).get_json()["url"]

    for urls in ([theirs], [house], [mine, theirs], ["/media/u/" + "0" * 32 + ".jpg"], ["https://evil.example/x.jpg"],
                 ["/media/u/../../etc/passwd"], [mine + "?x=1"], "not-a-list", [mine] * 2 + [None]):
        r = owner.post("/api/partner/listings/stays", json={**STAY, "image_urls": urls})
        assert r.status_code == 400 and "image_urls" in r.get_json()["fields"], urls
    r = owner.post("/api/partner/listings/stays", json={**STAY, "image_urls": [mine] * 13})
    assert r.status_code == 400

    for kind, body, in (("stays", STAY), ("rentals", RENTAL), ("experiences", ACTIVITY)):
        made = owner.post(f"/api/partner/listings/{kind}", json={**body, "image_urls": [mine, mine]})
        assert made.status_code == 201 and made.get_json()["image_urls"] == [mine], kind  # repeats are dropped
        edit = other.put(f"/api/partner/listings/{kind}/{made.get_json()['id']}", json={"image_urls": [theirs]})
        assert edit.status_code == 404  # not their listing at all


def test_new_photos_wait_for_review_but_removing_and_reordering_is_immediate(app, owner, host, client):
    a, b, c = (send(owner, photo((800, 600))).get_json()["url"] for _ in range(3))
    stay = owner.post("/api/partner/listings/stays", json={**STAY, "image_urls": [a, b]}).get_json()
    assert client.get(f"/api/hotels/{stay['id']}").status_code == 404  # nothing is public before approval
    approve(host, "business", 1)
    approve(host, "stays", stay["id"])
    public = lambda: client.get(f"/api/hotels/{stay['id']}").get_json()["image_urls"]  # noqa: E731
    assert public() == [a, b]

    swapped = owner.put(f"/api/partner/listings/stays/{stay['id']}", json={"image_urls": [b, a]}).get_json()
    assert not swapped["has_pending_changes"] and public() == [b, a]
    fewer = owner.put(f"/api/partner/listings/stays/{stay['id']}", json={"image_urls": [b]}).get_json()
    assert not fewer["has_pending_changes"] and public() == [b]

    added = owner.put(f"/api/partner/listings/stays/{stay['id']}", json={"image_urls": [c, b]}).get_json()
    assert added["has_pending_changes"] and added["image_urls"] == [c, b]  # the owner sees their draft
    assert public() == [b]  # guests still see the approved photos
    queue = host.get("/api/admin/partners").get_json()["queue"]
    assert queue[0]["changes"] == {"image_urls": {"from": [b], "to": [c, b]}}
    approve(host, "stays", stay["id"])
    assert public() == [c, b]


def test_unused_photos_are_cleaned_up_and_a_closed_business_takes_its_photos_with_it(app, owner, host):
    used, pending, unused, fresh = (send(owner, photo((800, 600))).get_json()["url"] for _ in range(4))
    stay = owner.post("/api/partner/listings/stays", json={**STAY, "image_urls": [used]}).get_json()
    approve(host, "business", 1)
    approve(host, "stays", stay["id"])
    owner.put(f"/api/partner/listings/stays/{stay['id']}", json={"image_urls": [used, pending]})
    old = utcnow() - timedelta(hours=72)
    for url in (used, pending, unused):
        Upload.query.filter_by(token=url[9:41]).one().created_at = old
    db.session.commit()

    assert app.test_cli_runner().invoke(args=["users", "cleanup"]).exit_code == 0
    left = {u.url for u in Upload.query.all()}
    assert left == {used, pending, fresh}  # on a listing, waiting for review, or uploaded moments ago
    assert not os.path.exists(stored(app, unused)) and os.path.exists(stored(app, used))

    # Removing a listing drops its photos from it; deleting the account deletes the files.
    assert owner.delete(f"/api/partner/listings/stays/{stay['id']}").status_code == 204
    assert db.session.get(Hotel, stay["id"]).image_urls == []
    assert owner.post("/api/account/delete", json={"password": "olive-grove-ferry-42"}).status_code == 200
    assert Upload.query.count() == 0 and not files(app)

"""Partner businesses: what they may submit, and how it is reviewed.

Rules that keep the public site trustworthy:

- A business and each of its listings stay hidden until the host approves them.
- Owners can only set the fields in the schemas below. Ownership, review state,
  ratings and the like are never taken from a request (no mass assignment).
- On something already approved, ``live`` fields (prices, capacity, on/off) take
  effect at once. Everything guests read as a description or contact detail goes
  into ``pending_changes`` and replaces the live version only after approval, so
  an approved listing can't be quietly rewritten into something else.
"""
import re
import unicodedata

from flask import current_app
from sqlalchemy import and_, or_, select

from app.data import DESTINATION_INDEX
from app.models import Business, CarRental, Hotel, Tour, db
from app.models.business import PALETTES, STYLE_DEFAULT, STYLE_OPTIONS
from app.models.db import utcnow
from app.validation import Field, ValidationError

# Text a host can also give in other languages, per kind of record.
LANGS = ("sq", "en", "fr", "it", "de")
TRANSLATABLE = {
    "stays": ("hotel_name", "description"), "rentals": ("car_model", "description"),
    "experiences": ("tour_name", "description"), "guides": ("headline", "bio"), "business": ("tagline", "description"),
}


def clean_translations(raw, schema, fields):
    """``{"sq": {"description": "…"}}`` checked field by field against the same limits as the
    original text. Unknown languages or fields are refused; empty entries are dropped."""
    if raw in (None, "", {}):
        return None
    if not isinstance(raw, dict):
        raise ValidationError({"translations": "Translations are not valid"})
    out = {}
    for lang, texts in raw.items():
        if lang not in LANGS or not isinstance(texts, dict):
            raise ValidationError({"translations": "Translations are not valid"})
        kept = {}
        for name, value in texts.items():
            if name not in fields:
                raise ValidationError({"translations": "Translations are not valid"})
            if value in (None, ""):
                continue
            base = schema[name]
            try:
                text = Field(base.kind, max_len=base.max_len).parse(name, value)
            except ValueError as exc:
                raise ValidationError({"translations": f"{lang.upper()}: {exc}"}) from None
            if text:
                kept[name] = text
        if kept:
            out[lang] = kept
    return out or None


# Photos are addresses of files uploaded through /api/uploads; nothing else is accepted.
PHOTOS = Field("list", max_items=12, item=Field(max_len=60, pattern=r"/media/u/[a-f0-9]{32}\.jpg"), default=[], label="Photos")

URL_PATTERN = r"https://[^\s\"'<>\\]{3,240}"
EXPERIENCE_CATEGORIES = ["history", "nature", "boat", "food", "active", "culture"]
RENTAL_TYPES = ["Hatchback", "Sedan", "SUV", "Van", "Convertible", "Scooter", "Bicycle", "Boat"]

BUSINESS_SCHEMA = {
    "name": Field(required=True, max_len=120, label="Business name"),
    "tagline": Field(max_len=160),
    "description": Field("text", required=True, max_len=3000),
    "city": Field(required=True, max_len=80, label="Town"),
    "address": Field(max_len=255),
    "email": Field("email", max_len=255, label="Public email"),
    "phone": Field("phone", max_len=40),
    "whatsapp": Field("phone", max_len=40, label="WhatsApp number"),
    "website": Field(max_len=255, pattern=URL_PATTERN, label="Website (must start with https://)"),
    "palette": Field(choices=list(PALETTES), default="sea"),
    "style": Field("dict"),
    "translations": Field("dict"),
}
# Looks are picked from fixed lists, so they apply at once; everything else on a live profile is reviewed.
BUSINESS_LIVE = {"palette", "style"}


def clean_style(raw):
    """A page style made only of known options. Unknown keys are dropped and unknown
    values refused, so nothing a business sends can reach the page as CSS or a URL."""
    if raw is None:
        return dict(STYLE_DEFAULT)
    if not isinstance(raw, dict):
        raise ValidationError({"style": "Style must be a set of options"})
    out = {}
    for key, allowed in STYLE_OPTIONS.items():
        value = raw.get(key, STYLE_DEFAULT[key])
        if not isinstance(value, str) or value not in allowed:
            raise ValidationError({"style": f"Unknown {key} option"})
        out[key] = value
    return out


class Kind:
    """One type of listing a business can manage."""

    def __init__(self, key, model, label, name_field, schema, live, on, off):
        self.key, self.model, self.label, self.name_field = key, model, label, name_field
        self.schema, self.live, self.on, self.off = schema, live, on, off

    def name(self, obj):
        return (obj.pending_changes or {}).get(self.name_field) or getattr(obj, self.name_field)

    def is_on(self, obj):
        return all(getattr(obj, k) == v for k, v in self.on.items())

    def switch_off(self, obj):
        for k, v in self.off.items():
            setattr(obj, k, v)


KINDS = {
    "stays": Kind(
        "stays", Hotel, "Apartment", "hotel_name",
        schema={
            "hotel_name": Field(required=True, max_len=120, label="Name"),
            "address": Field(required=True, max_len=255),
            "city": Field(required=True, max_len=80, label="Town"),
            "description": Field("text", required=True, max_len=3000),
            "amenities": Field("list", max_items=40, item=Field(max_len=60), default=[]),
            "image_urls": PHOTOS,
            "translations": Field("dict"),
            "price_per_night": Field("float", required=True, min=5, max=5000, label="Price per night"),
            "cleaning_fee": Field("float", min=0, max=1000, default=0),
            "bedrooms": Field("int", min=0, max=20, default=1),
            "beds": Field("int", min=1, max=40, default=1),
            "bathrooms": Field("float", min=0, max=20, default=1),
            "max_guests": Field("int", min=1, max=40, default=2, label="Guests"),
            "min_nights": Field("int", min=1, max=60, default=1, label="Minimum nights"),
            "is_active": Field("bool", default=True),
        },
        live={"price_per_night", "cleaning_fee", "bedrooms", "beds", "bathrooms", "max_guests", "min_nights", "is_active"},
        on={"is_active": True}, off={"is_active": False},
    ),
    "rentals": Kind(
        "rentals", CarRental, "Rental", "car_model",
        schema={
            "car_model": Field(required=True, max_len=120, label="Model"),
            "car_type": Field(required=True, choices=RENTAL_TYPES, label="Type"),
            "location": Field(required=True, max_len=120, label="Pick-up place"),
            "description": Field("text", max_len=2000),
            "image_urls": PHOTOS,
            "translations": Field("dict"),
            "price_per_day": Field("float", required=True, min=1, max=5000, label="Price per day"),
            "seats": Field("int", min=1, max=60),
            "transmission": Field(choices=["manual", "automatic"]),
            "availability_status": Field(choices=["available", "unavailable"], default="available"),
        },
        live={"car_type", "price_per_day", "seats", "transmission", "availability_status"},
        on={"availability_status": "available"}, off={"availability_status": "unavailable"},
    ),
    "experiences": Kind(
        "experiences", Tour, "Activity", "tour_name",
        schema={
            "tour_name": Field(required=True, max_len=120, label="Name"),
            "description": Field("text", required=True, max_len=3000),
            "location": Field(required=True, max_len=120, label="Meeting point"),
            "category": Field(required=True, choices=EXPERIENCE_CATEGORIES),
            "image_urls": PHOTOS,
            "translations": Field("dict"),
            "price": Field("float", required=True, min=0, max=5000, label="Price per person"),
            "duration_hours": Field("float", min=0.5, max=240, label="Duration"),
            "destination_slug": Field("slug", label="Nearest place"),
            "is_available": Field("bool", default=True),
        },
        live={"category", "price", "duration_hours", "destination_slug", "is_available"},
        on={"is_available": True}, off={"is_available": False},
    ),
}


def enabled():
    cfg = current_app.config
    return bool(cfg.get("PARTNERS_ENABLED", True) and cfg.get("ACCOUNTS_ENABLED", True))


# ---- what guests may see -----------------------------------------------------
def public_filter(model):
    """Approved, and either the site's own or from an approved business."""
    reviewed = or_(model.review_status == "approved", model.review_status.is_(None))
    if not enabled():  # portal switched off: only the site's own listings
        return and_(reviewed, model.business_id.is_(None))
    approved = select(Business.id).where(Business.status == "approved")
    return and_(reviewed, or_(model.business_id.is_(None), model.business_id.in_(approved)))


def public_listings(business):
    """A business's listings that guests can see right now, by kind."""
    out = {}
    for key, kind in KINDS.items():
        rows = kind.model.query.filter(kind.model.business_id == business.id, public_filter(kind.model)).all()
        out[key] = [r.to_dict() for r in rows if kind.is_on(r)]
    return out


# ---- owners ------------------------------------------------------------------
def slugify(name):
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60].strip("-") or "business"
    candidate, n = slug, 1
    while Business.query.filter_by(slug=candidate).first():
        n += 1
        candidate = f"{slug}-{n}"
    return candidate


def check_extra(kind, data, business_id):
    """Checks a schema can't express. ``business_id`` is whose listing this is (None: the site's own)."""
    if "image_urls" in data:
        from app.services import uploads  # local import: uploads reads the listing models

        owned = uploads.check_owned(data["image_urls"], business_id)
        if owned is None:
            raise ValidationError({"image_urls": "Use photos you uploaded here"})
        data["image_urls"] = owned
    if "translations" in data:
        data["translations"] = clean_translations(data["translations"], kind.schema, TRANSLATABLE[kind.key])
    if kind.key == "experiences" and data.get("destination_slug") and data["destination_slug"] not in DESTINATION_INDEX:
        raise ValidationError({"destination_slug": "Pick a place from the list"})
    if kind.key == "stays" and "amenities" in data:
        data["amenities"] = [a for a in dict.fromkeys(data["amenities"] or []) if a]


def _same(a, b):
    return (a or None) == (b or None)


def submit(obj, data, live, status_attr="review_status"):
    """Apply an owner's edit. Returns True if something now waits for review."""
    status = getattr(obj, status_attr) or "approved"
    if status in ("approved", "suspended"):
        pending = dict(obj.pending_changes or {})
        for key, value in data.items():
            if key in live:
                setattr(obj, key, value)
            elif key == "image_urls" and set(value or []) <= set(getattr(obj, key) or []):
                # Removing or re-ordering photos that were already approved needs no second look.
                setattr(obj, key, value)
                pending.pop(key, None)
            elif _same(getattr(obj, key), value):
                pending.pop(key, None)
            else:
                pending[key] = value
        obj.pending_changes = pending or None
        if pending:
            obj.review_note = None
        return bool(pending)
    for key, value in data.items():
        setattr(obj, key, value)
    setattr(obj, status_attr, "pending")
    obj.review_note = None
    return True


def owner_view(kind, obj):
    """A listing as its owner edits it: the live version with unreviewed changes on top."""
    out = obj.to_dict()
    out.update({k: getattr(obj, k) for k in kind.on})
    out.update(obj.pending_changes or {})
    out.update({"kind": kind.key, "review_status": obj.review_status or "approved", "review_note": obj.review_note,
                "has_pending_changes": bool(obj.pending_changes), "on": kind.is_on(obj)})
    return out


def owned(kind, business):
    return (kind.model.query.filter(kind.model.business_id == business.id, kind.model.review_status != "removed")
            .order_by(kind.model.id).all())


def listing_count(business):
    return sum(len(owned(kind, business)) for kind in KINDS.values())


def close(business):
    """The owner left: take everything down and forget their contact details."""
    from app.services import calendars, uploads

    for kind in KINDS.values():
        for obj in kind.model.query.filter_by(business_id=business.id).all():
            kind.switch_off(obj)
            obj.pending_changes, obj.image_urls = None, []
            if kind.key == "stays":
                calendars.forget_stay(obj.id)
    uploads.forget_business(business.id)
    business.status, business.owner_id, business.pending_changes = "closed", None, None
    business.email = business.phone = business.whatsapp = business.website = business.address = None


# ---- the host's review -------------------------------------------------------
def changes(obj):
    """Unreviewed edits as {field: {from, to}} for the host to compare."""
    return {k: {"from": getattr(obj, k), "to": v} for k, v in (obj.pending_changes or {}).items()}


def approve(obj, status_attr="review_status"):
    for key, value in (obj.pending_changes or {}).items():
        setattr(obj, key, value)
    obj.pending_changes, obj.review_note = None, None
    if getattr(obj, status_attr) in (None, "pending", "rejected"):
        setattr(obj, status_attr, "approved")
    if status_attr == "status":
        obj.reviewed_at = utcnow()


def reject(obj, note, status_attr="review_status"):
    """First submissions are turned down; edits to something live are discarded and the live version stays."""
    if getattr(obj, status_attr) in ("pending", "rejected"):
        setattr(obj, status_attr, "rejected")
    obj.pending_changes = None
    obj.review_note = note or None
    if status_attr == "status":
        obj.reviewed_at = utcnow()


def review_queue():
    """Everything waiting for the host, oldest business first."""
    queue = []
    for b in Business.query.filter(or_(Business.status == "pending", Business.pending_changes.isnot(None))).order_by(Business.id):
        if b.status == "pending" or b.pending_changes:
            queue.append({"type": "business", "id": b.id, "name": b.name, "business": b.brief(), "first_review": b.status == "pending",
                          "details": b.to_owner_dict() if b.status == "pending" else None, "changes": changes(b)})
    for kind in KINDS.values():
        rows = (kind.model.query.filter(kind.model.business_id.isnot(None),
                                        or_(kind.model.review_status == "pending", kind.model.pending_changes.isnot(None)))
                .order_by(kind.model.id).all())
        for obj in rows:
            if obj.review_status == "removed" or not obj.business or obj.business.status == "closed":
                continue
            if obj.review_status == "pending" or obj.pending_changes:
                first = obj.review_status == "pending"
                queue.append({"type": kind.key, "id": obj.id, "name": kind.name(obj), "label": kind.label,
                              "business": obj.business.brief(), "business_status": obj.business.status, "first_review": first,
                              "details": owner_view(kind, obj) if first else None, "changes": changes(obj)})
    return queue

"""Host desk: add, edit and remove the site's own apartments, rentals,
activities and guides. Listings that belong to a partner business are not
reachable from here (they have their own dashboard and the review queue).

The same field lists as the business dashboard are used, plus a few fields
only the host sets. Changes are live at once: the host is the reviewer.
"""
from datetime import datetime, time

from flask import Blueprint, jsonify

from app.auth import require_admin
from app.extensions import limiter
from app.models import Guide, GuideBooking, Tour, db
from app.services import calendars, partners
from app.validation import Field, ValidationError, json_body, partial_body

from .admin_routes import GUIDE_SCHEMA

admin_listing_routes = Blueprint("admin_listings", __name__)

GUIDE_PALETTES = GUIDE_SCHEMA["palette"].choices
# Fields only the host sets, on top of what a business can fill in.
EXTRA = {
    "stays": {"tag": Field(max_len=40, label="Badge"),
              "airbnb_rating": Field("float", min=0, max=5, label="Airbnb rating")},
    "rentals": {"rental_company": Field(max_len=120, label="Company")},
    "experiences": {"start_time": Field("hhmm", label="Start time")},
}
GUIDE_FIELDS = {**GUIDE_SCHEMA, "slug": Field("slug", label="Web address name"), "translations": Field("dict")}


def _guide_text(data):
    if "translations" in data:
        data["translations"] = partners.clean_translations(data["translations"], GUIDE_SCHEMA, partners.TRANSLATABLE["guides"])


def _schema(kind_key):
    if kind_key == "guides":
        return GUIDE_FIELDS
    kind = partners.KINDS.get(kind_key)
    return {**kind.schema, **EXTRA[kind_key]} if kind else None


def _house(kind):
    return (kind.model.query.filter(kind.model.business_id.is_(None), kind.model.review_status != "removed")
            .order_by(kind.model.id))


def _find(kind_key, listing_id):
    if kind_key == "guides":
        return db.session.get(Guide, listing_id)
    kind = partners.KINDS.get(kind_key)
    return _house(kind).filter(kind.model.id == listing_id).first() if kind else None


def _view(kind_key, obj):
    out = obj.to_dict()
    if kind_key == "guides":
        out.update({"kind": "guides", "is_active": obj.is_active is not False, "on": obj.is_active is not False,
                    "contact_email": obj.contact_email, "whatsapp": obj.whatsapp})
        return out
    kind = partners.KINDS[kind_key]
    out.update({k: getattr(obj, k) for k in kind.on})
    out.update({"kind": kind_key, "on": kind.is_on(obj)})
    return out


def _guide_slug(name):
    base = partners.slugify(name)  # unique among businesses; make it unique among guides too
    slug, n = base, 1
    while Guide.query.filter_by(slug=slug).first():
        n += 1
        slug = f"{base}-{n}"
    return slug


def _start(data, obj=None):
    """Turn the form's start time into the stored start date."""
    if "start_time" not in data:
        return
    hhmm = data.pop("start_time")
    if not hhmm:
        return
    hour, minute = (int(part) for part in hhmm.split(":"))
    day = (obj.start_date if obj is not None and obj.start_date else datetime.utcnow()).date()
    data["start_date"] = data["end_date"] = datetime.combine(day, time(hour, minute))


@admin_listing_routes.get("/")
@require_admin
def all_listings():
    out = {key: [_view(key, obj) for obj in _house(kind).all()] for key, kind in partners.KINDS.items()}
    out["guides"] = [_view("guides", g) for g in Guide.query.order_by(Guide.is_sample, Guide.id).all()]
    out["options"] = {"rental_types": partners.RENTAL_TYPES, "categories": partners.EXPERIENCE_CATEGORIES,
                      "palettes": GUIDE_PALETTES}
    return jsonify(out)


@admin_listing_routes.post("/<kind_key>")
@require_admin
@limiter.limit("120 per hour")
def create(kind_key):
    schema = _schema(kind_key)
    if schema is None:
        return jsonify({"error": "Not found"}), 404
    data = json_body(schema)
    if kind_key == "guides":
        _guide_text(data)
        if data.get("slug") and Guide.query.filter_by(slug=data["slug"]).first():
            raise ValidationError({"slug": "That web address name is taken"})
        data["slug"] = data.get("slug") or _guide_slug(data["name"])
        obj = Guide(**data)
    else:
        kind = partners.KINDS[kind_key]
        partners.check_extra(kind, data, None)
        extra = {"business_id": None, "review_status": "approved"}
        if kind_key == "stays":
            extra.update(total_rooms=1, available_rooms=1)
        elif kind_key == "rentals":
            data["rental_company"] = data.get("rental_company") or "Meg'Rooms"
        else:
            now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
            extra.update(start_date=now, end_date=now)
            _start(data)
            extra.update({k: data.pop(k) for k in ("start_date", "end_date") if k in data})
        obj = kind.model(**data, **extra)
    db.session.add(obj)
    db.session.commit()
    return jsonify(_view(kind_key, obj)), 201


@admin_listing_routes.put("/<kind_key>/<int:listing_id>")
@require_admin
@limiter.limit("300 per hour")
def update(kind_key, listing_id):
    schema = _schema(kind_key)
    obj = _find(kind_key, listing_id) if schema else None
    if obj is None:
        return jsonify({"error": "Not found"}), 404
    data = partial_body(schema)
    if kind_key == "guides":
        _guide_text(data)
        data.pop("slug", None)  # the address of a guide's page doesn't change once it exists
    else:
        partners.check_extra(partners.KINDS[kind_key], data, None)
        if kind_key == "stays" and "hotel_name" in data and data["hotel_name"] != obj.hotel_name:
            obj.apartment_name = None  # the short name would otherwise keep showing the old one
        if kind_key == "rentals" and "rental_company" in data and not data["rental_company"]:
            data.pop("rental_company")
        if kind_key == "experiences":
            _start(data, obj)
    for key, value in data.items():
        setattr(obj, key, value)
    db.session.commit()
    return jsonify(_view(kind_key, obj))


@admin_listing_routes.delete("/<kind_key>/<int:listing_id>")
@require_admin
@limiter.limit("120 per hour")
def remove(kind_key, listing_id):
    obj = _find(kind_key, listing_id) if _schema(kind_key) else None
    if obj is None:
        return jsonify({"error": "Not found"}), 404
    if kind_key == "guides":
        if GuideBooking.query.filter_by(guide_id=obj.id).first():
            return jsonify({"error": "This guide has requests on record, so the profile can't be deleted. Switch it off instead."}), 409
        Tour.query.filter_by(guide_id=obj.id).update({"guide_id": None}, synchronize_session=False)
        db.session.delete(obj)
    else:
        kind = partners.KINDS[kind_key]
        if kind_key == "stays" and calendars.active_bookings(obj.id):
            return jsonify({"error": "This apartment has bookings ahead. Finish or cancel them first, or switch it off instead."}), 409
        kind.switch_off(obj)  # kept as a row so past bookings still make sense
        obj.review_status, obj.image_urls = "removed", []
        if kind_key == "stays":
            calendars.forget_stay(obj.id)
    db.session.commit()
    return "", 204

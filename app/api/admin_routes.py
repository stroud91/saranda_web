"""Operator endpoints (Clerk admin token required)."""
from flask import Blueprint, abort, g, jsonify, request

from app.auth import require_admin
from app.models import Booking, ContactMessage, Guide, GuideBooking, db
from app.validation import Field, json_body, query_args

admin_routes = Blueprint("admin", __name__)


@admin_routes.get("/me")
@require_admin
def me():
    return jsonify({"user_id": g.claims.get("sub"), "admin": True})


@admin_routes.get("/bookings")
@require_admin
def list_bookings():
    args = query_args({"status": Field(max_len=20)})
    q = Booking.query
    if args["status"]:
        q = q.filter_by(status=args["status"])
    return jsonify([b.to_admin_dict() for b in q.order_by(Booking.start_date.desc()).limit(500)])


@admin_routes.patch("/bookings/<reference>")
@require_admin
def update_booking(reference):
    booking = Booking.query.filter_by(reference=reference.upper()).first() or abort(404)
    data = json_body({"status": Field(required=True, choices=["requested", "confirmed", "cancelled"])})
    booking.status = data["status"]
    db.session.commit()
    return jsonify(booking.to_admin_dict())


@admin_routes.get("/guide-requests")
@require_admin
def list_guide_requests():
    rows = GuideBooking.query.order_by(GuideBooking.tour_date.desc()).limit(500).all()
    return jsonify([r.to_admin_dict() for r in rows])


@admin_routes.patch("/guide-requests/<reference>")
@require_admin
def update_guide_request(reference):
    row = GuideBooking.query.filter_by(reference=reference.upper()).first() or abort(404)
    data = json_body({"status": Field(required=True, choices=["requested", "accepted", "declined", "cancelled"])})
    row.status = data["status"]
    db.session.commit()
    return jsonify(row.to_admin_dict())


GUIDE_SCHEMA = {
    "slug": Field("slug", required=True),
    "name": Field(required=True, max_len=120),
    "headline": Field(required=True, max_len=200),
    "bio": Field("text", required=True, max_len=4000),
    "base_city": Field(required=True, max_len=80),
    "languages": Field("list", required=True, min=1, max_items=12, item=Field(max_len=40)),
    "specialties": Field("list", max_items=12, item=Field(max_len=40), default=[]),
    "regions": Field("list", max_items=10, item=Field("slug"), default=[]),
    "signature_stops": Field("list", max_items=12, item=Field("slug"), default=[]),
    "years_experience": Field("int", min=0, max=60, default=1),
    "price_half_day": Field("float", required=True, min=0, max=5000),
    "price_full_day": Field("float", required=True, min=0, max=10000),
    "max_group": Field("int", min=1, max=60, default=8),
    "has_vehicle": Field("bool", default=False),
    "licensed": Field("bool", default=False),
    "palette": Field(choices=["sea", "sunset", "olive", "lagoon", "aegean", "spring", "terracotta"], default="sea"),
    "contact_email": Field("email"),
    "whatsapp": Field("phone"),
    "is_sample": Field("bool", default=False),
    "is_active": Field("bool", default=True),
}


@admin_routes.post("/guides")
@require_admin
def create_guide():
    data = json_body(GUIDE_SCHEMA)
    if Guide.query.filter_by(slug=data["slug"]).first():
        return jsonify({"error": "Slug already in use", "fields": {"slug": "Taken"}}), 409
    guide = Guide(**data)
    db.session.add(guide)
    db.session.commit()
    return jsonify(guide.to_dict()), 201


@admin_routes.put("/guides/<slug>")
@require_admin
def update_guide(slug):
    guide = Guide.query.filter_by(slug=slug).first() or abort(404)
    body = request.get_json(silent=True) or {}
    for k, v in json_body({k: v for k, v in GUIDE_SCHEMA.items() if k in body and k != "slug"}).items():
        setattr(guide, k, v)
    db.session.commit()
    return jsonify(guide.to_dict())


@admin_routes.get("/messages")
@require_admin
def list_messages():
    rows = ContactMessage.query.order_by(ContactMessage.created_at.desc()).limit(500).all()
    return jsonify([m.to_admin_dict() for m in rows])

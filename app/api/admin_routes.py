"""Host endpoints: a signed-in host account, or a Clerk admin token."""
from flask import Blueprint, abort, g, jsonify, request

from app.auth import require_admin
from app.models import Booking, Business, ContactMessage, Guide, GuideBooking, Hotel, Review, db
from app.models.db import utcnow
from app.services import accounts, cancellations, mailer, partners, reviews, stats
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
    # The host's own stays only: a partner's bookings are theirs to confirm in their dashboard.
    q = Booking.query.outerjoin(Hotel, Booking.hotel_id == Hotel.id).filter(Hotel.business_id.is_(None))
    if args["status"]:
        q = q.filter_by(status=args["status"])
    rows = q.order_by(Booking.created_at.desc()).limit(500).all()
    stale = [b for b in rows if b.status == "pending" and not b.is_blocking]
    for b in stale:  # holds that ran out without payment
        b.status = "expired"
    if stale:
        db.session.commit()
    return jsonify([_admin_view(b) for b in rows])


@admin_routes.patch("/bookings/<reference>")
@require_admin
def update_booking(reference):
    booking = Booking.query.filter_by(reference=reference.upper()).first() or abort(404)
    if booking.hotel and booking.hotel.business_id:
        abort(404)  # belongs to a partner business
    data = json_body({"status": Field(choices=["requested", "confirmed", "cancelled"]),
                      "paid": Field("bool")})
    if not data["status"] and data["paid"] is None:
        abort(400)
    was_confirmed, was_cancelled = booking.status == "confirmed", booking.status == "cancelled"
    if data["paid"]:  # e.g. the bank transfer arrived
        booking.mark_paid()
    elif data["status"] == "cancelled":
        if not was_cancelled:
            cancellations.cancel(booking, by="host")  # a host's cancellation always owes back everything paid
    elif data["status"]:
        booking.status = data["status"]
    db.session.commit()
    if booking.status == "confirmed" and not was_confirmed and booking.guest_email and mailer.configured():
        mailer.deliver(mailer.booking_confirmed, booking.to_public_dict(), booking.guest_email, accounts.site_url())
    if booking.status == "cancelled" and not was_cancelled and booking.guest_email and mailer.configured():
        mailer.deliver(mailer.booking_cancelled, booking.to_public_dict(), booking.guest_email, accounts.site_url())
    return jsonify(_admin_view(booking))


def _admin_view(booking):
    out = booking.to_admin_dict()
    out["refund_methods"] = cancellations.refund_methods(booking) if booking.refund_status == "due" else []
    return out


@admin_routes.post("/bookings/<reference>/refund")
@require_admin
def refund_booking(reference):
    """Send the refund that is due: through PayPal or the card processor when the guest paid
    that way, or record that it was paid back by hand (bank transfer, cash)."""
    booking = Booking.query.filter_by(reference=reference.upper()[:20]).first() or abort(404)
    if booking.hotel and booking.hotel.business_id:
        abort(404)
    data = json_body({"method": Field(required=True, choices=["paypal", "card", "manual"])})
    try:
        cancellations.send_refund(booking, data["method"])
    except cancellations.RefundError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 409
    db.session.commit()
    if booking.guest_email and mailer.configured():
        mailer.deliver(mailer.refund_sent, booking.to_public_dict(), booking.guest_email, accounts.site_url())
    return jsonify(_admin_view(booking))


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


# ---- visitor statistics ---------------------------------------------------------
@admin_routes.get("/stats")
@require_admin
def visitor_stats():
    """Visitors, page views and bookings per day, plus the top pages and where visitors came from."""
    args = query_args({"days": Field("int", min=1, max=366, default=30)})
    return jsonify({**stats.report(args["days"]), "enabled": stats.enabled()})


# ---- guest reviews --------------------------------------------------------------
@admin_routes.get("/reviews")
@require_admin
def list_reviews():
    """Every review on the site, newest first, hidden ones included."""
    rows = Review.query.order_by(Review.created_at.desc()).limit(500).all()
    return jsonify([r.to_host_dict() for r in rows])


@admin_routes.patch("/reviews/<int:review_id>")
@require_admin
def moderate_review(review_id):
    """Hide or show a review, or reply to one about the site's own stays."""
    review = db.session.get(Review, review_id) or abort(404)
    data = json_body({"action": Field(choices=["hide", "publish"]), "reason": Field(max_len=300),
                      "reply": Field("text", max_len=1500)})
    body = request.get_json(silent=True) or {}
    if data["action"] == "hide":
        if not data["reason"] or len(data["reason"]) < 5:
            return jsonify({"error": "Say why it is hidden (abusive, off-topic, personal details…)", "fields": {"reason": "Required"}}), 400
        review.status, review.hidden_reason = "hidden", data["reason"]
    elif data["action"] == "publish":
        review.status, review.hidden_reason = "published", None
    if "reply" in body:
        if reviews.hosted_by(review) is not None:
            return jsonify({"error": "The business that hosts this stay replies to its own reviews."}), 409
        review.reply = data["reply"] or None
        review.replied_at = utcnow() if review.reply else None
    db.session.commit()
    return jsonify(review.to_host_dict())


@admin_routes.post("/bookings/<reference>/review-link")
@require_admin
def review_link(reference):
    """A fresh review link for a finished stay of the site's own, to send by WhatsApp when
    e-mail isn't set up. Making a new one cancels the previous link."""
    booking = Booking.query.filter_by(reference=reference.upper()[:20]).first() or abort(404)
    if booking.hotel and booking.hotel.business_id:
        abort(404)
    why = reviews.can_review(booking)
    if why:
        return jsonify({"error": why}), 409
    key = reviews.new_key(booking)
    booking.review_invited_at = booking.review_invited_at or utcnow()
    db.session.commit()
    return jsonify({"url": f"{accounts.site_url() or request.host_url.rstrip('/')}/review/{booking.reference}?key={key}"})


# ---- partner businesses: review what they submit ------------------------------
def _owner_email(business):
    owner = business.owner
    return owner.email if owner and owner.email_verified else None


def _business_row(business):
    out = business.to_owner_dict()
    out.update({"slug": business.slug, "owner_email": business.owner.email if business.owner else None,
                "listings": partners.listing_count(business),
                "created_at": business.created_at.isoformat() + "Z" if business.created_at else None})
    return out


@admin_routes.get("/partners")
@require_admin
def list_partners():
    """The review queue, plus every business for an overview."""
    businesses = Business.query.filter(Business.status != "closed").order_by(Business.created_at.desc()).limit(500).all()
    return jsonify({"queue": partners.review_queue(), "businesses": [_business_row(b) for b in businesses]})


REVIEW_SCHEMA = {"action": Field(required=True, choices=["approve", "reject", "suspend", "reinstate"]),
                 "note": Field("text", max_len=600)}


@admin_routes.patch("/partners/businesses/<int:business_id>")
@require_admin
def review_business(business_id):
    business = db.session.get(Business, business_id)
    if not business or business.status == "closed":
        abort(404)
    data = json_body(REVIEW_SCHEMA)
    action, note, to, base = data["action"], data["note"], _owner_email(business), accounts.site_url()
    waiting = business.status in ("pending", "rejected") or bool(business.pending_changes)
    if action in ("approve", "reject") and not waiting:
        return jsonify({"error": "Nothing is waiting for review on this business"}), 409
    if action == "approve":
        partners.approve(business, status_attr="status")
        db.session.commit()
        mailer.deliver(mailer.partner_decision, to, business.name, True, None, base)
    elif action == "reject":
        if not note:
            return jsonify({"error": "Say what needs to change", "fields": {"note": "Add a short note for the business"}}), 400
        partners.reject(business, note, status_attr="status")
        db.session.commit()
        mailer.deliver(mailer.partner_decision, to, business.name, False, note, base)
    else:
        wanted = "suspended" if action == "suspend" else "approved"
        if business.status not in ("approved", "suspended"):
            return jsonify({"error": "Only an approved business can be suspended or reinstated"}), 409
        if business.status != wanted:
            business.status = wanted
            business.review_note = note if wanted == "suspended" else None
            db.session.commit()
            mailer.deliver(mailer.partner_status, to, business.name, wanted, note, base)
    return jsonify(_business_row(business))


@admin_routes.patch("/partners/listings/<kind_key>/<int:listing_id>")
@require_admin
def review_listing(kind_key, listing_id):
    kind = partners.KINDS.get(kind_key) or abort(404)
    obj = db.session.get(kind.model, listing_id)
    if not obj or not obj.business_id or obj.review_status == "removed":
        abort(404)
    data = json_body({"action": Field(required=True, choices=["approve", "reject"]), "note": Field("text", max_len=600)})
    if obj.review_status not in ("pending", "rejected") and not obj.pending_changes:
        return jsonify({"error": "Nothing is waiting for review on this listing"}), 409
    name, to, base = kind.name(obj), _owner_email(obj.business), accounts.site_url()
    if data["action"] == "approve":
        partners.approve(obj)
    else:
        if not data["note"]:
            return jsonify({"error": "Say what needs to change", "fields": {"note": "Add a short note for the business"}}), 400
        partners.reject(obj, data["note"])
    db.session.commit()
    mailer.deliver(mailer.partner_decision, to, name, data["action"] == "approve", data["note"], base)
    return jsonify(partners.owner_view(kind, obj))

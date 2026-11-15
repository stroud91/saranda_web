"""The business dashboard: one place where a local business manages its
profile, its apartments, rentals and activities, and the requests guests send.

Security model:
- Every route needs a signed-in account; anything that submits content also
  needs a confirmed e-mail address.
- A business is always looked up from the session's user, never from an id in
  the request, and listings are fetched together with that business id — so one
  owner can't read or change another's data (the answer is a plain 404).
- Only the fields in ``app.services.partners`` schemas are accepted, and
  nothing is public until the host approves it.
"""
from datetime import datetime
from functools import wraps

from flask import Blueprint, current_app, g, jsonify
from sqlalchemy.exc import IntegrityError

from app.extensions import limiter
from app.models import Booking, Business, Enquiry, Hotel, Review, db
from app.models.db import utcnow
from app.models.business import PALETTES, STYLE_OPTIONS
from app.services import accounts, calendars, mailer, partners
from app.validation import Field, json_body, partial_body

partner_routes = Blueprint("partner", __name__)


@partner_routes.before_request
def _switch():
    if not partners.enabled():
        return jsonify({"error": "Not found"}), 404
    return None


def _own_business(user):
    return Business.query.filter_by(owner_id=user.id).first()


def verified(fn):
    """Signed in, with an e-mail address they have proved is theirs."""
    @wraps(fn)
    @accounts.login_required
    def wrapper(*args, **kwargs):
        if not accounts.current_user().email_verified:
            return jsonify({"error": "Confirm your email address first — use the link we emailed you.",
                            "code": "verify_email"}), 403
        return fn(*args, **kwargs)
    return wrapper


def owner(fn):
    """Signed in and has a business; it is put on ``g.business``."""
    @wraps(fn)
    @accounts.login_required
    def wrapper(*args, **kwargs):
        business = _own_business(accounts.current_user())
        if not business:
            return jsonify({"error": "Create your business profile first"}), 404
        g.business = business
        return fn(*args, **kwargs)
    return wrapper


def _listing(kind_key, listing_id):
    """(kind, listing) if it belongs to the signed-in owner's business, else (kind, None)."""
    kind = partners.KINDS.get(kind_key)
    if not kind:
        return None, None
    obj = kind.model.query.filter_by(id=listing_id, business_id=g.business.id).first()
    if obj is not None and obj.review_status == "removed":
        obj = None
    return kind, obj


def _not_found():
    return jsonify({"error": "Not found"}), 404


_sent_fields = partial_body


def _tell_host(what, name):
    mailer.deliver(mailer.partner_review_needed, what, name, g.business.name, accounts.site_url())


def _open_requests(business):
    bookings = (Booking.query.join(Hotel, Booking.hotel_id == Hotel.id)
                .filter(Hotel.business_id == business.id, Booking.status == "requested").count())
    return bookings + Enquiry.query.filter_by(business_id=business.id, status="new").count()


@partner_routes.get("/")
@accounts.login_required
def dashboard():
    """Everything the dashboard shows, in one request."""
    user = accounts.current_user()
    business = _own_business(user)
    listings = {key: [partners.owner_view(kind, obj) for obj in partners.owned(kind, business)] if business else []
                for key, kind in partners.KINDS.items()}
    return jsonify({
        "business": business.to_owner_dict() if business else None,
        "listings": listings,
        "new_requests": _open_requests(business) if business else 0,
        "email_verified": user.email_verified,
        "max_listings": current_app.config.get("PARTNER_MAX_LISTINGS", 40),
        "options": {"rental_types": partners.RENTAL_TYPES, "categories": partners.EXPERIENCE_CATEGORIES,
                    "palettes": list(PALETTES), "style": {k: list(v) for k, v in STYLE_OPTIONS.items()}},
    })


@partner_routes.post("/business")
@verified
@limiter.limit("5 per hour")
def create_business():
    user = accounts.current_user()
    if _own_business(user):
        return jsonify({"error": "This account already has a business profile"}), 409
    data = json_body(partners.BUSINESS_SCHEMA)
    data["style"] = partners.clean_style(data["style"])
    data["translations"] = partners.clean_translations(data["translations"], partners.BUSINESS_SCHEMA, partners.TRANSLATABLE["business"])
    business = Business(**data, owner_id=user.id, slug=partners.slugify(data["name"]), status="pending")
    db.session.add(business)
    try:
        db.session.commit()
    except IntegrityError:  # a double submit, or two businesses picking the same name at once
        db.session.rollback()
        return jsonify({"error": "That didn't go through. Reload the page and try again."}), 409
    g.business = business
    _tell_host("New business", business.name)
    return jsonify(business.to_owner_dict()), 201


@partner_routes.put("/business")
@verified
@owner
@limiter.limit("30 per hour")
def update_business():
    business = g.business
    data = _sent_fields(partners.BUSINESS_SCHEMA)
    if "style" in data:
        data["style"] = partners.clean_style(data["style"])
    if "translations" in data:
        data["translations"] = partners.clean_translations(data["translations"], partners.BUSINESS_SCHEMA, partners.TRANSLATABLE["business"])
    was_waiting = business.status == "pending" or bool(business.pending_changes)
    needs_review = partners.submit(business, data, partners.BUSINESS_LIVE, status_attr="status")
    db.session.commit()
    if needs_review and not was_waiting:
        _tell_host("Business profile changes", business.name)
    return jsonify(business.to_owner_dict())


@partner_routes.post("/listings/<kind_key>")
@verified
@owner
@limiter.limit("60 per hour")
def create_listing(kind_key):
    kind = partners.KINDS.get(kind_key)
    if not kind:
        return _not_found()
    business = g.business
    if business.status == "suspended":
        return jsonify({"error": "Your business is suspended, so new listings can't be added. Contact us."}), 403
    limit = current_app.config.get("PARTNER_MAX_LISTINGS", 40)
    if partners.listing_count(business) >= limit:
        return jsonify({"error": f"You've reached the limit of {limit} listings. Remove one or contact us."}), 409
    data = json_body(kind.schema)
    partners.check_extra(kind, data, business.id)
    extra = {"business_id": business.id, "review_status": "pending"}
    if kind.key == "stays":
        extra.update(total_rooms=1, available_rooms=1)
    elif kind.key == "rentals":
        extra.update(rental_company=business.name)
    else:
        now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        extra.update(start_date=now, end_date=now, created_by=accounts.current_user().id)
    obj = kind.model(**data, **extra)
    db.session.add(obj)
    db.session.commit()
    _tell_host(f"New {kind.label.lower()}", kind.name(obj))
    return jsonify(partners.owner_view(kind, obj)), 201


@partner_routes.put("/listings/<kind_key>/<int:listing_id>")
@verified
@owner
@limiter.limit("120 per hour")
def update_listing(kind_key, listing_id):
    kind, obj = _listing(kind_key, listing_id)
    if obj is None:
        return _not_found()
    data = _sent_fields(kind.schema)
    partners.check_extra(kind, data, g.business.id)
    was_waiting = obj.review_status == "pending" or bool(obj.pending_changes)
    needs_review = partners.submit(obj, data, kind.live)
    db.session.commit()
    if needs_review and not was_waiting:
        _tell_host(f"{kind.label} changes", kind.name(obj))
    return jsonify(partners.owner_view(kind, obj))


@partner_routes.delete("/listings/<kind_key>/<int:listing_id>")
@owner
@limiter.limit("120 per hour")
def remove_listing(kind_key, listing_id):
    kind, obj = _listing(kind_key, listing_id)
    if obj is None:
        return _not_found()
    kind.switch_off(obj)  # kept as a row so past bookings and enquiries still make sense
    obj.review_status, obj.pending_changes, obj.image_urls = "removed", None, []
    if kind.key == "stays":
        calendars.forget_stay(obj.id)
    db.session.commit()
    return "", 204


# ---- requests from guests ----------------------------------------------------
def _own_bookings(business):
    return Booking.query.join(Hotel, Booking.hotel_id == Hotel.id).filter(Hotel.business_id == business.id)


@partner_routes.get("/requests")
@owner
def requests_inbox():
    business = g.business
    bookings = _own_bookings(business).order_by(Booking.created_at.desc()).limit(300).all()
    enquiries = Enquiry.query.filter_by(business_id=business.id).order_by(Enquiry.created_at.desc()).limit(300).all()
    return jsonify({"bookings": [b.to_host_dict() for b in bookings],
                    "enquiries": [e.to_owner_dict() for e in enquiries]})


@partner_routes.patch("/bookings/<reference>")
@owner
@limiter.limit("120 per hour")
def answer_booking(reference):
    booking = _own_bookings(g.business).filter(Booking.reference == reference.upper()[:20]).first()
    if not booking:
        return _not_found()
    data = json_body({"status": Field(required=True, choices=["confirmed", "cancelled"])})
    allowed = {"requested": ("confirmed", "cancelled"), "confirmed": ("cancelled",)}
    if data["status"] not in allowed.get(booking.status, ()):
        return jsonify({"error": f"A {booking.status} booking can't be changed to {data['status']}"}), 409
    booking.status = data["status"]
    if booking.status == "cancelled" and booking.payment_status == "unpaid":
        booking.payment_status = "cancelled"
    db.session.commit()
    if booking.guest_email and mailer.configured():
        template = mailer.booking_confirmed if booking.status == "confirmed" else mailer.booking_cancelled
        mailer.deliver(template, booking.to_public_dict(), booking.guest_email, accounts.site_url())
    return jsonify(booking.to_host_dict())


# ---- reviews of the business's stays ---------------------------------------------
def _own_reviews(business):
    return Review.query.join(Hotel, Review.hotel_id == Hotel.id).filter(Hotel.business_id == business.id)


@partner_routes.get("/reviews")
@owner
def own_reviews():
    """Published reviews of this business's stays. Hidden ones are not shown here either."""
    rows = _own_reviews(g.business).filter(Review.status == "published").order_by(Review.created_at.desc()).limit(300).all()
    return jsonify([r.to_host_dict() for r in rows])


@partner_routes.patch("/reviews/<int:review_id>")
@verified
@owner
@limiter.limit("60 per hour")
def reply_to_review(review_id):
    """One public reply per review. A business can answer a review, never edit or remove it."""
    review = _own_reviews(g.business).filter(Review.id == review_id, Review.status == "published").first()
    if not review:
        return _not_found()
    data = json_body({"reply": Field("text", max_len=1500)})
    review.reply = data["reply"] or None
    review.replied_at = utcnow() if review.reply else None
    db.session.commit()
    return jsonify(review.to_host_dict())


@partner_routes.patch("/enquiries/<reference>")
@owner
@limiter.limit("120 per hour")
def answer_enquiry(reference):
    enquiry = Enquiry.query.filter_by(reference=reference.upper()[:20], business_id=g.business.id).first()
    if not enquiry:
        return _not_found()
    data = json_body({"status": Field(required=True, choices=["new", "answered", "closed"])})
    enquiry.status = data["status"]
    db.session.commit()
    return jsonify(enquiry.to_owner_dict())

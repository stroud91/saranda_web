"""Reviews: reading them, writing one after a stay, and the invitation link."""
from flask import Blueprint, current_app, jsonify, request

from app.extensions import limiter
from app.models import Booking, Hotel, db
from app.services import accounts, mailer, partners, reviews
from app.validation import Field, json_body

review_routes = Blueprint("reviews", __name__)

REVIEW_SCHEMA = {
    "reference": Field(required=True, max_len=20),
    "key": Field(max_len=80),
    "rating": Field("int", required=True, min=1, max=5, label="Rating"),
    "title": Field(max_len=120),
    "text": Field("text", required=True, max_len=2000, label="Your review"),
    "lang": Field(choices=["sq", "en", "fr", "it", "de"]),
    "website": Field(max_len=200),  # honeypot
}


@review_routes.before_request
def _switch():
    if not current_app.config.get("REVIEWS_ENABLED", True):
        return jsonify({"error": "Not found"}), 404
    return None


def _booking(reference):
    return Booking.query.filter_by(reference=(reference or "").upper()[:20]).first()


def _allowed(booking, key):
    """Has the caller shown they are the guest? Returns (ok, signed_in)."""
    user = accounts.current_user()
    return reviews.key_matches(booking, key) or reviews.owns(booking, user)


@review_routes.get("/stays/<int:hotel_id>")
def stay_reviews(hotel_id):
    hotel = Hotel.query.filter(Hotel.id == hotel_id, partners.public_filter(Hotel)).first()
    if not hotel:
        return jsonify({"error": "Not found"}), 404
    return jsonify(reviews.for_stay(hotel.id))


@review_routes.get("/invite/<reference>")
@limiter.limit("60 per hour")
def invitation(reference):
    """What the review form needs to show. The same answer is given for a wrong reference
    and a wrong key, so the form can't be used to test which bookings exist."""
    booking = _booking(reference)
    if not booking or not _allowed(booking, request.args.get("key", "")):
        return jsonify({"error": "This review link isn't valid any more. Open the link from our email, or sign in with the email address you booked with."}), 404
    why = reviews.can_review(booking)
    return jsonify({"eligible": why is None, "reason": why,
                    "stay": {"id": booking.hotel_id, "name": booking.hotel.hotel_name if booking.hotel else None},
                    "start_date": booking.start_date.date().isoformat(), "end_date": booking.end_date.date().isoformat(),
                    "first_name": (booking.guest_name or "").split(" ")[0] or None})


@review_routes.post("/")
@limiter.limit("10 per hour")
def write_review():
    data = json_body(REVIEW_SCHEMA)
    if data["website"]:
        return jsonify({"error": "Request rejected"}), 400
    booking = _booking(data["reference"])
    if not booking or not _allowed(booking, data["key"]):
        return jsonify({"error": "This review link isn't valid any more. Open the link from our email, or sign in with the email address you booked with."}), 404
    why = reviews.can_review(booking)
    if why:
        return jsonify({"error": why}), 409
    if len(data["text"]) < 20:
        return jsonify({"error": "Tell us a little more (at least 20 characters).", "fields": {"text": "Too short"}}), 400
    review = reviews.create(booking, data["rating"], data["text"], data["title"], data["lang"])
    db.session.commit()
    business = reviews.hosted_by(review)
    to = business.owner.email if business and business.owner and business.owner.email_verified else None
    if business is None or to:
        mailer.deliver(mailer.review_received, review.to_host_dict(), to, accounts.site_url(), bool(business))
    return jsonify(review.to_public_dict()), 201

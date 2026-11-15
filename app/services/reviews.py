"""Guest reviews of stays.

Who can write one: only the guest of a confirmed booking whose stay has
finished, once per booking. They prove it with the secret key in the link we
e-mail them after check-out, or by being signed in with the verified address
the booking was made with. A business never sees that key, so it can't review
its own stay.

Reviews appear as soon as they are written, good or bad. The site's host can
hide one that is abusive, off-topic or reveals personal details (a reason is
recorded), and whoever hosts the stay can post one public reply.
"""
import secrets
from datetime import timedelta

from flask import current_app
from sqlalchemy import func

from app.models import Booking, Hotel, Review, db
from app.models.db import utcnow
from app.models.user import hash_token

WINDOW_DAYS = 180  # how long after check-out a review can still be written
INVITE_AFTER_HOURS = 20  # the invitation goes out the day after check-out
INVITE_WITHIN_DAYS = 14


def summary(hotel_ids):
    """{hotel_id: {"average": 4.8, "count": 12}} for published reviews."""
    ids = list(hotel_ids)
    if not ids:
        return {}
    rows = (db.session.query(Review.hotel_id, func.avg(Review.rating), func.count(Review.id))
            .filter(Review.hotel_id.in_(ids), Review.status == "published").group_by(Review.hotel_id).all())
    return {hid: {"average": round(float(avg), 1), "count": int(n)} for hid, avg, n in rows}


def for_stay(hotel_id, limit=60):
    rows = (Review.query.filter_by(hotel_id=hotel_id, status="published").order_by(Review.created_at.desc()).limit(limit).all())
    stats = summary([hotel_id]).get(hotel_id, {"average": None, "count": 0})
    spread = dict(db.session.query(Review.rating, func.count(Review.id))
                  .filter_by(hotel_id=hotel_id, status="published").group_by(Review.rating).all())
    return {**stats, "spread": {str(n): int(spread.get(n, 0)) for n in range(5, 0, -1)}, "reviews": [r.to_public_dict() for r in rows]}


def finished(booking):
    return booking.status == "confirmed" and booking.end_date is not None and booking.end_date <= utcnow()


def can_review(booking):
    """None if this booking may be reviewed now, else why not (in words for the guest)."""
    if not booking or not booking.hotel_id:
        return "We couldn't find that stay."
    if booking.status != "confirmed":
        return "Only confirmed stays can be reviewed."
    if not finished(booking):
        return "You can write a review once your stay has finished."
    if booking.end_date < utcnow() - timedelta(days=WINDOW_DAYS):
        return "Reviews can be written up to six months after a stay."
    if Review.query.filter_by(booking_id=booking.id).first():
        return "This stay has already been reviewed. Thank you!"
    return None


def key_matches(booking, key):
    return bool(booking and booking.review_key_hash and key and secrets.compare_digest(booking.review_key_hash, hash_token(key)))


def owns(booking, user):
    """Is this signed-in account the guest of the booking? (Their address must be confirmed.)"""
    if not booking or not user or not user.email_verified:
        return False
    return booking.user_id == user.id or (booking.guest_email or "").lower() == user.email.lower()


def new_key(booking):
    """A fresh secret for the review link (replaces any earlier one). The caller commits."""
    key = secrets.token_urlsafe(24)
    booking.review_key_hash = hash_token(key)
    return key


def author(booking):
    parts = (booking.guest_name or "").split()
    if not parts:
        return None
    return (parts[0][:40] + (f" {parts[-1][0].upper()}." if len(parts) > 1 else ""))[:60]


def create(booking, rating, text, title=None, lang=None):
    review = Review(hotel_id=booking.hotel_id, booking_id=booking.id, rating=rating, title=title or None, text=text,
                    author_name=author(booking), stay_month=booking.end_date.strftime("%Y-%m"), lang=lang)
    booking.review_key_hash = None  # the link has done its job
    db.session.add(review)
    return review


def forget_author(email=None, user_id=None):
    """A guest deleted their account: their reviews stay, without their name."""
    conds = []
    if user_id:
        conds.append(Booking.user_id == user_id)
    if email:
        conds.append(func.lower(Booking.guest_email) == email.lower())
    if not conds:
        return
    ids = [b.id for b in Booking.query.filter(db.or_(*conds)).all()]
    if ids:
        Review.query.filter(Review.booking_id.in_(ids)).update({"author_name": None}, synchronize_session=False)


def send_invitations(limit=200):
    """E-mail guests whose stay ended yesterday (or in the last two weeks) a link to review it.
    Each booking is invited once. Returns how many were sent."""
    from app.services import accounts, mailer  # local import: mailer is optional at import time

    base = accounts.site_url()
    if not base or not mailer.configured() or not current_app.config.get("REVIEWS_ENABLED", True):
        return 0
    now = utcnow()
    rows = (Booking.query.filter(Booking.status == "confirmed", Booking.hotel_id.isnot(None), Booking.review_invited_at.is_(None),
                                 Booking.guest_email.isnot(None), Booking.end_date <= now - timedelta(hours=INVITE_AFTER_HOURS),
                                 Booking.end_date >= now - timedelta(days=INVITE_WITHIN_DAYS))
            .order_by(Booking.end_date).limit(limit).all())
    sent = 0
    for booking in rows:
        if can_review(booking) is not None:
            continue
        key = new_key(booking)
        booking.review_invited_at = now
        db.session.commit()  # recorded first: a mail hiccup must not lead to a second invitation tomorrow
        if mailer.review_invitation(booking.to_public_dict(), booking.guest_email, f"{base}/review/{booking.reference}?key={key}"):
            sent += 1
    return sent


def hosted_by(review):
    """The business that hosts the reviewed stay, or None for the site's own."""
    hotel = review.hotel or db.session.get(Hotel, review.hotel_id)
    return hotel.business if hotel else None

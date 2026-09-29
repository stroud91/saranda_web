"""Stay bookings.

Security model:
- The price is computed server-side from the stay's nightly rate; the client
  never sends an amount.
- Bookings are addressed by an unguessable reference, never a sequential id,
  and public reads return masked contact details only.
- Confirmation happens only after Stripe says the payment succeeded (signed
  webhook, or a server-side status check) — never on a client's say-so.
- Overlapping dates are rejected; unpaid holds expire after 30 minutes.
"""
from datetime import date, datetime
from decimal import Decimal

from flask import Blueprint, abort, jsonify, request
from sqlalchemy import select

from app.extensions import limiter
from app.models import Booking, Hotel, db
from app.services import payments
from app.validation import Field, ValidationError, json_body

from .hotels_routes import blocking_bookings

bookings_routes = Blueprint("bookings", __name__)

BOOKING_SCHEMA = {
    "hotel_id": Field("int", required=True, min=1, label="Stay"),
    "start_date": Field("date", required=True, label="Check-in"),
    "end_date": Field("date", required=True, label="Check-out"),
    "guest_count": Field("int", required=True, min=1, max=40, label="Guests"),
    "guest_name": Field(required=True, max_len=120, label="Name"),
    "guest_email": Field("email", required=True, max_len=255, label="Email"),
    "guest_phone": Field("phone", max_len=40, label="Phone"),
    "notes": Field("text", max_len=1500),
    "website": Field(max_len=200),  # honeypot
}

MAX_NIGHTS = 60


def quote(hotel, nights):
    nightly = Decimal(str(hotel.price_per_night))
    cleaning = Decimal(str(hotel.cleaning_fee or 0))
    return (nightly * nights + cleaning).quantize(Decimal("0.01"))


@bookings_routes.post("/quote")
def quote_booking():
    """Price a stay before booking (same maths as checkout)."""
    data = json_body({k: BOOKING_SCHEMA[k] for k in ("hotel_id", "start_date", "end_date", "guest_count")})
    hotel, nights = _validate_stay(data)
    total = quote(hotel, nights)
    s, e = _dt(data["start_date"]), _dt(data["end_date"])
    return jsonify({"hotel_id": hotel.id, "nights": nights, "nightly": float(hotel.price_per_night),
                    "cleaning_fee": float(hotel.cleaning_fee or 0), "total": float(total), "currency": "EUR",
                    "available": not blocking_bookings(hotel.id, s, e)})


def _dt(d):
    return datetime.combine(d, datetime.min.time())


def _validate_stay(data, lock=False):
    stmt = select(Hotel).where(Hotel.id == data["hotel_id"])
    if lock:
        stmt = stmt.with_for_update()
    hotel = db.session.execute(stmt).scalar_one_or_none()
    if not hotel or hotel.is_active is False:
        raise ValidationError({"hotel_id": "Stay not found"})
    today = date.today()
    if data["start_date"] < today:
        raise ValidationError({"start_date": "Check-in can't be in the past"})
    nights = (data["end_date"] - data["start_date"]).days
    if nights < 1:
        raise ValidationError({"end_date": "Check-out must be after check-in"})
    if nights > MAX_NIGHTS:
        raise ValidationError({"end_date": f"For stays over {MAX_NIGHTS} nights, contact us directly"})
    if nights < (hotel.min_nights or 1):
        raise ValidationError({"end_date": f"Minimum stay is {hotel.min_nights} nights"})
    if data["guest_count"] > (hotel.max_guests or 1):
        raise ValidationError({"guest_count": f"This stay sleeps up to {hotel.max_guests}"})
    return hotel, nights


@bookings_routes.post("/")
@limiter.limit("10 per hour")
def create_booking():
    data = json_body(BOOKING_SCHEMA)
    if data["website"]:
        return jsonify({"error": "Request rejected"}), 400
    hotel, nights = _validate_stay(data, lock=True)
    start, end = _dt(data["start_date"]), _dt(data["end_date"])
    if blocking_bookings(hotel.id, start, end, lock=True):
        db.session.rollback()
        return jsonify({"error": "Those dates were just taken. Please choose different dates.",
                        "fields": {"start_date": "Unavailable"}}), 409

    total = quote(hotel, nights)
    booking = Booking(
        hotel_id=hotel.id, start_date=start, end_date=end, nights=nights, total_cost=total, currency="EUR",
        guest_name=data["guest_name"], guest_email=data["guest_email"].lower(), guest_phone=data["guest_phone"],
        guest_count=data["guest_count"], notes=data["notes"],
    )
    client_secret = None
    if payments.enabled():
        booking.status = "pending"
        booking.start_hold()
        db.session.add(booking)
        db.session.flush()  # assigns the reference
        try:
            intent_id, client_secret = payments.create_intent(
                int(total * 100), reference=booking.reference, email=booking.guest_email,
                description=f"{hotel.hotel_name}, {nights} night(s)")
        except payments.PaymentError as exc:
            db.session.rollback()
            return jsonify({"error": str(exc)}), 502
        booking.stripe_payment_intent_id = intent_id
    else:
        # No online payments configured: request-to-book, host confirms.
        booking.status = "requested"
        db.session.add(booking)
    db.session.commit()
    return jsonify({"booking": booking.to_public_dict(), "clientSecret": client_secret,
                    "payment_required": client_secret is not None}), 201


def _booking_or_404(reference):
    booking = Booking.query.filter_by(reference=(reference or "").upper()[:20]).first()
    if not booking:
        abort(404, description="Booking not found")
    if booking.status == "pending" and not booking.is_blocking:
        booking.status = "expired"
        db.session.commit()
    return booking


@bookings_routes.get("/<reference>")
def get_booking(reference):
    return jsonify(_booking_or_404(reference).to_public_dict())


@bookings_routes.post("/<reference>/sync")
@limiter.limit("30 per hour")
def sync_payment(reference):
    """Ask Stripe (server-side) whether this booking has been paid."""
    booking = _booking_or_404(reference)
    if booking.stripe_payment_intent_id and booking.status in ("pending", "expired") and payments.enabled():
        try:
            status = payments.retrieve_status(booking.stripe_payment_intent_id)
        except payments.PaymentError as exc:
            return jsonify({"error": str(exc)}), 502
        apply_intent_status(booking, status)
        db.session.commit()
    return jsonify(booking.to_public_dict())


def apply_intent_status(booking, status):
    if status == "succeeded":
        booking.status, booking.payment_status = "confirmed", "paid"
    elif status == "processing":
        booking.payment_status = "processing"
    elif status == "canceled":
        booking.status, booking.payment_status = "cancelled", "cancelled"

"""Stay bookings.

Security model:
- The price is computed server-side from the stay's nightly rate; the client
  never sends an amount.
- Bookings are addressed by an unguessable reference, never a sequential id,
  and public reads return masked contact details only.
- Confirmation happens only after the payment provider says the money moved
  (a server-side capture or status check, or a verified webhook), or after the
  host confirms a bank transfer — never on a client's say-so.
- Overlapping dates are rejected; unpaid holds expire (30 minutes for online
  payments, longer for bank transfers).
"""
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from flask import Blueprint, abort, current_app, jsonify, request
from sqlalchemy import select

from app.extensions import limiter
from app.models import Booking, Hotel, db
from app.models.db import utcnow
from app.services import accounts, bank_transfer, checkout, mailer, payments, paypal
from app.validation import Field, ValidationError, json_body

log = logging.getLogger(__name__)

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
    "payment_method": Field(choices=["paypal", "card", "bank", "request"]),
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


def _site():
    """Base URL for return links (configured address first, then this request's)."""
    return accounts.site_url() or request.host_url.rstrip("/")


def _guest(booking):
    return {"name": booking.guest_name, "email": booking.guest_email, "phone": booking.guest_phone}


def _notify_host(booking, event):
    mailer.deliver(mailer.booking_for_host, booking.to_public_dict(), _guest(booking), event)


def _notify_confirmed(booking):
    if booking.guest_email and mailer.configured():
        mailer.deliver(mailer.booking_confirmed, booking.to_public_dict(), booking.guest_email, accounts.site_url())


@bookings_routes.post("/")
@limiter.limit("10 per hour")
def create_booking():
    data = json_body(BOOKING_SCHEMA)
    if data["website"]:
        return jsonify({"error": "Request rejected"}), 400
    available = checkout.method_ids()
    method = data["payment_method"] or available[0]
    if method not in available:
        raise ValidationError({"payment_method": "That way to pay isn't available. Please choose another."})
    hotel, nights = _validate_stay(data, lock=True)
    start, end = _dt(data["start_date"]), _dt(data["end_date"])
    if blocking_bookings(hotel.id, start, end, lock=True):
        db.session.rollback()
        return jsonify({"error": "Those dates were just taken. Please choose different dates.",
                        "fields": {"start_date": "Unavailable"}}), 409

    total = quote(hotel, nights)
    user = accounts.current_user()
    booking = Booking(
        hotel_id=hotel.id, start_date=start, end_date=end, nights=nights, total_cost=total, currency="EUR",
        guest_name=data["guest_name"], guest_email=data["guest_email"].lower(), guest_phone=data["guest_phone"],
        guest_count=data["guest_count"], notes=data["notes"], user_id=user.id if user else None,
        payment_method=method,
    )
    client_secret, payment = None, {"method": method}
    if method == "request":
        # No online payment: request-to-book, host confirms, guest pays on arrival.
        booking.status = "requested"
        db.session.add(booking)
    else:
        booking.status = "pending"
        booking.amount_due = checkout.due_now(total)
        booking.start_hold()
        db.session.add(booking)
        db.session.flush()  # assigns the reference
        description = f"{hotel.hotel_name}, {nights} night(s)"
        try:
            if method == "card":
                intent_id, client_secret = payments.create_intent(
                    int(booking.amount_due * 100), reference=booking.reference, email=booking.guest_email,
                    description=description)
                booking.stripe_payment_intent_id = intent_id
            elif method == "paypal":
                booking.charge_currency, booking.charge_amount = checkout.paypal_charge(booking.amount_due)
                booking.payment_ref, payment["approve_url"] = _paypal_order(booking, description)
            else:  # bank transfer: hold the dates while the money travels
                booking.payment_status = "awaiting_transfer"
                booking.charge_currency, booking.charge_amount = "EUR", booking.amount_due
                booking.start_hold(minutes=60 * current_app.config.get("BANK_HOLD_HOURS", 48))
        except payments.PaymentError as exc:
            db.session.rollback()
            return jsonify({"error": str(exc)}), 502
    db.session.commit()
    if method in ("request", "bank"):
        _notify_host(booking, "requested" if method == "request" else "pending")
    return jsonify({"booking": booking.to_public_dict(), "clientSecret": client_secret,
                    "payment_required": client_secret is not None, "payment": payment}), 201


def _paypal_order(booking, description):
    base = _site()
    return paypal.create_order(
        reference=booking.reference, amount=booking.charge_amount, currency_code=booking.charge_currency,
        description=description, return_url=f"{base}/booking/{booking.reference}?paypal=return",
        cancel_url=f"{base}/booking/{booking.reference}?paypal=cancel")


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
        first = booking.payment_status != "paid"
        booking.mark_paid()
        if first:
            _notify_confirmed(booking)
    elif status == "processing":
        booking.payment_status = "processing"
    elif status == "canceled":
        booking.status, booking.payment_status = "cancelled", "cancelled"


# ---- PayPal ---------------------------------------------------------------------
def apply_paypal_outcome(booking, outcome):
    """Update a booking from PayPal's own description of the capture. Returns the new state."""
    if paypal.paid_in_full(outcome, reference=booking.reference, amount=booking.charge_amount,
                           currency_code=booking.charge_currency):
        first = booking.payment_status != "paid"
        booking.mark_paid()
        if first:
            _notify_confirmed(booking)
            _notify_host(booking, "paid")
        return "paid"
    state = outcome.get("capture_status")
    if state == "COMPLETED":
        # Money moved but not what we asked for: never auto-confirm; the host reviews it.
        log.error("paypal capture mismatch for %s", booking.reference)
        booking.payment_status = "review"
        return "review"
    if state == "PENDING":  # e.g. under PayPal review; keep the dates while it settles
        booking.payment_status = "processing"
        booking.start_hold(minutes=72 * 60)
        return "processing"
    if state in ("DECLINED", "FAILED"):
        booking.payment_status = "failed"
        return "failed"
    return "unpaid"


def _still_available(booking):
    others = [b for b in blocking_bookings(booking.hotel_id, booking.start_date, booking.end_date, lock=True)
              if b.id != booking.id]
    return not others


@bookings_routes.post("/<reference>/paypal/start")
@limiter.limit("20 per hour")
def paypal_start(reference):
    """A fresh link to PayPal for a booking that is still waiting for payment."""
    booking = _booking_or_404(reference)
    if booking.payment_method != "paypal" or booking.status != "pending" or not paypal.enabled():
        return jsonify({"error": "This booking can't be paid with PayPal"}), 409
    try:
        hotel_name = booking.hotel.hotel_name if booking.hotel else "Stay"
        booking.payment_ref, url = _paypal_order(booking, f"{hotel_name}, {booking.nights} night(s)")
    except payments.PaymentError as exc:
        return jsonify({"error": str(exc)}), 502
    db.session.commit()
    return jsonify({"approve_url": url})


@bookings_routes.post("/<reference>/paypal/capture")
@limiter.limit("30 per hour")
def paypal_capture(reference):
    """Called when the guest returns from PayPal: capture server-side and confirm."""
    booking = _booking_or_404(reference)
    if booking.payment_method != "paypal" or not booking.payment_ref or not paypal.enabled():
        return jsonify({"error": "This booking can't be paid with PayPal"}), 409
    if booking.status == "confirmed":
        return jsonify(booking.to_public_dict())
    if booking.status not in ("pending", "expired"):
        return jsonify({"error": "This booking is no longer open for payment"}), 409
    if booking.status == "expired":
        # The hold ran out while the guest was at PayPal. Only take the money
        # if nobody else has the dates; otherwise nothing is charged.
        if not _still_available(booking):
            db.session.rollback()
            return jsonify({"error": "The hold on these dates ran out and they were booked by someone else. "
                                     "You have not been charged."}), 409
        booking.status = "pending"
        booking.start_hold()
        db.session.commit()
    try:
        outcome = paypal.capture(booking.payment_ref, booking.reference)
    except payments.PaymentError as exc:
        return jsonify({"error": str(exc)}), 502
    state = apply_paypal_outcome(booking, outcome)
    db.session.commit()
    out = booking.to_public_dict()
    if state == "unpaid" and outcome.get("order_status") == "NOT_APPROVED":
        out["payment_message"] = "The payment wasn't approved at PayPal. You can try again."
    elif state == "failed":
        out["payment_message"] = "PayPal declined the payment. Try again or choose another way to pay."
    return jsonify(out)


# ---- bank transfer ----------------------------------------------------------------
@bookings_routes.get("/<reference>/payment")
def payment_details(reference):
    """What the guest needs to finish paying (bank details, or that PayPal can be retried)."""
    booking = _booking_or_404(reference)
    if booking.status != "pending":
        return jsonify({"method": booking.payment_method, "open": False})
    if booking.payment_method == "bank" and bank_transfer.enabled():
        return jsonify({"method": "bank", "open": True, "bank": bank_transfer.details(booking),
                        "claimed": booking.transfer_claimed_at is not None})
    return jsonify({"method": booking.payment_method, "open": True})


@bookings_routes.post("/<reference>/transfer-sent")
@limiter.limit("6 per hour")
def transfer_sent(reference):
    """The guest says the transfer is on its way: keep the dates while it arrives."""
    booking = _booking_or_404(reference)
    if booking.payment_method != "bank" or booking.status != "pending":
        return jsonify({"error": "This booking isn't waiting for a bank transfer"}), 409
    if not booking.transfer_claimed_at:
        booking.transfer_claimed_at = utcnow()
        booking.hold_expires_at = utcnow() + timedelta(days=current_app.config.get("BANK_CLAIM_HOLD_DAYS", 5))
        db.session.commit()
        _notify_host(booking, "transfer")
    return jsonify(booking.to_public_dict())

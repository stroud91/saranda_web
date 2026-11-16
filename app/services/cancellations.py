"""Cancelling a stay and paying back what the terms promise.

The rules live on the server, so the amount a guest is shown before they
cancel is the amount that is then owed:

- cancelled CANCEL_FULL_REFUND_DAYS or more before check-in: everything paid;
- cancelled CANCEL_PARTIAL_REFUND_DAYS or more before: CANCEL_PARTIAL_REFUND_PERCENT of it;
- later than that, or a no-show: nothing;
- cancelled by the host: always everything.

Cancelling frees the dates at once and records the refund as *due*. Money only
leaves the host's account when the host presses "send refund" in the Host desk
(PayPal and card refunds go through their APIs; bank transfers and cash are
paid back by hand and then marked as sent). A stay hosted by a partner business
was never paid through this site, so there is nothing for it to refund.
"""
from datetime import date
from decimal import Decimal

from flask import current_app

from app.models.booking import ACTIVE_STATUSES
from app.models.db import utcnow
from app.services import payments, paypal

CENT = Decimal("0.01")


class RefundError(Exception):
    """A refund could not be sent; the message is safe to show the host."""


def policy():
    cfg = current_app.config
    full = max(0, int(cfg.get("CANCEL_FULL_REFUND_DAYS", 14)))
    partial_days = min(full, max(0, int(cfg.get("CANCEL_PARTIAL_REFUND_DAYS", 7))))
    percent = min(100, max(0, int(cfg.get("CANCEL_PARTIAL_REFUND_PERCENT", 50))))
    return {"full_refund_days": full, "partial_refund_days": partial_days, "partial_refund_percent": percent}


def paid(booking):
    """What the guest has actually paid through the site, in the booking's currency (EUR)."""
    return Decimal(str(booking.due_now)) if booking.payment_status == "paid" else Decimal("0")


def is_partner(booking):
    return bool(booking.hotel and booking.hotel.business_id)


def can_cancel(booking, today=None):
    """A guest can cancel a booking that is still open, up to the day before check-in."""
    today = today or date.today()
    return booking.status in ACTIVE_STATUSES and booking.start_date.date() > today


def quote(booking, by="guest", today=None):
    """What cancelling now would mean. ``by`` is "guest" or "host"."""
    today = today or date.today()
    rules = policy()
    days = (booking.start_date.date() - today).days
    amount_paid = paid(booking)
    if by == "host" or days >= rules["full_refund_days"]:
        percent = 100
    elif rules["partial_refund_percent"] and days >= rules["partial_refund_days"]:
        percent = rules["partial_refund_percent"]
    else:
        percent = 0
    refund = (amount_paid * percent / 100).quantize(CENT)
    return {"can_cancel": can_cancel(booking, today) if by == "guest" else booking.status in ACTIVE_STATUSES,
            "days_before": days, "paid": float(amount_paid), "refund_percent": percent, "refund_amount": float(refund),
            "currency": booking.currency or "EUR", "partner": is_partner(booking), "policy": rules}


def cancel(booking, by="guest", today=None):
    """Cancel the booking and record what is owed back. Returns the quote that was applied.
    The caller commits and sends the e-mails."""
    applied = quote(booking, by, today)
    was_unpaid = booking.payment_status in ("unpaid", "awaiting_transfer", "processing", "failed", None)
    booking.status, booking.cancelled_at, booking.cancelled_by = "cancelled", utcnow(), by
    booking.hold_expires_at = None
    if applied["refund_amount"] > 0:
        booking.refund_amount, booking.refund_status = Decimal(str(applied["refund_amount"])), "due"
    else:
        booking.refund_amount, booking.refund_status = Decimal("0"), "none"
    if was_unpaid:
        booking.payment_status = "cancelled"
        if booking.stripe_payment_intent_id and payments.enabled():
            payments.cancel_intent(booking.stripe_payment_intent_id)  # an unfinished card payment can no longer complete
    return applied


def refund_methods(booking):
    """How this booking's refund can be sent: through the payment provider if it was paid that way, or by hand."""
    out = []
    if booking.payment_method == "paypal" and booking.payment_ref and paypal.enabled():
        out.append("paypal")
    if booking.payment_method == "card" and booking.stripe_payment_intent_id and payments.enabled():
        out.append("card")
    return out + ["manual"]


def send_refund(booking, method):
    """Send (or record) the refund that is due. Raises RefundError with a message for the host."""
    if booking.refund_status != "due" or not booking.refund_amount or booking.refund_amount <= 0:
        raise RefundError("No refund is due for this booking.")
    if method not in refund_methods(booking):
        raise RefundError("That way of refunding isn't available for this booking.")
    amount = Decimal(str(booking.refund_amount))
    whole = amount >= paid(booking)
    reference = None
    try:
        if method == "paypal":
            # The guest may have been charged in another currency: refund the same share of what was charged.
            charged = Decimal(str(booking.charge_amount or booking.due_now))
            share = charged if whole else (charged * amount / Decimal(str(booking.due_now))).quantize(CENT)
            reference = paypal.refund(booking.payment_ref, amount=share, currency_code=booking.charge_currency or "EUR",
                                      reference=booking.reference)["id"]
        elif method == "card":
            reference = payments.refund(booking.stripe_payment_intent_id, int(amount * 100), booking.reference)
    except payments.PaymentError as exc:
        raise RefundError(str(exc)) from None
    booking.refund_status, booking.refunded_at, booking.refund_ref = "refunded", utcnow(), (reference or method)[:64]
    booking.payment_status = "refunded" if whole else "partially_refunded"
    return booking

import logging

from flask import Blueprint, jsonify, request

from app.models import Booking, db
from app.services import payments, paypal

from .bookings_routes import apply_intent_status, apply_paypal_outcome

log = logging.getLogger(__name__)
webhook_routes = Blueprint("webhooks", __name__)

HANDLED = {"payment_intent.succeeded", "payment_intent.processing", "payment_intent.canceled"}


@webhook_routes.post("/stripe")
def stripe_webhook():
    """Signed Stripe events → booking status. Signature is always verified."""
    try:
        event = payments.parse_webhook(request.get_data(), request.headers.get("Stripe-Signature"))
    except payments.PaymentError as exc:
        return jsonify({"error": str(exc)}), 400
    if event["type"] in HANDLED:
        intent = event["data"]["object"]
        booking = Booking.query.filter_by(stripe_payment_intent_id=intent["id"]).first()
        if booking:
            apply_intent_status(booking, intent["status"])
            db.session.commit()
        else:
            log.info("stripe event for unknown intent")
    return jsonify({"received": True})


PAYPAL_REFERENCE = __import__("re").compile(r"^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$")


@webhook_routes.post("/paypal")
def paypal_webhook():
    """PayPal events → booking status. Every delivery is verified with PayPal first."""
    event = request.get_json(silent=True)
    if not isinstance(event, dict):
        return jsonify({"error": "Invalid payload"}), 400
    try:
        genuine = paypal.enabled() and paypal.verify_webhook(request.headers, event)
    except payments.PaymentError as exc:
        return jsonify({"error": str(exc)}), 400
    if not genuine:
        return jsonify({"error": "Invalid webhook signature"}), 400
    kind = event.get("event_type", "")
    resource = event.get("resource") if isinstance(event.get("resource"), dict) else {}
    reference = str(resource.get("custom_id") or resource.get("invoice_id") or "")
    if kind.startswith("PAYMENT.CAPTURE.") and PAYPAL_REFERENCE.match(reference):
        booking = Booking.query.filter_by(reference=reference, payment_method="paypal").first()
        if booking:
            amount = resource.get("amount") or {}
            if kind == "PAYMENT.CAPTURE.COMPLETED" and booking.status in ("pending", "expired", "confirmed"):
                apply_paypal_outcome(booking, {"capture_status": "COMPLETED", "reference": reference,
                                               "currency": amount.get("currency_code"), "amount": amount.get("value")})
            elif kind in ("PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.DECLINED") and booking.payment_status != "paid":
                booking.payment_status = "failed"
            elif kind in ("PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"):
                # A refund the host sent from the Host desk is already recorded (it may be partial).
                # Anything else was refunded on paypal.com: the host decides what happens to the stay.
                if booking.refund_status != "refunded":
                    booking.payment_status = "refunded"
            db.session.commit()
        else:
            log.info("paypal event for unknown booking")
    return jsonify({"received": True})

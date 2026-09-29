import logging

from flask import Blueprint, jsonify, request

from app.models import Booking, db
from app.services import payments

from .bookings_routes import apply_intent_status

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

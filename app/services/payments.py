"""Stripe integration. Amounts are always computed server-side."""
import logging

from flask import current_app

log = logging.getLogger(__name__)


class PaymentError(RuntimeError):
    pass


def enabled():
    return bool(current_app.config.get("STRIPE_SECRET_KEY"))


def _client():
    import stripe

    return stripe.StripeClient(current_app.config["STRIPE_SECRET_KEY"], max_network_retries=2)


def create_intent(amount_cents, *, reference, email, description):
    import stripe

    try:
        intent = _client().v1.payment_intents.create(params={
            "amount": int(amount_cents),
            "currency": "eur",
            "automatic_payment_methods": {"enabled": True},
            "receipt_email": email,
            "description": description[:200],
            "metadata": {"reference": reference},
        }, options={"idempotency_key": f"booking-{reference}"})
    except stripe.StripeError as exc:
        log.warning("stripe create failed: %s", exc.__class__.__name__)
        raise PaymentError(getattr(exc, "user_message", None) or "Payment provider error") from None
    return intent.id, intent.client_secret


def retrieve_status(intent_id):
    import stripe

    try:
        return _client().v1.payment_intents.retrieve(intent_id).status
    except stripe.StripeError:
        raise PaymentError("Could not verify payment status") from None


def cancel_intent(intent_id):
    import stripe

    try:
        _client().v1.payment_intents.cancel(intent_id)
    except stripe.StripeError:
        pass


def parse_webhook(payload, signature):
    import stripe

    secret = current_app.config.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise PaymentError("Webhook secret not configured")
    try:
        return stripe.Webhook.construct_event(payload, signature, secret)
    except (ValueError, stripe.SignatureVerificationError):
        raise PaymentError("Invalid webhook signature") from None

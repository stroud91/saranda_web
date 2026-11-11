"""PayPal Checkout (Orders v2) using the redirect flow.

Why a redirect: the guest approves the payment on paypal.com and comes back, so
no PayPal script ever runs on our pages (smaller attack surface, simpler CSP).
PayPal also offers card payment without a PayPal account on that page.

Trust model
- Amount and currency are computed here from the booking; the browser only
  ever receives a URL to PayPal.
- A booking is confirmed only after *this server* captures the order and
  PayPal's response shows a COMPLETED capture for the expected reference,
  amount and currency. Webhooks are verified with PayPal before use.
"""
import logging
import re
import threading
import time
from decimal import ROUND_HALF_UP, Decimal
from urllib.parse import urlparse

from flask import current_app

from . import upstream
from .payments import PaymentError

log = logging.getLogger(__name__)

BASES = {"live": "https://api-m.paypal.com", "sandbox": "https://api-m.sandbox.paypal.com"}
APPROVE_HOSTS = {"live": "www.paypal.com", "sandbox": "www.sandbox.paypal.com"}
ORDER_ID = re.compile(r"^[A-Z0-9]{8,32}$")
CURRENCIES = ("EUR", "USD")

_token = {}
_lock = threading.Lock()


def _env():
    return "live" if current_app.config.get("PAYPAL_ENV") == "live" else "sandbox"


def enabled():
    cfg = current_app.config
    return bool(cfg.get("PAYPAL_CLIENT_ID") and cfg.get("PAYPAL_CLIENT_SECRET")
                and cfg.get("PAYPAL_CURRENCY") in CURRENCIES)


def currency():
    return current_app.config.get("PAYPAL_CURRENCY", "EUR")


def _call(method, path, **kwargs):
    try:
        return upstream.call_api(method, BASES[_env()] + path, **kwargs)
    except upstream.UpstreamError as exc:
        log.warning("paypal unreachable: %s", exc)
        raise PaymentError("PayPal is not reachable right now. Please try again.") from None


def _access_token():
    cfg = current_app.config
    key = (_env(), cfg["PAYPAL_CLIENT_ID"])
    with _lock:
        hit = _token.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
    status, body = _call("POST", "/v1/oauth2/token", data={"grant_type": "client_credentials"},
                         auth=(cfg["PAYPAL_CLIENT_ID"], cfg["PAYPAL_CLIENT_SECRET"]))
    token = body.get("access_token")
    if status != 200 or not token:
        log.error("paypal auth failed (%s)", status)
        raise PaymentError("PayPal is not configured correctly")
    with _lock:
        _token[key] = (time.monotonic() + max(60, int(body.get("expires_in", 300)) - 120), token)
    return token


def _auth(extra=None):
    headers = {"Authorization": f"Bearer {_access_token()}", "Content-Type": "application/json"}
    headers.update(extra or {})
    return headers


def money(amount):
    return str(Decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def create_order(*, reference, amount, currency_code, description, return_url, cancel_url):
    """Create an order and return ``(order_id, approve_url)``."""
    status, body = _call("POST", "/v2/checkout/orders", headers=_auth({"PayPal-Request-Id": f"order-{reference}"}), json={
        "intent": "CAPTURE",
        "purchase_units": [{
            "reference_id": reference, "custom_id": reference, "invoice_id": reference,
            "description": description[:127],
            "amount": {"currency_code": currency_code, "value": money(amount)},
        }],
        "payment_source": {"paypal": {"experience_context": {
            "brand_name": "Meg'Rooms", "user_action": "PAY_NOW", "shipping_preference": "NO_SHIPPING",
            "landing_page": "NO_PREFERENCE", "return_url": return_url, "cancel_url": cancel_url,
        }}},
    })
    order_id = body.get("id", "")
    approve = next((link.get("href") for link in body.get("links", [])
                    if link.get("rel") in ("payer-action", "approve")), None)
    if status not in (200, 201) or not ORDER_ID.match(order_id) or not approve:
        log.warning("paypal create order failed (%s %s)", status, body.get("name"))
        raise PaymentError("PayPal could not start the payment. Please try again or choose another method.")
    parsed = urlparse(approve)
    if parsed.scheme != "https" or parsed.hostname != APPROVE_HOSTS[_env()]:
        raise PaymentError("PayPal returned an unexpected address")  # never redirect guests elsewhere
    return order_id, approve


def _outcome(order):
    """Normalise an order into what we need to decide: status, reference, amount, currency."""
    unit = (order.get("purchase_units") or [{}])[0]
    captures = ((unit.get("payments") or {}).get("captures") or [])
    cap = captures[0] if captures else {}
    amount = cap.get("amount") or unit.get("amount") or {}
    return {
        "order_status": order.get("status"),
        "capture_status": cap.get("status"),
        "capture_id": cap.get("id"),
        "reference": cap.get("custom_id") or unit.get("custom_id") or unit.get("reference_id"),
        "currency": amount.get("currency_code"),
        "amount": amount.get("value"),
    }


def get_order(order_id):
    if not ORDER_ID.match(order_id or ""):
        raise PaymentError("Unknown PayPal order")
    status, body = _call("GET", f"/v2/checkout/orders/{order_id}", headers=_auth())
    if status != 200:
        raise PaymentError("Could not check the PayPal payment")
    return _outcome(body)


def capture(order_id, reference):
    """Capture an approved order (idempotent) and return its outcome."""
    if not ORDER_ID.match(order_id or ""):
        raise PaymentError("Unknown PayPal order")
    status, body = _call("POST", f"/v2/checkout/orders/{order_id}/capture",
                         headers=_auth({"PayPal-Request-Id": f"capture-{reference}", "Prefer": "return=representation"}),
                         json={})
    if status in (200, 201):
        return _outcome(body)
    issues = {d.get("issue") for d in body.get("details", []) if isinstance(d, dict)}
    if "ORDER_ALREADY_CAPTURED" in issues:
        return get_order(order_id)
    if "ORDER_NOT_APPROVED" in issues or "PAYER_ACTION_REQUIRED" in issues:
        return {"order_status": "NOT_APPROVED", "capture_status": None}
    if "INSTRUMENT_DECLINED" in issues:
        return {"order_status": "DECLINED", "capture_status": "DECLINED"}
    log.warning("paypal capture failed (%s %s %s)", status, body.get("name"), sorted(i for i in issues if i))
    raise PaymentError("PayPal could not complete the payment")


def paid_in_full(outcome, *, reference, amount, currency_code):
    """True only for a completed capture of exactly the expected booking, amount and currency."""
    try:
        got = Decimal(str(outcome.get("amount")))
    except Exception:
        return False
    return (outcome.get("capture_status") == "COMPLETED" and outcome.get("reference") == reference
            and outcome.get("currency") == currency_code and got == Decimal(money(amount)))


def verify_webhook(headers, event):
    """Ask PayPal whether a webhook delivery is genuine (never trust it otherwise)."""
    webhook_id = current_app.config.get("PAYPAL_WEBHOOK_ID")
    if not webhook_id:
        raise PaymentError("PayPal webhook is not configured")
    needed = {"auth_algo": "Paypal-Auth-Algo", "cert_url": "Paypal-Cert-Url", "transmission_id": "Paypal-Transmission-Id",
              "transmission_sig": "Paypal-Transmission-Sig", "transmission_time": "Paypal-Transmission-Time"}
    payload = {k: headers.get(h, "") for k, h in needed.items()}
    if not all(payload.values()):
        return False
    payload.update({"webhook_id": webhook_id, "webhook_event": event})
    status, body = _call("POST", "/v1/notifications/verify-webhook-signature", headers=_auth(), json=payload)
    return status == 200 and body.get("verification_status") == "SUCCESS"

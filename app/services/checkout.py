"""Which ways to pay are switched on, and how much is charged for each.

Methods (in the order offered):
- ``paypal``  PayPal balance or card via PayPal; works for accounts in Albania.
- ``card``    Stripe (only for businesses in Stripe-supported countries).
- ``bank``    Bank transfer (SEPA / SWIFT); the host confirms on receipt.
- ``request`` Request to book and pay on arrival — offered when nothing else is.
"""
from decimal import ROUND_HALF_UP, Decimal

from flask import current_app

from . import bank_transfer, live, paypal, payments
from .payments import PaymentError

CENT = Decimal("0.01")


def deposit_percent():
    return min(100, max(1, int(current_app.config.get("PAYMENT_DEPOSIT_PERCENT") or 100)))


def due_now(total):
    """Amount (EUR) paid when booking: the deposit, or everything when it's 100 %."""
    return (Decimal(total) * deposit_percent() / 100).quantize(CENT, rounding=ROUND_HALF_UP)


def methods():
    out = []
    if paypal.enabled():
        out.append({"id": "paypal", "label": "PayPal or card", "currency": paypal.currency(),
                    "note": "Pay with your PayPal balance, or by card as a PayPal guest."})
    if payments.enabled():
        out.append({"id": "card", "label": "Card", "currency": "EUR", "note": "Visa, Mastercard, Amex and wallets."})
    if bank_transfer.enabled():
        out.append({"id": "bank", "label": "Bank transfer", "currency": "EUR",
                    "note": "SEPA transfer from any European bank, or SWIFT from elsewhere."})
    if not out:
        out.append({"id": "request", "label": "Request to book", "currency": "EUR",
                    "note": "The host confirms your dates; you pay on arrival."})
    return out


def method_ids():
    return [m["id"] for m in methods()]


def paypal_charge(amount_eur):
    """``(currency, amount)`` PayPal should charge for an amount in EUR.

    Prices are in EUR. A PayPal account that only settles in USD charges the
    USD equivalent at the day's rate (plus an optional margin for PayPal's own
    conversion and fees). Without a trustworthy rate we refuse rather than
    charge a wrong amount.
    """
    code = paypal.currency()
    if code == "EUR":
        return "EUR", Decimal(amount_eur).quantize(CENT, rounding=ROUND_HALF_UP)
    fx = live.fx_rates() if current_app.config.get("LIVE_DATA_ENABLED") else {"live": False, "rates": {}}
    rate = current_app.config.get("PAYPAL_EUR_USD_RATE") or (fx["rates"].get("USD") if fx.get("live") else None)
    if not rate:
        raise PaymentError("PayPal is temporarily unavailable (no exchange rate). Please choose another method.")
    margin = 1 + Decimal(str(current_app.config.get("PAYPAL_FX_MARGIN_PERCENT") or 0)) / 100
    return code, (Decimal(amount_eur) * Decimal(str(rate)) * margin).quantize(CENT, rounding=ROUND_HALF_UP)

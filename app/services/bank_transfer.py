"""Pay by bank transfer to the business account (SEPA from Europe, SWIFT elsewhere).

The guest sees the account details, the exact amount and a payment reference,
plus an EPC "SEPA QR" code that most European banking apps can scan to fill the
transfer in. The host confirms the booking once the money has arrived.
"""
import logging
import re

from flask import current_app

log = logging.getLogger(__name__)

_IBAN = re.compile(r"^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$")
_BIC = re.compile(r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$")


def normalise_iban(value):
    return re.sub(r"\s+", "", value or "").upper()


def valid_iban(value):
    """ISO 13616 mod-97 check: catches typos before guests are asked to pay."""
    iban = normalise_iban(value)
    if not _IBAN.match(iban):
        return False
    rearranged = iban[4:] + iban[:4]
    digits = "".join(str(int(ch, 36)) for ch in rearranged)
    return int(digits) % 97 == 1


def enabled():
    cfg = current_app.config
    return bool(cfg.get("BANK_BENEFICIARY")) and valid_iban(cfg.get("BANK_IBAN"))


def _qr(name, iban, bic, amount, reference):
    try:
        from segno import helpers

        qr = helpers.make_epc_qr(name=name[:70], iban=iban, amount=float(amount), text=reference,
                                 bic=bic or None, encoding="utf-8")
        return qr.svg_data_uri(scale=5, border=2, dark="#041f2e", light="#ffffff")
    except Exception as exc:  # QR is a convenience; the details below it are what matters
        log.warning("EPC QR failed: %s", exc.__class__.__name__)
        return None


def details(booking):
    cfg = current_app.config
    iban = normalise_iban(cfg["BANK_IBAN"])
    bic = (cfg.get("BANK_BIC") or "").replace(" ", "").upper()
    bic = bic if _BIC.match(bic) else ""
    amount = booking.due_now
    return {
        "beneficiary": cfg["BANK_BENEFICIARY"],
        "iban": " ".join(iban[i:i + 4] for i in range(0, len(iban), 4)),
        "bic": bic,
        "bank": cfg.get("BANK_NAME") or "",
        "amount": float(amount),
        "currency": "EUR",
        "reference": booking.reference,
        "qr": _qr(cfg["BANK_BENEFICIARY"], iban, bic, amount, booking.reference),
        "hold_hours": cfg.get("BANK_HOLD_HOURS", 48),
    }

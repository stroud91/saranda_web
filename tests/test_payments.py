"""Payments for an Albania-based business: PayPal (redirect + server-side
capture + verified webhooks), bank transfer with host confirmation, deposits."""
from datetime import timedelta
from decimal import Decimal

import pytest

from app.extensions import db
from app.models import Booking
from app.models.db import utcnow
from app.services import bank_transfer, mailer, paypal, upstream

IBAN = "AL47212110090000000235698741"  # example from the IBAN registry
BANK = {"BANK_IBAN": IBAN, "BANK_BIC": "SGSBALTX", "BANK_BENEFICIARY": "Meg Rooms SHPK", "BANK_NAME": "Example Bank"}
PAYPAL = {"PAYPAL_CLIENT_ID": "client", "PAYPAL_CLIENT_SECRET": "secret", "PAYPAL_ENV": "sandbox",
          "PAYPAL_WEBHOOK_ID": "WH-1", "PAYPAL_CURRENCY": "EUR"}


class FakePayPal:
    """Stands in for api-m.sandbox.paypal.com."""

    def __init__(self):
        self.calls, self.orders = [], {}
        self.capture_status = "COMPLETED"
        self.capture_amount = None      # override to simulate a mismatch
        self.approved = True
        self.approve_host = "www.sandbox.paypal.com"
        self.webhook_ok = True

    def __call__(self, method, url, *, json=None, data=None, headers=None, auth=None, timeout=None):
        upstream._check_url(url)        # the real allowlist still applies
        path = url.split("paypal.com", 1)[1]
        self.calls.append((method, path))
        if path == "/v1/oauth2/token":
            assert auth == ("client", "secret") and data == {"grant_type": "client_credentials"}
            return 200, {"access_token": "tok", "expires_in": 3600}
        assert headers["Authorization"] == "Bearer tok"
        if path == "/v2/checkout/orders":
            unit = json["purchase_units"][0]
            order_id = "ORDER" + unit["custom_id"].replace("-", "")
            self.orders[order_id] = {"unit": unit, "ctx": json["payment_source"]["paypal"]["experience_context"]}
            return 201, {"id": order_id, "status": "PAYER_ACTION_REQUIRED",
                         "links": [{"rel": "payer-action", "href": f"https://{self.approve_host}/checkoutnow?token={order_id}"}]}
        if path.endswith("/capture"):
            order_id = path.split("/")[-2]
            if not self.approved:
                return 422, {"name": "UNPROCESSABLE_ENTITY", "details": [{"issue": "ORDER_NOT_APPROVED"}]}
            unit = self.orders[order_id]["unit"]
            amount = dict(unit["amount"])
            if self.capture_amount:
                amount["value"] = self.capture_amount
            return 201, {"id": order_id, "status": "COMPLETED", "purchase_units": [{
                "reference_id": unit["reference_id"],
                "payments": {"captures": [{"id": "CAP1", "status": self.capture_status, "amount": amount,
                                           "custom_id": unit["custom_id"]}]}}]}
        if path == "/v1/notifications/verify-webhook-signature":
            assert json["webhook_id"] == "WH-1"
            return 200, {"verification_status": "SUCCESS" if self.webhook_ok else "FAILURE"}
        raise AssertionError(f"unexpected PayPal call {method} {path}")


@pytest.fixture()
def fake_paypal(app, monkeypatch):
    app.config.update(PAYPAL)
    fake = FakePayPal()
    monkeypatch.setattr(upstream, "call_api", fake)
    paypal._token.clear()
    mailer.outbox.clear()
    return fake


def stay(client):
    return client.get("/api/hotels/").get_json()[0]


def book(client, method=None, start="2031-06-10", end="2031-06-13", expect=201):
    body = {"hotel_id": stay(client)["id"], "start_date": start, "end_date": end, "guest_count": 2,
            "guest_name": "Ana Dervishi", "guest_email": "ana@example.com"}
    if method:
        body["payment_method"] = method
    r = client.post("/api/bookings/", json=body)
    assert r.status_code == expect, r.get_json()
    return r.get_json()


# ---- what is offered -----------------------------------------------------------------
def test_request_to_book_is_the_fallback(client):
    cfg = client.get("/api/meta/config").get_json()["payments"]
    assert [m["id"] for m in cfg["methods"]] == ["request"] and cfg["deposit_percent"] == 100
    out = book(client)
    assert out["booking"]["status"] == "requested" and out["payment"] == {"method": "request"}


def test_configured_methods_are_offered_in_order(client, app, fake_paypal):
    app.config.update(BANK)
    assert [m["id"] for m in client.get("/api/meta/config").get_json()["payments"]["methods"]] == ["paypal", "bank"]
    assert book(client, "card", expect=400)["fields"]["payment_method"]          # Stripe is not switched on
    assert book(client, "request", expect=400)["fields"]["payment_method"]       # payment is required now


def test_iban_check():
    assert bank_transfer.valid_iban("AL47 2121 1009 0000 0002 3569 8741")
    assert bank_transfer.valid_iban("DE89370400440532013000")
    assert not bank_transfer.valid_iban("AL47212110090000000235698742")       # one digit off
    assert not bank_transfer.valid_iban("not an iban")


# ---- PayPal -------------------------------------------------------------------------------
def test_paypal_happy_path(client, app, fake_paypal):
    out = book(client, "paypal")
    ref = out["booking"]["reference"]
    total = out["booking"]["total_cost"]
    assert out["booking"]["status"] == "pending" and out["booking"]["payment_method"] == "paypal"
    assert out["payment"]["approve_url"].startswith("https://www.sandbox.paypal.com/checkoutnow?token=")
    order = next(iter(fake_paypal.orders.values()))
    assert order["unit"]["amount"] == {"currency_code": "EUR", "value": f"{total:.2f}"}   # server-side amount
    assert order["ctx"]["return_url"] == f"https://megrooms.test/booking/{ref}?paypal=return"
    assert order["ctx"]["shipping_preference"] == "NO_SHIPPING"

    done = client.post(f"/api/bookings/{ref}/paypal/capture", json={})
    assert done.status_code == 200
    assert done.get_json()["status"] == "confirmed" and done.get_json()["payment_status"] == "paid"
    subjects = [m["subject"] for m in mailer.outbox]
    assert f"Booking confirmed: {ref}" in subjects and f"Booking paid: {ref}" in subjects
    # Asking again is harmless and doesn't capture twice.
    before = len(fake_paypal.calls)
    assert client.post(f"/api/bookings/{ref}/paypal/capture", json={}).get_json()["status"] == "confirmed"
    assert len(fake_paypal.calls) == before


def test_paypal_amount_mismatch_is_never_confirmed(client, fake_paypal):
    ref = book(client, "paypal")["booking"]["reference"]
    fake_paypal.capture_amount = "1.00"
    out = client.post(f"/api/bookings/{ref}/paypal/capture", json={}).get_json()
    assert out["status"] == "pending" and out["payment_status"] == "review"


def test_paypal_not_approved_keeps_the_booking_open(client, fake_paypal):
    ref = book(client, "paypal")["booking"]["reference"]
    fake_paypal.approved = False
    out = client.post(f"/api/bookings/{ref}/paypal/capture", json={}).get_json()
    assert out["status"] == "pending" and "try again" in out["payment_message"]
    fake_paypal.approved = True
    again = client.post(f"/api/bookings/{ref}/paypal/start", json={})
    assert again.status_code == 200 and "sandbox.paypal.com" in again.get_json()["approve_url"]


def test_paypal_pending_capture_holds_the_dates(client, app, fake_paypal):
    ref = book(client, "paypal")["booking"]["reference"]
    fake_paypal.capture_status = "PENDING"
    out = client.post(f"/api/bookings/{ref}/paypal/capture", json={}).get_json()
    assert out["status"] == "pending" and out["payment_status"] == "processing"
    with app.app_context():
        assert Booking.query.one().hold_expires_at > utcnow() + timedelta(hours=48)


def test_expired_hold_with_dates_taken_is_not_charged(client, app, fake_paypal):
    ref = book(client, "paypal")["booking"]["reference"]
    with app.app_context():
        b = Booking.query.filter_by(reference=ref).one()
        b.hold_expires_at = utcnow() - timedelta(minutes=1)            # the guest dawdled at PayPal
        db.session.commit()
    book(client, "paypal")                                             # someone else takes the dates
    calls = len(fake_paypal.calls)
    r = client.post(f"/api/bookings/{ref}/paypal/capture", json={})
    assert r.status_code == 409 and "not been charged" in r.get_json()["error"]
    assert not any(path.endswith("/capture") for _, path in fake_paypal.calls[calls:])


def test_expired_hold_with_free_dates_can_still_be_paid(client, app, fake_paypal):
    ref = book(client, "paypal")["booking"]["reference"]
    with app.app_context():
        Booking.query.filter_by(reference=ref).one().hold_expires_at = utcnow() - timedelta(minutes=1)
        db.session.commit()
    assert client.post(f"/api/bookings/{ref}/paypal/capture", json={}).get_json()["status"] == "confirmed"


def test_paypal_usd_conversion_and_margin(client, app, fake_paypal):
    app.config.update(PAYPAL_CURRENCY="USD", PAYPAL_EUR_USD_RATE=1.10, PAYPAL_FX_MARGIN_PERCENT=4)
    out = book(client, "paypal")
    eur = Decimal(str(out["booking"]["total_cost"]))
    expected = (eur * Decimal("1.10") * Decimal("1.04")).quantize(Decimal("0.01"))
    order = next(iter(fake_paypal.orders.values()))
    assert order["unit"]["amount"] == {"currency_code": "USD", "value": str(expected)}
    assert out["booking"]["charge_currency"] == "USD" and Decimal(str(out["booking"]["charge_amount"])) == expected
    ref = out["booking"]["reference"]
    assert client.post(f"/api/bookings/{ref}/paypal/capture", json={}).get_json()["status"] == "confirmed"


def test_paypal_usd_without_a_rate_refuses_instead_of_guessing(client, app, fake_paypal):
    app.config.update(PAYPAL_CURRENCY="USD", PAYPAL_EUR_USD_RATE=None)
    out = book(client, "paypal", expect=502)
    assert "exchange rate" in out["error"]
    with app.app_context():
        assert Booking.query.count() == 0                               # nothing half-created


def test_guest_is_never_redirected_off_paypal(client, app, fake_paypal):
    fake_paypal.approve_host = "www.paypa1-login.example"
    book(client, "paypal", expect=502)
    with app.app_context():
        assert Booking.query.count() == 0


def test_paypal_calls_stay_on_the_allowlist():
    with pytest.raises(upstream.UpstreamError):
        upstream.call_api("GET", "https://api-m.paypal.com.evil.example/v2/checkout/orders/X")
    with pytest.raises(upstream.UpstreamError):
        upstream.call_api("GET", "http://api-m.paypal.com/v2/checkout/orders/X")


# ---- PayPal webhooks ----------------------------------------------------------------------
def _event(kind, ref, value, currency="EUR"):
    return {"event_type": kind, "resource": {"id": "CAP1", "status": "COMPLETED", "custom_id": ref,
                                             "amount": {"currency_code": currency, "value": value}}}


HEADERS = {"Paypal-Auth-Algo": "SHA256withRSA", "Paypal-Cert-Url": "https://api.paypal.com/cert",
           "Paypal-Transmission-Id": "t1", "Paypal-Transmission-Sig": "sig", "Paypal-Transmission-Time": "now"}


def test_webhook_confirms_only_when_paypal_vouches_for_it(client, fake_paypal):
    out = book(client, "paypal")
    ref, total = out["booking"]["reference"], f"{out['booking']['total_cost']:.2f}"
    event = _event("PAYMENT.CAPTURE.COMPLETED", ref, total)
    assert client.post("/api/webhooks/paypal", json=event).status_code == 400            # no signature headers
    fake_paypal.webhook_ok = False
    assert client.post("/api/webhooks/paypal", json=event, headers=HEADERS).status_code == 400
    assert client.get(f"/api/bookings/{ref}").get_json()["status"] == "pending"
    fake_paypal.webhook_ok = True
    wrong = client.post("/api/webhooks/paypal", json=_event("PAYMENT.CAPTURE.COMPLETED", ref, "1.00"), headers=HEADERS)
    assert wrong.status_code == 200 and client.get(f"/api/bookings/{ref}").get_json()["payment_status"] == "review"
    assert client.post("/api/webhooks/paypal", json=event, headers=HEADERS).status_code == 200
    assert client.get(f"/api/bookings/{ref}").get_json()["status"] == "confirmed"
    refund = client.post("/api/webhooks/paypal", json=_event("PAYMENT.CAPTURE.REFUNDED", ref, total), headers=HEADERS)
    assert refund.status_code == 200 and client.get(f"/api/bookings/{ref}").get_json()["payment_status"] == "refunded"


def test_webhook_is_exempt_from_browser_origin_checks(client, fake_paypal):
    r = client.post("/api/webhooks/paypal", json=_event("PAYMENT.CAPTURE.COMPLETED", "AAAA-BBBB-CCCC", "1.00"),
                    headers={**HEADERS, "Origin": "https://www.paypal.com"})
    assert r.status_code == 200


# ---- bank transfer -------------------------------------------------------------------------
def test_bank_transfer_flow_with_host_confirmation(client, app, admin):
    app.config.update(BANK)
    mailer.outbox.clear()
    out = book(client, "bank")
    ref = out["booking"]["reference"]
    assert out["booking"]["status"] == "pending" and out["booking"]["payment_status"] == "awaiting_transfer"
    with app.app_context():
        hold = Booking.query.one().hold_expires_at
        assert utcnow() + timedelta(hours=47) < hold < utcnow() + timedelta(hours=49)

    pay = client.get(f"/api/bookings/{ref}/payment").get_json()
    assert pay["open"] is True and pay["claimed"] is False
    bank = pay["bank"]
    assert bank["iban"] == "AL47 2121 1009 0000 0002 3569 8741" and bank["bic"] == "SGSBALTX"
    assert bank["reference"] == ref and bank["amount"] == out["booking"]["total_cost"] and bank["currency"] == "EUR"
    assert bank["qr"].startswith("data:image/svg+xml")

    sent = client.post(f"/api/bookings/{ref}/transfer-sent", json={}).get_json()
    assert sent["transfer_claimed"] is True
    with app.app_context():
        assert Booking.query.one().hold_expires_at > utcnow() + timedelta(days=4)
    assert any("bank transfer was sent" in m["subject"] for m in mailer.outbox)

    assert client.patch(f"/api/admin/bookings/{ref}", json={"paid": True}).status_code == 401   # guests can't
    host = client.patch(f"/api/admin/bookings/{ref}", json={"paid": True}, headers=admin)
    assert host.status_code == 200 and host.get_json()["status"] == "confirmed"
    assert host.get_json()["payment_status"] == "paid" and host.get_json()["paid_at"]
    assert any(m["subject"] == f"Booking confirmed: {ref}" and m["to"] == "ana@example.com" for m in mailer.outbox)
    assert client.get(f"/api/bookings/{ref}/payment").get_json()["open"] is False


def test_bank_transfer_disabled_by_a_mistyped_iban(client, app):
    app.config.update({**BANK, "BANK_IBAN": IBAN[:-1] + "2"})
    assert [m["id"] for m in client.get("/api/meta/config").get_json()["payments"]["methods"]] == ["request"]


def test_deposit_percentage(client, app):
    app.config.update(BANK, PAYMENT_DEPOSIT_PERCENT=30)
    out = book(client, "bank")["booking"]
    total = Decimal(str(out["total_cost"]))
    due = (total * 30 / 100).quantize(Decimal("0.01"))
    assert Decimal(str(out["amount_due"])) == due and Decimal(str(out["balance_on_arrival"])) == total - due
    pay = client.get(f"/api/bookings/{out['reference']}/payment").get_json()
    assert Decimal(str(pay["bank"]["amount"])) == due


def test_host_can_cancel_an_unpaid_transfer(client, app, admin):
    app.config.update(BANK)
    ref = book(client, "bank")["booking"]["reference"]
    r = client.patch(f"/api/admin/bookings/{ref}", json={"status": "cancelled"}, headers=admin)
    assert r.get_json()["status"] == "cancelled" and r.get_json()["payment_status"] == "cancelled"
    book(client, "bank")                                               # the dates are free again

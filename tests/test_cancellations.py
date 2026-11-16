"""Cancelling a stay: what the guest may do, what is owed back, and how the host sends it."""
from datetime import date, timedelta

import pytest

from app.extensions import db
from app.models import Booking
from app.services import cancellations, mailer
from tests.test_partners import HOST, STAY, account, approve, make_business
from tests.test_payments import BANK, HEADERS, _event, book, fake_paypal  # noqa: F401  (fake_paypal is a fixture)

EMAIL = {"email": "ana@example.com"}


def iso(days):
    return (date.today() + timedelta(days=days)).isoformat()


def paid_booking(client, days_ahead, nights=3):
    """A stay paid in full through PayPal, starting ``days_ahead`` days from now."""
    out = book(client, "paypal", iso(days_ahead), iso(days_ahead + nights))
    ref = out["booking"]["reference"]
    assert client.post(f"/api/bookings/{ref}/paypal/capture", json={}).get_json()["payment_status"] == "paid"
    mailer.outbox.clear()
    return ref, out["booking"]["total_cost"]


@pytest.fixture()
def host(app):
    return account(app, HOST)


def test_the_rules_are_published_and_a_guest_sees_what_cancelling_means(app, client, fake_paypal):
    assert client.get("/api/meta/config").get_json()["cancellation"] == {"full_refund_days": 14, "partial_refund_days": 7, "partial_refund_percent": 50}
    for days, percent in ((30, 100), (14, 100), (13, 50), (7, 50), (6, 0), (1, 0)):
        ref, total = paid_booking(client, days)
        quote = client.get(f"/api/bookings/{ref}/cancellation").get_json()
        assert (quote["can_cancel"], quote["days_before"], quote["refund_percent"]) == (True, days, percent), days
        assert quote["paid"] == total and quote["refund_amount"] == round(total * percent / 100, 2)
        Booking.query.filter_by(reference=ref).delete()
        db.session.commit()
    # The host can change the rules; nothing in between when the partial refund is switched off.
    app.config.update(CANCEL_FULL_REFUND_DAYS=30, CANCEL_PARTIAL_REFUND_PERCENT=0)
    ref, _ = paid_booking(client, 20)
    assert client.get(f"/api/bookings/{ref}/cancellation").get_json()["refund_percent"] == 0
    assert client.get("/api/bookings/NOPE-NOPE-NOPE/cancellation").status_code == 404


def test_guest_cancels_an_unpaid_request_and_the_dates_are_free_again(app, client):
    app.config.update(SMTP_HOST="smtp.test", SMTP_FROM="bookings@megrooms.test")
    out = book(client, None, iso(20), iso(23))
    ref = out["booking"]["reference"]
    assert out["booking"]["can_cancel"] is True
    book(client, None, iso(20), iso(23), expect=409)  # taken
    mailer.outbox.clear()
    # The link alone is not enough: the booking's e-mail address is asked for.
    for attempt in ({}, {"email": "someone@else.example"}, {"email": "not-an-email"}):
        r = client.post(f"/api/bookings/{ref}/cancel", json=attempt)
        assert r.status_code in (400, 403), attempt
    assert client.get(f"/api/bookings/{ref}").get_json()["status"] == "requested"
    done = client.post(f"/api/bookings/{ref}/cancel", json={"email": "ANA@example.com "})
    assert done.status_code == 200, done.get_json()
    b = done.get_json()
    assert (b["status"], b["payment_status"], b["refund_status"], b["refund_amount"], b["cancelled_by"], b["can_cancel"]) == ("cancelled", "cancelled", "none", 0.0, "guest", False)
    subjects = {(m["to"], m["subject"]) for m in mailer.outbox}
    assert ("ana@example.com", f"Booking cancelled: {ref}") in subjects
    assert any("Booking cancelled by the guest" in s for _, s in subjects)
    assert "Nothing was charged." in next(m["text"] for m in mailer.outbox if m["to"] == "ana@example.com")
    assert client.post(f"/api/bookings/{ref}/cancel", json=EMAIL).status_code == 409  # already cancelled
    book(client, None, iso(20), iso(23))  # the dates can be booked again


def test_a_stay_that_has_started_cannot_be_cancelled_online(app, client):
    from app.models.db import utcnow

    for start_in in (0, -1):
        b = Booking(hotel_id=1, start_date=utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=start_in),
                    end_date=utcnow() + timedelta(days=start_in + 3), nights=3, total_cost=195, status="confirmed", payment_status="paid",
                    guest_name="Ana Dervishi", guest_email="ana@example.com", guest_count=2, payment_method="request")
        db.session.add(b)
        db.session.commit()
        assert client.get(f"/api/bookings/{b.reference}/cancellation").get_json()["can_cancel"] is False
        assert client.post(f"/api/bookings/{b.reference}/cancel", json=EMAIL).status_code == 409
        assert db.session.get(Booking, b.id).status == "confirmed"


def test_full_refund_goes_back_through_paypal_when_the_host_sends_it(app, client, host, fake_paypal):
    ref, total = paid_booking(client, 20)
    cancelled = client.post(f"/api/bookings/{ref}/cancel", json=EMAIL).get_json()
    assert (cancelled["status"], cancelled["payment_status"], cancelled["refund_status"], cancelled["refund_amount"]) == ("cancelled", "paid", "due", total)
    assert f"Refund: EUR {total:.2f}" in next(m["text"] for m in mailer.outbox if m["to"] == "ana@example.com")
    assert any("A refund of EUR" in m["text"] and "Booking cancelled by the guest" in m["subject"] for m in mailer.outbox)
    assert fake_paypal.refunds == []  # no money moves until the host says so
    row = next(b for b in host.get("/api/admin/bookings").get_json() if b["reference"] == ref)
    assert row["refund_methods"] == ["paypal", "manual"]
    # Guests can't send themselves a refund.
    assert client.post(f"/api/admin/bookings/{ref}/refund", json={"method": "paypal"}).status_code == 401
    assert account(app, "eve@example.test").post(f"/api/admin/bookings/{ref}/refund", json={"method": "manual"}).status_code == 403
    mailer.outbox.clear()
    sent = host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "paypal"})
    assert sent.status_code == 200, sent.get_json()
    assert (sent.get_json()["refund_status"], sent.get_json()["payment_status"], sent.get_json()["refund_methods"]) == ("refunded", "refunded", [])
    assert fake_paypal.refunds == [{"amount": {"value": f"{total:.2f}", "currency_code": "EUR"}, "request_id": f"refund-{ref}"}]
    assert any(m["subject"] == f"Refund sent: {ref}" and m["to"] == "ana@example.com" for m in mailer.outbox)
    # A second press does nothing.
    assert host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "paypal"}).status_code == 409 and len(fake_paypal.refunds) == 1
    # PayPal's own "refunded" notice afterwards changes nothing.
    assert client.post("/api/webhooks/paypal", json=_event("PAYMENT.CAPTURE.REFUNDED", ref, total), headers=HEADERS).status_code == 200
    assert client.get(f"/api/bookings/{ref}").get_json()["payment_status"] == "refunded"


def test_partial_and_no_refund_follow_the_terms(app, client, host, fake_paypal):
    ref, total = paid_booking(client, 10)
    half = round(total / 2, 2)
    assert client.post(f"/api/bookings/{ref}/cancel", json=EMAIL).get_json()["refund_amount"] == half
    done = host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "paypal"}).get_json()
    assert done["payment_status"] == "partially_refunded" and fake_paypal.refunds[-1]["amount"]["value"] == f"{half:.2f}"
    assert client.post("/api/webhooks/paypal", json=_event("PAYMENT.CAPTURE.REFUNDED", ref, half), headers=HEADERS).status_code == 200
    assert client.get(f"/api/bookings/{ref}").get_json()["payment_status"] == "partially_refunded"

    late, _ = paid_booking(client, 3)
    gone = client.post(f"/api/bookings/{late}/cancel", json=EMAIL).get_json()
    assert (gone["refund_status"], gone["refund_amount"], gone["payment_status"]) == ("none", 0.0, "paid")
    assert "no refund is due" in next(m["text"] for m in mailer.outbox if m["to"] == "ana@example.com")
    assert host.post(f"/api/admin/bookings/{late}/refund", json={"method": "manual"}).status_code == 409
    assert len(fake_paypal.refunds) == 1


def test_when_the_host_cancels_everything_paid_is_owed_back(app, client, host, fake_paypal):
    ref, total = paid_booking(client, 2)  # two days before check-in: a guest would get nothing
    r = host.patch(f"/api/admin/bookings/{ref}", json={"status": "cancelled"})
    assert r.status_code == 200 and (r.get_json()["refund_status"], r.get_json()["refund_amount"], r.get_json()["cancelled_by"]) == ("due", total, "host")
    assert f"Refund: EUR {total:.2f}" in next(m["text"] for m in mailer.outbox if m["subject"] == f"Booking cancelled: {ref}")
    # If PayPal can't send it, the refund stays due and the host is told what to do.
    fake_paypal.refund_fails = True
    failed = host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "paypal"})
    assert failed.status_code == 409 and "PayPal could not send the refund" in failed.get_json()["error"]
    assert client.get(f"/api/bookings/{ref}").get_json()["refund_status"] == "due"
    fake_paypal.refund_fails = False
    assert host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "paypal"}).get_json()["refund_status"] == "refunded"


def test_a_refund_in_another_currency_keeps_the_same_share(app, client, host, fake_paypal):
    app.config.update(PAYPAL_CURRENCY="USD", PAYPAL_EUR_USD_RATE=1.10)
    ref, total = paid_booking(client, 10)
    charged = float(db.session.query(Booking).filter_by(reference=ref).one().charge_amount)
    client.post(f"/api/bookings/{ref}/cancel", json=EMAIL)
    host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "paypal"})
    assert fake_paypal.refunds[-1]["amount"] == {"value": f"{round(charged / 2, 2):.2f}", "currency_code": "USD"}
    assert client.get(f"/api/bookings/{ref}").get_json()["refund_amount"] == round(total / 2, 2)  # shown to the guest in EUR


def test_bank_transfer_refunds_are_paid_back_by_hand(app, client, host):
    app.config.update(BANK)
    ref = book(client, "bank", iso(25), iso(28))["booking"]["reference"]
    # Cancelled before the money arrived: nothing to refund.
    early = client.post(f"/api/bookings/{ref}/cancel", json=EMAIL).get_json()
    assert (early["payment_status"], early["refund_status"]) == ("cancelled", "none")
    ref = book(client, "bank", iso(25), iso(28))["booking"]["reference"]
    total = host.patch(f"/api/admin/bookings/{ref}", json={"paid": True}).get_json()["total_cost"]
    assert client.post(f"/api/bookings/{ref}/cancel", json=EMAIL).get_json()["refund_amount"] == total
    row = next(b for b in host.get("/api/admin/bookings").get_json() if b["reference"] == ref)
    assert row["refund_methods"] == ["manual"]
    assert host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "paypal"}).status_code == 409
    assert host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "bitcoin"}).status_code == 400
    done = host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "manual"}).get_json()
    assert (done["refund_status"], done["payment_status"]) == ("refunded", "refunded")


def test_signed_in_guest_cancels_without_retyping_their_email(app, client):
    guest = account(app, "ana@example.com")
    ref = book(client, None, iso(20), iso(23))["booking"]["reference"]
    stranger = account(app, "eve@example.test")
    assert stranger.post(f"/api/bookings/{ref}/cancel", json={}).status_code == 403
    assert guest.post(f"/api/bookings/{ref}/cancel", json={}).get_json()["status"] == "cancelled"


def test_partner_stays_cancel_without_money_through_the_site(app, client, host):
    owner = account(app, "owner@bluebay.example")
    business = make_business(owner)
    approve(host, "business", business["id"])
    stay = owner.post("/api/partner/listings/stays", json=STAY).get_json()
    approve(host, "stays", stay["id"])
    app.config.update(SMTP_HOST="smtp.test", SMTP_FROM="bookings@megrooms.test")
    body = {"hotel_id": stay["id"], "start_date": iso(20), "end_date": iso(23), "guest_count": 2, "guest_name": "Ana Dervishi", "guest_email": "ana@example.com"}
    ref = client.post("/api/bookings/", json=body).get_json()["booking"]["reference"]
    owner.patch(f"/api/partner/bookings/{ref}", json={"status": "confirmed"})
    quote = client.get(f"/api/bookings/{ref}/cancellation").get_json()
    assert quote["partner"] is True and quote["refund_amount"] == 0 and quote["can_cancel"]
    mailer.outbox.clear()
    assert client.post(f"/api/bookings/{ref}/cancel", json=EMAIL).get_json()["refund_status"] == "none"
    assert any(m["to"] == "owner@bluebay.example" and "cancelled by the guest" in m["subject"] for m in mailer.outbox)
    # The site's host has no refund button for a partner's booking.
    assert host.post(f"/api/admin/bookings/{ref}/refund", json={"method": "manual"}).status_code == 404
    # The business cancelling a booking tells the guest.
    ref2 = client.post("/api/bookings/", json=body).get_json()["booking"]["reference"]
    mailer.outbox.clear()
    assert owner.patch(f"/api/partner/bookings/{ref2}", json={"status": "cancelled"}).get_json()["cancelled_by"] == "host"
    assert any(m["to"] == "ana@example.com" and m["subject"] == f"Booking cancelled: {ref2}" for m in mailer.outbox)


def test_policy_numbers_are_kept_sane(app):
    app.config.update(CANCEL_FULL_REFUND_DAYS=5, CANCEL_PARTIAL_REFUND_DAYS=9, CANCEL_PARTIAL_REFUND_PERCENT=250)
    assert cancellations.policy() == {"full_refund_days": 5, "partial_refund_days": 5, "partial_refund_percent": 100}

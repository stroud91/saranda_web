"""Guest reviews: who may write one, what the public sees, and what hosts can do."""
import re
from datetime import timedelta

import pytest

from app.extensions import db
from app.models import Booking, Review
from app.models.db import utcnow
from app.services import mailer, reviews
from tests.test_partners import HOST, PASSWORD, STAY, account, approve, make_business

GOOD = {"rating": 5, "title": "Lovely balcony", "text": "Spotless, quiet and two minutes from the promenade. We would come back."}


@pytest.fixture(autouse=True)
def _outbox():
    mailer.outbox.clear()
    yield
    mailer.outbox.clear()


@pytest.fixture()
def host(app):
    return account(app, HOST)


def stay_booking(hotel_id=1, ended_days_ago=2, status="confirmed", email="ana@example.test", name="Ana Guest", user_id=None):
    """A booking whose stay ended ``ended_days_ago`` days ago (negative: still in the future)."""
    end = utcnow() - timedelta(days=ended_days_ago)
    booking = Booking(hotel_id=hotel_id, start_date=end - timedelta(days=3), end_date=end, nights=3, total_cost=195, status=status,
                      payment_status="paid" if status == "confirmed" else "unpaid", guest_name=name, guest_email=email, guest_count=2,
                      payment_method="request", user_id=user_id)
    db.session.add(booking)
    db.session.commit()
    return booking


def invite(booking):
    key = reviews.new_key(booking)
    db.session.commit()
    return key


def test_a_guest_reviews_a_finished_stay_once_with_the_emailed_link(app, client, host):
    booking = stay_booking()
    key = invite(booking)
    form = client.get(f"/api/reviews/invite/{booking.reference}?key={key}").get_json()
    assert form["eligible"] and form["stay"] == {"id": 1, "name": "Apartment 4 — Sea View"} and form["first_name"] == "Ana"
    assert client.get("/api/hotels/1").get_json()["reviews"] == {"average": None, "count": 0}

    r = client.post("/api/reviews/", json={**GOOD, "reference": booking.reference, "key": key, "lang": "en"})
    assert r.status_code == 201, r.get_json()
    shown = client.get("/api/reviews/stays/1").get_json()
    assert shown["count"] == 1 and shown["average"] == 5.0 and shown["spread"]["5"] == 1
    first = shown["reviews"][0]
    assert first["author"] == "Ana G." and first["text"] == GOOD["text"] and first["stay_month"] == booking.end_date.strftime("%Y-%m")
    assert "email" not in str(first).lower() and "reference" not in first  # nothing identifying beyond a first name and initial
    assert client.get("/api/hotels/1").get_json()["reviews"] == {"average": 5.0, "count": 1}
    assert [h["reviews"]["count"] for h in client.get("/api/hotels/").get_json() if h["id"] == 1] == [1]
    # The host is told.
    assert any("New review: 5/5" in m["subject"] and m["to"] == app.config["CONTACT_EMAIL"] for m in mailer.outbox)
    # The link worked once; a second review for the same stay is refused either way.
    again = client.post("/api/reviews/", json={**GOOD, "reference": booking.reference, "key": key})
    assert again.status_code == 404 and Review.query.count() == 1
    assert client.get(f"/api/reviews/invite/{booking.reference}?key={key}").status_code == 404
    # The rating reaches search engines as structured data.
    import app as app_module, os, shutil, tempfile
    site = tempfile.mkdtemp()
    shutil.copy(os.path.join(os.path.dirname(os.path.dirname(__file__)), "travago-tour-app", "index.html"), os.path.join(site, "index.html"))
    old, app_module.STATIC_DIR = app_module.STATIC_DIR, site
    try:
        page = client.get("/stays/1").get_data(as_text=True)
    finally:
        app_module.STATIC_DIR = old
    assert '"aggregateRating"' in page and '"reviewCount": 1' in page


def test_who_cannot_write_a_review(app, client, host):
    done = stay_booking()
    key = invite(done)
    body = {**GOOD, "reference": done.reference}
    # No key, a wrong key, someone else's key, or an unknown reference: all the same answer.
    other = stay_booking(email="ben@example.test", name="Ben Other")
    other_key = invite(other)
    for attempt in ({}, {"key": "wrong"}, {"key": other_key}, {"key": key, "reference": "BNOPE12345"}):
        r = client.post("/api/reviews/", json={**body, **attempt})
        assert r.status_code == 404 and "isn't valid" in r.get_json()["error"], attempt
    assert client.get(f"/api/reviews/invite/{done.reference}").status_code == 404
    assert client.get(f"/api/reviews/invite/{done.reference}?key=nope").status_code == 404
    # Stays that haven't happened, weren't confirmed, or ended long ago.
    for booking, words in ((stay_booking(ended_days_ago=-5), "once your stay has finished"), (stay_booking(status="cancelled"), "Only confirmed"),
                           (stay_booking(status="requested"), "Only confirmed"), (stay_booking(ended_days_ago=200), "six months")):
        k = invite(booking)
        r = client.post("/api/reviews/", json={**GOOD, "reference": booking.reference, "key": k})
        assert r.status_code == 409 and words in r.get_json()["error"], words
        assert client.get(f"/api/reviews/invite/{booking.reference}?key={k}").get_json()["eligible"] is False
    # Bad input.
    for bad in ({"rating": 0}, {"rating": 6}, {"rating": "great"}, {"text": ""}, {"text": "Too short."}):
        r = client.post("/api/reviews/", json={**body, "key": key, **bad})
        assert r.status_code == 400, bad
    assert client.post("/api/reviews/", json={**body, "key": key, "website": "http://spam.example"}).status_code == 400
    assert Review.query.count() == 0
    # Markup is kept as plain text.
    # Markup is kept as the plain text it is (the page draws text, never HTML).
    sneaky = "<script>alert(1)</script> Nice place, great host, would return."
    r = client.post("/api/reviews/", json={**body, "key": key, "text": sneaky})
    assert r.status_code == 201 and r.is_json and client.get("/api/reviews/stays/1").get_json()["reviews"][0]["text"] == sneaky


def test_a_signed_in_guest_reviews_from_their_account_without_a_link(app, client, host):
    guest = account(app, "ana@example.test")
    booking = stay_booking(email="ana@example.test")
    listed = guest.get("/api/account/overview").get_json()["bookings"]
    assert [b["can_review"] for b in listed if b["reference"] == booking.reference] == [True]
    assert guest.get(f"/api/reviews/invite/{booking.reference}").get_json()["eligible"]
    assert guest.post("/api/reviews/", json={**GOOD, "rating": 4, "reference": booking.reference}).status_code == 201
    assert guest.get("/api/account/overview").get_json()["bookings"][0]["can_review"] is False
    # An account with a different address, or an unconfirmed one, can't.
    stranger = account(app, "eve@example.test")
    unverified = account(app, "ben@example.test", verify=False)
    theirs = stay_booking(email="ben@example.test", name="Ben Other")
    assert stranger.post("/api/reviews/", json={**GOOD, "reference": theirs.reference}).status_code == 404
    assert unverified.post("/api/reviews/", json={**GOOD, "reference": theirs.reference}).status_code == 404
    # Deleting the account keeps the review but removes the name.
    assert guest.post("/api/account/delete", json={"password": PASSWORD}).status_code == 200
    assert client.get("/api/reviews/stays/1").get_json()["reviews"][0]["author"] == "A guest"


def test_invitations_go_out_once_the_day_after_checkout(app, client):
    due, early, old, unpaid = stay_booking(ended_days_ago=1), stay_booking(ended_days_ago=0, email="b@example.test"), \
        stay_booking(ended_days_ago=30, email="c@example.test"), stay_booking(ended_days_ago=2, status="cancelled", email="d@example.test")
    app.config.update(SMTP_HOST="smtp.test", SMTP_FROM="bookings@megrooms.test")
    result = app.test_cli_runner().invoke(args=["users", "cleanup"])
    assert result.exit_code == 0 and "Sent 1 review invitations" in result.output, result.output
    mails = [m for m in mailer.outbox if m["subject"] == "How was your stay?"]
    assert [m["to"] for m in mails] == ["ana@example.test"]
    link = re.search(r"https://megrooms\.test/review/([\w-]+)\?key=([\w-]+)", mails[0]["text"])
    assert link and link.group(1) == due.reference
    assert client.post("/api/reviews/", json={**GOOD, "reference": link.group(1), "key": link.group(2)}).status_code == 201
    # Running the job again sends nothing new.
    mailer.outbox.clear()
    app.test_cli_runner().invoke(args=["users", "cleanup"])
    assert not [m for m in mailer.outbox if m["subject"] == "How was your stay?"]
    assert db.session.get(Booking, early.id).review_invited_at is None and db.session.get(Booking, old.id).review_invited_at is None
    assert db.session.get(Booking, unpaid.id).review_invited_at is None


def test_host_can_hide_with_a_reason_reply_and_hand_out_a_link(app, client, host):
    booking = stay_booking()
    key = invite(booking)
    client.post("/api/reviews/", json={**GOOD, "rating": 2, "reference": booking.reference, "key": key, "text": "The air conditioning was loud and the wifi kept dropping."})
    review = host.get("/api/admin/reviews").get_json()[0]
    assert review["status"] == "published" and review["reference"] == booking.reference and review["rating"] == 2
    # A reply is public.
    replied = host.patch(f"/api/admin/reviews/{review['id']}", json={"reply": "Thank you. The unit was replaced in March."}).get_json()
    assert replied["reply"].startswith("Thank you") and client.get("/api/reviews/stays/1").get_json()["reviews"][0]["reply"].startswith("Thank you")
    # Hiding needs a reason, removes it from the public page and the average, and can be undone.
    assert host.patch(f"/api/admin/reviews/{review['id']}", json={"action": "hide"}).status_code == 400
    hidden = host.patch(f"/api/admin/reviews/{review['id']}", json={"action": "hide", "reason": "Names a member of staff"}).get_json()
    assert hidden["status"] == "hidden" and client.get("/api/reviews/stays/1").get_json() == {"average": None, "count": 0, "spread": {str(n): 0 for n in range(5, 0, -1)}, "reviews": []}
    assert host.patch(f"/api/admin/reviews/{review['id']}", json={"action": "publish"}).get_json()["status"] == "published"
    assert client.get("/api/hotels/1").get_json()["reviews"] == {"average": 2.0, "count": 1}
    # Guests can't moderate, and the review text itself can't be edited by anyone.
    guest = account(app, "eve@example.test")
    assert guest.patch(f"/api/admin/reviews/{review['id']}", json={"action": "hide", "reason": "I don't like it"}).status_code == 403
    assert client.get("/api/admin/reviews").status_code == 401
    host.patch(f"/api/admin/reviews/{review['id']}", json={"text": "Five stars!", "rating": 5})
    assert db.session.get(Review, review["id"]).rating == 2
    # When e-mail isn't set up, the host can hand a guest a link; a new link cancels the old one.
    later = stay_booking(email="zoe@example.test", name="Zoe")
    first = host.post(f"/api/admin/bookings/{later.reference}/review-link").get_json()["url"]
    second = host.post(f"/api/admin/bookings/{later.reference}/review-link").get_json()["url"]
    assert first != second and first.startswith("https://megrooms.test/review/")
    old_key, new_key = first.split("key=")[1], second.split("key=")[1]
    assert client.get(f"/api/reviews/invite/{later.reference}?key={old_key}").status_code == 404
    assert client.get(f"/api/reviews/invite/{later.reference}?key={new_key}").get_json()["first_name"] == "Zoe"
    assert host.post(f"/api/admin/bookings/{stay_booking(ended_days_ago=-3).reference}/review-link").status_code == 409


def test_a_business_can_reply_to_but_not_write_hide_or_edit_its_reviews(app, client, host):
    owner = account(app, "owner@bluebay.example")
    business = make_business(owner)
    approve(host, "business", business["id"])
    stay = owner.post("/api/partner/listings/stays", json=STAY).get_json()
    approve(host, "stays", stay["id"])
    booking = stay_booking(hotel_id=stay["id"])
    # The business sees the booking, but has no way to get a review key for it.
    assert owner.post(f"/api/admin/bookings/{booking.reference}/review-link").status_code == 403
    assert host.post(f"/api/admin/bookings/{booking.reference}/review-link").status_code == 404  # not the host's stay either
    assert owner.post("/api/reviews/", json={**GOOD, "reference": booking.reference}).status_code == 404
    key = invite(booking)
    mailer.outbox.clear()
    assert client.post("/api/reviews/", json={**GOOD, "rating": 3, "reference": booking.reference, "key": key}).status_code == 201
    assert any(m["to"] == "owner@bluebay.example" and "New review: 3/5" in m["subject"] for m in mailer.outbox)
    mine = owner.get("/api/partner/reviews").get_json()
    assert len(mine) == 1 and mine[0]["rating"] == 3
    rid = mine[0]["id"]
    assert owner.patch(f"/api/partner/reviews/{rid}", json={"reply": "Thanks for staying with us!"}).get_json()["reply"] == "Thanks for staying with us!"
    assert owner.patch(f"/api/admin/reviews/{rid}", json={"action": "hide", "reason": "unfair"}).status_code == 403
    owner.patch(f"/api/partner/reviews/{rid}", json={"reply": "x", "rating": 5, "status": "hidden", "text": "Great!"})
    row = db.session.get(Review, rid)
    assert (row.rating, row.status, row.text) == (3, "published", GOOD["text"])
    # Another business can't see or answer it, and the site's host leaves the reply to the business.
    rival = account(app, "owner@harbour.example")
    make_business(rival, name="Harbour Boats", email="hi@harbour.example")
    assert rival.get("/api/partner/reviews").get_json() == [] and rival.patch(f"/api/partner/reviews/{rid}", json={"reply": "hm"}).status_code == 404
    assert host.patch(f"/api/admin/reviews/{rid}", json={"reply": "Host here"}).status_code == 409
    # The site's host can still hide it; then the business no longer sees it.
    host.patch(f"/api/admin/reviews/{rid}", json={"action": "hide", "reason": "Reveals a phone number"})
    assert owner.get("/api/partner/reviews").get_json() == []


def test_reviews_can_be_switched_off(app, client):
    app.config["REVIEWS_ENABLED"] = False
    assert client.get("/api/reviews/stays/1").status_code == 404
    assert client.post("/api/reviews/", json={**GOOD, "reference": "B1"}).status_code == 404

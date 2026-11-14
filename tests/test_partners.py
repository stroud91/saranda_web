"""Business portal: partner profiles, their listings, the host's review,
guest requests, and the walls between one business and another."""
import re
from datetime import date, timedelta

import pytest

from app.extensions import db
from app.models import Booking, Business, CarRental, Enquiry, Hotel, Tour, User
from app.services import mailer

PASSWORD = "olive-grove-ferry-42"
HOST = "host@megrooms.test"  # in TestConfig.ADMIN_EMAILS

PROFILE = {"name": "Blue Bay Rentals", "tagline": "Cars and boats in Ksamil", "city": "Ksamil",
           "description": "Family-run rentals by the beach since 2012.", "email": "hello@bluebay.example",
           "phone": "+355 69 123 4567", "website": "https://bluebay.example"}
STAY = {"hotel_name": "Olive Terrace Studio", "address": "Rruga e Plazhit 4", "city": "Ksamil",
        "description": "A quiet studio with a terrace under the olive trees.", "price_per_night": 55,
        "max_guests": 3, "amenities": ["Wi-Fi", "Air conditioning"]}
RENTAL = {"car_model": "Fiat Panda", "car_type": "Hatchback", "location": "Ksamil centre", "price_per_day": 35,
          "seats": 4, "transmission": "manual"}
ACTIVITY = {"tour_name": "Sunset kayak to the islands", "description": "Two hours paddling around the Ksamil islands.",
            "location": "Ksamil main beach", "category": "active", "price": 30, "duration_hours": 2,
            "destination_slug": "ksamil"}


def future(days):
    return (date.today() + timedelta(days=days)).isoformat()


@pytest.fixture(autouse=True)
def _outbox():
    mailer.outbox.clear()
    yield
    mailer.outbox.clear()


def account(app, email, verify=True):
    """A signed-in client for a new account (its own cookie jar)."""
    client = app.test_client()
    r = client.post("/api/auth/register", json={"name": email.split("@")[0].title(), "email": email, "password": PASSWORD})
    assert r.status_code in (200, 201), r.get_json()
    if verify:
        token = None
        for msg in reversed(mailer.outbox):
            m = re.search(r"/verify-email\?token=([\w-]+)", msg["text"])
            if m and msg["to"] == email:
                token = m.group(1)
                break
        assert token, "no verification mail"
        assert client.post("/api/auth/verify", json={"token": token}).status_code == 200
    return client


@pytest.fixture()
def host(app):
    return account(app, HOST)


@pytest.fixture()
def owner(app):
    return account(app, "owner@bluebay.example")


def make_business(client, **over):
    r = client.post("/api/partner/business", json={**PROFILE, **over})
    assert r.status_code == 201, r.get_json()
    return r.get_json()


def approve(host, kind, ident):
    path = f"/api/admin/partners/businesses/{ident}" if kind == "business" else f"/api/admin/partners/listings/{kind}/{ident}"
    r = host.patch(path, json={"action": "approve"})
    assert r.status_code == 200, r.get_json()
    return r.get_json()


def live_business(owner, host):
    """An approved business with one approved listing of each kind."""
    business = make_business(owner)
    approve(host, "business", business["id"])
    out = {"business": business}
    for kind, body in (("stays", STAY), ("rentals", RENTAL), ("experiences", ACTIVITY)):
        r = owner.post(f"/api/partner/listings/{kind}", json=body)
        assert r.status_code == 201, r.get_json()
        out[kind] = r.get_json()
        approve(host, kind, out[kind]["id"])
    return out


def mails_to(address):
    return [m for m in mailer.outbox if m["to"] == address]


# ---- who may use the portal -------------------------------------------------------
def test_portal_needs_an_account_with_a_confirmed_email(app, client):
    assert client.get("/api/partner/").status_code == 401
    assert client.post("/api/partner/business", json=PROFILE).status_code == 401
    unverified = account(app, "new@example.com", verify=False)
    dash = unverified.get("/api/partner/").get_json()
    assert dash["business"] is None and dash["email_verified"] is False
    r = unverified.post("/api/partner/business", json=PROFILE)
    assert r.status_code == 403 and r.get_json()["code"] == "verify_email"
    assert Business.query.count() == 0


def test_a_new_business_waits_for_review_and_is_hidden(owner, client):
    business = make_business(owner)
    assert business["status"] == "pending" and business["slug"] == "blue-bay-rentals"
    assert client.get("/api/businesses/").get_json() == {"businesses": []}
    assert client.get("/api/businesses/blue-bay-rentals").status_code == 404
    # The host is told there is something to review.
    assert any("Blue Bay Rentals" in m["text"] for m in mails_to("bookings@megrooms.com"))
    # One business per account.
    assert owner.post("/api/partner/business", json=PROFILE).status_code == 409


def test_profile_validation_blocks_script_links(owner):
    for bad in ("javascript:alert(1)", "http://insecure.example", "https://x.example/\"><script>"):
        r = owner.post("/api/partner/business", json={**PROFILE, "website": bad})
        assert r.status_code == 400 and "website" in r.get_json()["fields"], bad
    r = owner.post("/api/partner/business", json={**PROFILE, "name": "", "email": "nope"})
    assert set(r.get_json()["fields"]) == {"name", "email"}


def test_slugs_are_ascii_and_unique(app, owner):
    assert make_business(owner, name="Çela & Sons — Sarandë")["slug"] == "cela-sons-sarande"
    other = account(app, "second@example.com")
    assert make_business(other, name="Cela Sons Sarande")["slug"] == "cela-sons-sarande-2"


# ---- listings and review -----------------------------------------------------------
def test_listings_stay_hidden_until_the_host_approves(owner, host, client):
    business = make_business(owner)
    stay = owner.post("/api/partner/listings/stays", json=STAY).get_json()
    assert stay["review_status"] == "pending" and stay["kind"] == "stays"
    house = len(client.get("/api/hotels/").get_json())
    assert client.get(f"/api/hotels/{stay['id']}").status_code == 404
    assert client.get(f"/api/hotels/{stay['id']}/availability").status_code == 404
    quote = {"hotel_id": stay["id"], "start_date": future(10), "end_date": future(13), "guest_count": 2}
    assert client.post("/api/bookings/quote", json=quote).status_code == 400

    # Approving the listing alone is not enough: the business must be approved too.
    approve(host, "stays", stay["id"])
    assert client.get(f"/api/hotels/{stay['id']}").status_code == 404
    approve(host, "business", business["id"])
    shown = client.get(f"/api/hotels/{stay['id']}").get_json()
    assert shown["business"] == {"slug": "blue-bay-rentals", "name": "Blue Bay Rentals"}
    listing = client.get("/api/hotels/").get_json()
    assert len(listing) == house + 1 and listing[-1]["id"] == stay["id"]  # the site's own stays come first
    assert all(h["business"] is None for h in listing[:-1])
    # The owner is told about each decision.
    assert len([m for m in mails_to("owner@bluebay.example") if "Approved" in m["subject"]]) == 2


def test_owner_cannot_set_fields_outside_the_form(owner, host, client):
    make_business(owner)
    sneaky = {**STAY, "business_id": None, "review_status": "approved", "airbnb_rating": 5, "tag": "Featured",
              "id": 1, "total_rooms": 99}
    # Photos must be ones uploaded here: an outside address is refused outright.
    outside = owner.post("/api/partner/listings/stays", json={**sneaky, "image_urls": ["https://evil.example/x.png"]})
    assert outside.status_code == 400 and "image_urls" in outside.get_json()["fields"]
    stay = owner.post("/api/partner/listings/stays", json=sneaky).get_json()
    row = db.session.get(Hotel, stay["id"])
    assert row.review_status == "pending" and row.business_id is not None
    assert row.airbnb_rating is None and row.tag is None and not row.image_urls and row.total_rooms == 1
    car = owner.post("/api/partner/listings/rentals", json={**RENTAL, "rental_company": "Meg'Rooms", "review_status": "approved"}).get_json()
    assert car["review_status"] == "pending" and car["rental_company"] == "Blue Bay Rentals"
    profile = owner.put("/api/partner/business", json={"status": "approved", "slug": "megrooms", "owner_id": 1}).get_json()
    assert profile["status"] == "pending" and profile["slug"] == "blue-bay-rentals"
    bad = owner.post("/api/partner/listings/experiences", json={**ACTIVITY, "destination_slug": "atlantis"})
    assert bad.status_code == 400 and "destination_slug" in bad.get_json()["fields"]
    assert owner.post("/api/partner/listings/yachts", json=STAY).status_code == 404


def test_edits_to_live_listings_wait_for_review_but_prices_apply_at_once(owner, host, client):
    live = live_business(owner, host)
    sid = live["stays"]["id"]
    mailer.outbox.clear()
    edited = owner.put(f"/api/partner/listings/stays/{sid}", json={"price_per_night": 70, "description": "Now with a hot tub!"}).get_json()
    assert edited["has_pending_changes"] and edited["description"] == "Now with a hot tub!" and edited["price_per_night"] == 70
    public = client.get(f"/api/hotels/{sid}").get_json()
    assert public["price_per_night"] == 70  # price is live
    assert public["description"] == STAY["description"]  # text waits for the host
    queue = host.get("/api/admin/partners").get_json()["queue"]
    assert [(q["type"], q["id"], q["first_review"]) for q in queue] == [("stays", sid, False)]
    assert queue[0]["changes"] == {"description": {"from": STAY["description"], "to": "Now with a hot tub!"}}
    assert len(mails_to("bookings@megrooms.com")) == 1
    # A second edit while waiting doesn't mail the host again.
    owner.put(f"/api/partner/listings/stays/{sid}", json={"hotel_name": "Olive Terrace Suite"})
    assert len(mails_to("bookings@megrooms.com")) == 1

    # Rejected edits are thrown away; the approved version stays live.
    r = host.patch(f"/api/admin/partners/listings/stays/{sid}", json={"action": "reject"})
    assert r.status_code == 400  # a note is required
    host.patch(f"/api/admin/partners/listings/stays/{sid}", json={"action": "reject", "note": "No hot tub in the photos."})
    mine = owner.get("/api/partner/").get_json()["listings"]["stays"][0]
    assert mine["review_status"] == "approved" and not mine["has_pending_changes"]
    assert mine["description"] == STAY["description"] and mine["review_note"] == "No hot tub in the photos."
    assert client.get(f"/api/hotels/{sid}").get_json()["hotel_name"] == STAY["hotel_name"]

    # Approved edits replace the live version.
    owner.put(f"/api/partner/listings/stays/{sid}", json={"description": "Freshly repainted."})
    approve(host, "stays", sid)
    assert client.get(f"/api/hotels/{sid}").get_json()["description"] == "Freshly repainted."
    assert host.get("/api/admin/partners").get_json()["queue"] == []


def test_profile_edits_also_wait_and_rejections_can_be_fixed(app, owner, host, client):
    business = make_business(owner)
    host.patch(f"/api/admin/partners/businesses/{business['id']}", json={"action": "reject", "note": "Add a real address."})
    mine = owner.get("/api/partner/").get_json()["business"]
    assert mine["status"] == "rejected" and mine["review_note"] == "Add a real address."
    fixed = owner.put("/api/partner/business", json={"address": "Rruga Butrinti 12"}).get_json()
    assert fixed["status"] == "pending" and fixed["review_note"] is None
    approve(host, "business", business["id"])

    # Once live, a new phone number is not shown until it is approved.
    owner.put("/api/partner/business", json={"phone": "+355 69 000 0000", "palette": "sunset"})
    public = client.get("/api/businesses/blue-bay-rentals").get_json()["business"]
    assert public["phone"] == PROFILE["phone"] and public["palette"] == "sunset"
    approve(host, "business", business["id"])
    assert client.get("/api/businesses/blue-bay-rentals").get_json()["business"]["phone"] == "+355 69 000 0000"


def test_public_business_page_lists_only_what_is_on(owner, host, client):
    live = live_business(owner, host)
    page = client.get("/api/businesses/blue-bay-rentals").get_json()
    assert page["business"]["name"] == "Blue Bay Rentals" and "id" not in page["business"] and "status" not in page["business"]
    assert {k: len(v) for k, v in page["listings"].items()} == {"stays": 1, "rentals": 1, "experiences": 1}
    assert client.get("/api/businesses/").get_json()["businesses"][0]["counts"] == {"stays": 1, "rentals": 1, "experiences": 1}
    # Paused by the owner: off the public pages straight away, no review needed.
    rid = live["rentals"]["id"]
    owner.put(f"/api/partner/listings/rentals/{rid}", json={"availability_status": "unavailable"})
    assert client.get("/api/businesses/blue-bay-rentals").get_json()["listings"]["rentals"] == []
    assert all(c["id"] != rid for c in client.get("/api/car_rentals/").get_json())
    # Removed: gone for the owner too, but the row stays for past requests.
    assert owner.delete(f"/api/partner/listings/experiences/{live['experiences']['id']}").status_code == 204
    assert owner.get("/api/partner/").get_json()["listings"]["experiences"] == []
    assert all(t["id"] != live["experiences"]["id"] for t in client.get("/api/tours/").get_json())
    assert db.session.get(Tour, live["experiences"]["id"]).review_status == "removed"


def test_listing_limit(app, owner):
    app.config["PARTNER_MAX_LISTINGS"] = 2
    make_business(owner)
    assert owner.post("/api/partner/listings/rentals", json=RENTAL).status_code == 201
    assert owner.post("/api/partner/listings/stays", json=STAY).status_code == 201
    r = owner.post("/api/partner/listings/experiences", json=ACTIVITY)
    assert r.status_code == 409 and "limit" in r.get_json()["error"]


# ---- one business can't touch another's ---------------------------------------------
def test_owners_cannot_reach_each_others_data(app, owner, host, client):
    live = live_business(owner, host)
    rival = account(app, "rival@example.com")
    # No business yet: owner-only routes answer 404.
    assert rival.get("/api/partner/requests").status_code == 404
    make_business(rival, name="Rival Rentals")
    for kind in ("stays", "rentals", "experiences"):
        lid = live[kind]["id"]
        assert rival.put(f"/api/partner/listings/{kind}/{lid}", json={"description": "hacked"}).status_code == 404
        assert rival.delete(f"/api/partner/listings/{kind}/{lid}").status_code == 404
    assert rival.get("/api/partner/").get_json()["listings"] == {"stays": [], "rentals": [], "experiences": []}
    assert db.session.get(Hotel, live["stays"]["id"]).description == STAY["description"]

    booking = client.post("/api/bookings/", json={"hotel_id": live["stays"]["id"], "start_date": future(20), "end_date": future(23),
                                                  "guest_count": 2, "guest_name": "Ana Guest", "guest_email": "ana@example.com"}).get_json()["booking"]
    enquiry = client.post("/api/businesses/blue-bay-rentals/enquiries", json={"name": "Ana", "email": "ana@example.com", "message": "Hello"}).get_json()
    assert rival.get("/api/partner/requests").get_json() == {"bookings": [], "enquiries": []}
    assert rival.patch(f"/api/partner/bookings/{booking['reference']}", json={"status": "confirmed"}).status_code == 404
    assert rival.patch(f"/api/partner/enquiries/{enquiry['reference']}", json={"status": "closed"}).status_code == 404
    assert db.session.query(Booking).filter_by(reference=booking["reference"]).one().status == "requested"


def test_review_endpoints_are_for_the_host_only(app, owner, client):
    business = make_business(owner)
    stay = owner.post("/api/partner/listings/stays", json=STAY).get_json()
    for who, code in ((client, 401), (owner, 403)):
        assert who.get("/api/admin/partners").status_code == code
        assert who.patch(f"/api/admin/partners/businesses/{business['id']}", json={"action": "approve"}).status_code == code
        assert who.patch(f"/api/admin/partners/listings/stays/{stay['id']}", json={"action": "approve"}).status_code == code
    assert db.session.get(Business, business["id"]).status == "pending"
    # The site's own listings can't be pushed through partner review, or edited as a partner's.
    house = Hotel.query.filter(Hotel.business_id.is_(None)).first()
    assert owner.put(f"/api/partner/listings/stays/{house.id}", json={"price_per_night": 5}).status_code == 404


# ---- guests: bookings and questions --------------------------------------------------
def test_partner_stays_are_request_only_and_handled_by_the_business(app, owner, host, client):
    live = live_business(owner, host)
    sid = live["stays"]["id"]
    mailer.outbox.clear()
    body = {"hotel_id": sid, "start_date": future(30), "end_date": future(33), "guest_count": 2,
            "guest_name": "Ana Guest", "guest_email": "ana@example.com", "guest_phone": "+355 68 111 2222"}
    # The site never takes money for another business, whatever the browser asks for.
    for method in ("paypal", "bank", "card"):
        r = client.post("/api/bookings/", json={**body, "payment_method": method})
        assert r.status_code == 400 and "payment_method" in r.get_json()["fields"]
    r = client.post("/api/bookings/", json=body)
    assert r.status_code == 201
    booking = r.get_json()["booking"]
    assert booking["status"] == "requested" and booking["payment_method"] == "request"
    assert booking["hosted_by"] == {"slug": "blue-bay-rentals", "name": "Blue Bay Rentals"}
    assert booking["total_cost"] == 55 * 3
    # The business is told (at the owner's confirmed address); the site's host is not.
    assert len(mails_to("owner@bluebay.example")) == 1 and "ana@example.com" in mails_to("owner@bluebay.example")[0]["text"]
    assert mails_to("bookings@megrooms.com") == []

    # It is the business's to answer, not the host's.
    assert all(b["reference"] != booking["reference"] for b in host.get("/api/admin/bookings").get_json())
    assert host.patch(f"/api/admin/bookings/{booking['reference']}", json={"status": "confirmed"}).status_code == 404
    inbox = owner.get("/api/partner/requests").get_json()
    assert inbox["bookings"][0]["guest_email"] == "ana@example.com" and inbox["bookings"][0]["guest_phone"] == "+355 68 111 2222"
    assert owner.get("/api/partner/").get_json()["new_requests"] == 1
    done = owner.patch(f"/api/partner/bookings/{booking['reference']}", json={"status": "confirmed"}).get_json()
    assert done["status"] == "confirmed"
    confirmation = mails_to("ana@example.com")[-1]
    assert "confirmed" in confirmation["subject"].lower() and "Blue Bay Rentals" in confirmation["text"]
    # Confirmed dates are blocked; a confirmed booking can be cancelled but not re-opened.
    assert client.post("/api/bookings/", json=body).status_code == 409
    assert owner.patch(f"/api/partner/bookings/{booking['reference']}", json={"status": "cancelled"}).status_code == 200
    assert owner.patch(f"/api/partner/bookings/{booking['reference']}", json={"status": "confirmed"}).status_code == 409


def test_enquiries_reach_only_the_right_business(app, owner, host, client):
    live = live_business(owner, host)
    mailer.outbox.clear()
    ask = {"kind": "rental", "listing_id": live["rentals"]["id"], "name": "Ben Driver", "email": "Ben@Example.com",
           "start_date": future(12), "end_date": future(15), "people": 2, "message": "Is full insurance included?"}
    r = client.post("/api/businesses/blue-bay-rentals/enquiries", json=ask)
    assert r.status_code == 201
    sent = r.get_json()
    assert sent["subject"] == "Fiat Panda" and sent["email_masked"].startswith("b•••") and "email" not in sent
    mail = mails_to("owner@bluebay.example")[0]
    assert "ben@example.com" in mail["text"] and "insurance" in mail["text"]
    inbox = owner.get("/api/partner/requests").get_json()["enquiries"]
    assert inbox[0]["email"] == "ben@example.com" and inbox[0]["status"] == "new" and inbox[0]["kind"] == "rental"
    answered = owner.patch(f"/api/partner/enquiries/{sent['reference']}", json={"status": "answered"}).get_json()
    assert answered["status"] == "answered" and owner.get("/api/partner/").get_json()["new_requests"] == 0

    # Bad input: bots, past dates, and listings that aren't this business's.
    assert client.post("/api/businesses/blue-bay-rentals/enquiries", json={**ask, "website": "spam"}).status_code == 400
    assert client.post("/api/businesses/blue-bay-rentals/enquiries", json={**ask, "start_date": "2001-01-01"}).status_code == 400
    house_car = CarRental(car_model="House car", car_type="SUV", price_per_day=50, rental_company="Meg'Rooms", location="Sarandë")
    db.session.add(house_car)
    db.session.commit()
    r = client.post("/api/businesses/blue-bay-rentals/enquiries", json={**ask, "listing_id": house_car.id})
    assert r.status_code == 400 and "listing_id" in r.get_json()["fields"]
    assert client.post("/api/businesses/nobody/enquiries", json=ask).status_code == 404
    assert Enquiry.query.count() == 1


# ---- taking things down ----------------------------------------------------------------
def test_suspending_a_business_hides_everything_until_it_is_reinstated(owner, host, client):
    live = live_business(owner, host)
    bid, sid = live["business"]["id"], live["stays"]["id"]
    r = host.patch(f"/api/admin/partners/businesses/{bid}", json={"action": "suspend", "note": "Complaints from guests."})
    assert r.get_json()["status"] == "suspended"
    assert client.get("/api/businesses/blue-bay-rentals").status_code == 404
    assert client.get(f"/api/hotels/{sid}").status_code == 404
    assert all(t["business"] is None for t in client.get("/api/tours/").get_json())
    assert all(c["business"] is None for c in client.get("/api/car_rentals/").get_json())
    assert client.post("/api/businesses/blue-bay-rentals/enquiries", json={"name": "A", "email": "a@example.com", "message": "Hi"}).status_code == 404
    body = {"hotel_id": sid, "start_date": future(30), "end_date": future(33), "guest_count": 2, "guest_name": "Ana", "guest_email": "ana@example.com"}
    assert client.post("/api/bookings/", json=body).status_code == 400
    assert owner.post("/api/partner/listings/rentals", json=RENTAL).status_code == 403
    assert owner.get("/api/partner/").get_json()["business"]["review_note"] == "Complaints from guests."
    # Approving an edit made while suspended must not quietly put the business back online.
    owner.put("/api/partner/business", json={"tagline": "Under new management"})
    host.patch(f"/api/admin/partners/businesses/{bid}", json={"action": "approve"})
    assert db.session.get(Business, bid).status == "suspended" and client.get(f"/api/hotels/{sid}").status_code == 404
    host.patch(f"/api/admin/partners/businesses/{bid}", json={"action": "reinstate"})
    assert client.get(f"/api/hotels/{sid}").status_code == 200
    assert client.get("/api/businesses/blue-bay-rentals").get_json()["business"]["tagline"] == "Under new management"
    # With nothing waiting, review actions are refused rather than e-mailing the owner again.
    assert host.patch(f"/api/admin/partners/businesses/{bid}", json={"action": "approve"}).status_code == 409
    assert host.patch(f"/api/admin/partners/listings/stays/{sid}", json={"action": "reject", "note": "x"}).status_code == 409


def test_deleting_the_account_closes_the_business(owner, host, client):
    live = live_business(owner, host)
    export = owner.get("/api/account/export").get_json()
    assert export["business"]["profile"]["name"] == "Blue Bay Rentals" and len(export["business"]["listings"]["stays"]) == 1
    assert owner.post("/api/account/delete", json={"password": PASSWORD}).status_code == 200
    assert User.query.filter_by(email="owner@bluebay.example").first() is None
    business = db.session.get(Business, live["business"]["id"])
    assert business.status == "closed" and business.owner_id is None and business.email is None and business.phone is None
    assert client.get("/api/businesses/").get_json() == {"businesses": []}
    assert client.get(f"/api/hotels/{live['stays']['id']}").status_code == 404
    assert host.get("/api/admin/partners").get_json() == {"queue": [], "businesses": []}


def test_portal_can_be_switched_off(app, owner, host, client):
    live = live_business(owner, host)
    app.config["PARTNERS_ENABLED"] = False
    assert client.get("/api/meta/config").get_json()["partners"] is False
    assert owner.get("/api/partner/").status_code == 404
    assert client.get("/api/businesses/").status_code == 404
    assert client.get(f"/api/hotels/{live['stays']['id']}").status_code == 404
    assert all(h["business"] is None for h in client.get("/api/hotels/").get_json())
    app.config["PARTNERS_ENABLED"] = True
    assert client.get("/api/meta/config").get_json()["partners"] is True


# ---- page style -----------------------------------------------------------------------
def test_page_style_is_a_set_of_known_options_and_applies_at_once(owner, host, client):
    business = make_business(owner)
    assert business["style"] == {"background": "plain", "scene": "harbor", "variant": "golden", "cards": "soft"}
    approve(host, "business", business["id"])
    mailer.outbox.clear()
    look = {"background": "scene", "scene": "castle", "variant": "sunset", "cards": "outline"}
    saved = owner.put("/api/partner/business", json={"palette": "terracotta", "style": {**look, "css": "body{display:none}"}}).get_json()
    assert saved["style"] == look and saved["palette"] == "terracotta" and not saved["has_pending_changes"]
    # Cosmetic choices need no review and don't mail the host.
    public = client.get("/api/businesses/blue-bay-rentals").get_json()["business"]
    assert public["style"] == look and public["palette"] == "terracotta"
    assert mailer.outbox == []
    # A partial style keeps the defaults for the rest.
    assert owner.put("/api/partner/business", json={"style": {"background": "waves"}}).get_json()["style"]["scene"] == "harbor"
    # Anything that isn't one of the listed options is refused: no CSS, colours or URLs.
    for bad in ({"background": "url(https://evil.example/x.png)"}, {"background": "red;} body{display:none"},
                {"scene": "<script>"}, {"variant": ["day"]}, {"cards": 7}, "plain", ["plain"]):
        r = owner.put("/api/partner/business", json={"style": bad})
        assert r.status_code == 400 and "style" in r.get_json()["fields"], bad
    assert client.get("/api/businesses/blue-bay-rentals").get_json()["business"]["style"]["background"] == "waves"
    assert owner.get("/api/partner/").get_json()["options"]["style"]["background"] == ["plain", "gradient", "waves", "dots", "scene"]

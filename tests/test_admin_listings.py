"""Host desk: the host edits the site's own apartments, rentals, activities and guides."""
import io
from datetime import date, timedelta

import pytest
from PIL import Image

from app.extensions import db
from app.models import CarRental, Guide, Hotel, Tour
from tests.test_partners import ACTIVITY, HOST, RENTAL, STAY, account, approve, make_business

GUIDE = {"name": "Arben Hoxha", "headline": "Butrint and the south, on foot", "bio": "Born in Sarandë, guiding since 2010.",
         "base_city": "Sarandë", "languages": ["Albanian", "English"], "price_half_day": 60, "price_full_day": 110}


@pytest.fixture()
def host(app):
    return account(app, HOST)


def upload(client, scope):
    out = io.BytesIO()
    Image.new("RGB", (800, 600), (200, 120, 30)).save(out, "JPEG")
    r = client.post("/api/uploads/", data={"scope": scope, "file": (io.BytesIO(out.getvalue()), "a.jpg")},
                    content_type="multipart/form-data", headers={"X-Requested-With": "fetch"})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["url"]


def test_only_the_host_reaches_the_listing_desk(app, client, host):
    guest = account(app, "guest@example.test")
    for who, code in ((client, 401), (guest, 403)):
        assert who.get("/api/admin/listings/").status_code == code
        assert who.post("/api/admin/listings/stays", json=STAY).status_code == code
        assert who.put("/api/admin/listings/stays/1", json={"price_per_night": 1}).status_code == code
        assert who.delete("/api/admin/listings/stays/1").status_code == code
    assert float(db.session.get(Hotel, 1).price_per_night) != 1
    desk = host.get("/api/admin/listings/").get_json()
    assert len(desk["stays"]) == Hotel.query.count() and len(desk["guides"]) == Guide.query.count()
    assert desk["options"]["categories"] and desk["options"]["rental_types"]
    assert host.post("/api/admin/listings/yachts", json=STAY).status_code == 404


def test_host_adds_edits_and_removes_an_apartment(app, client, host):
    pic = upload(host, "house")
    made = host.post("/api/admin/listings/stays", json={**STAY, "tag": "New", "image_urls": [pic]})
    assert made.status_code == 201, made.get_json()
    stay = made.get_json()
    public = client.get(f"/api/hotels/{stay['id']}").get_json()  # live at once: the host is the reviewer
    assert public["hotel_name"] == STAY["hotel_name"] and public["tag"] == "New" and public["image_urls"] == [pic]
    assert public["business"] is None

    edited = host.put(f"/api/admin/listings/stays/{stay['id']}", json={"price_per_night": 72.5, "description": "Now with a hot tub."})
    assert edited.status_code == 200 and edited.get_json()["price_per_night"] == 72.5
    assert client.get(f"/api/hotels/{stay['id']}").get_json()["description"] == "Now with a hot tub."
    bad = host.put(f"/api/admin/listings/stays/{stay['id']}", json={"price_per_night": -4, "max_guests": "many"})
    assert bad.status_code == 400 and set(bad.get_json()["fields"]) == {"price_per_night", "max_guests"}
    # Fields outside the form are ignored, as everywhere else.
    host.put(f"/api/admin/listings/stays/{stay['id']}", json={"business_id": 9, "review_status": "pending", "id": 77})
    row = db.session.get(Hotel, stay["id"])
    assert row.business_id is None and row.review_status == "approved"

    # A seeded apartment keeps its short card name until the host renames it.
    assert client.get("/api/hotels/1").get_json()["apartment_name"] == "Sea View"
    host.put("/api/admin/listings/stays/1", json={"hotel_name": "Harbour Loft"})
    renamed = client.get("/api/hotels/1").get_json()
    assert renamed["hotel_name"] == "Harbour Loft" and renamed["apartment_name"] is None

    off = host.put(f"/api/admin/listings/stays/{stay['id']}", json={"is_active": False}).get_json()
    assert off["on"] is False and client.get(f"/api/hotels/{stay['id']}").status_code == 404
    host.put(f"/api/admin/listings/stays/{stay['id']}", json={"is_active": True})

    # With a booking ahead it can't be removed; afterwards it can, and it leaves the site and the desk.
    start, end = date.today() + timedelta(days=20), date.today() + timedelta(days=23)
    booked = client.post("/api/bookings/", json={"hotel_id": stay["id"], "start_date": start.isoformat(), "end_date": end.isoformat(),
                                                 "guest_count": 2, "guest_name": "Ana Guest", "guest_email": "ana@example.test",
                                                 "guest_phone": "+355 69 000 0000"})
    assert booked.status_code == 201, booked.get_json()
    assert host.delete(f"/api/admin/listings/stays/{stay['id']}").status_code == 409
    assert host.patch(f"/api/admin/bookings/{booked.get_json()['booking']['reference']}", json={"status": "cancelled"}).status_code == 200
    assert host.delete(f"/api/admin/listings/stays/{stay['id']}").status_code == 204
    assert client.get(f"/api/hotels/{stay['id']}").status_code == 404
    assert stay["id"] not in [s["id"] for s in host.get("/api/admin/listings/").get_json()["stays"]]
    assert host.put(f"/api/admin/listings/stays/{stay['id']}", json={"is_active": True}).status_code == 404


def test_host_manages_rentals_and_activities(app, client, host):
    car = host.post("/api/admin/listings/rentals", json=RENTAL).get_json()
    assert car["rental_company"] == "Meg'Rooms" and car["on"] is True
    assert car["id"] in [c["id"] for c in client.get("/api/car_rentals/").get_json()]
    host.put(f"/api/admin/listings/rentals/{car['id']}", json={"rental_company": "Riviera Wheels", "price_per_day": 40})
    row = db.session.get(CarRental, car["id"])
    assert row.rental_company == "Riviera Wheels" and float(row.price_per_day) == 40
    assert host.delete(f"/api/admin/listings/rentals/{car['id']}").status_code == 204
    assert car["id"] not in [c["id"] for c in client.get("/api/car_rentals/").get_json()]

    tour = host.post("/api/admin/listings/experiences", json={**ACTIVITY, "start_time": "09:30"}).get_json()
    assert tour["start_time"] == "09:30" and tour["duration_hours"] == 2
    assert client.get(f"/api/tours/{tour['id']}").get_json()["tour_name"] == ACTIVITY["tour_name"]
    later = host.put(f"/api/admin/listings/experiences/{tour['id']}", json={"start_time": "17:00", "price": 35}).get_json()
    assert later["start_time"] == "17:00" and later["price"] == 35
    bad = host.put(f"/api/admin/listings/experiences/{tour['id']}", json={"destination_slug": "atlantis"})
    assert bad.status_code == 400
    hidden = host.put(f"/api/admin/listings/experiences/{tour['id']}", json={"is_available": False}).get_json()
    assert hidden["on"] is False and tour["id"] not in [t["id"] for t in client.get("/api/tours/").get_json()]


def test_host_manages_guides(app, client, host):
    made = host.post("/api/admin/listings/guides", json=GUIDE)
    assert made.status_code == 201, made.get_json()
    guide = made.get_json()
    assert guide["slug"] == "arben-hoxha" and guide["is_sample"] is False and guide["on"] is True
    assert client.get("/api/guides/arben-hoxha").status_code == 200
    twin = host.post("/api/admin/listings/guides", json=GUIDE).get_json()
    assert twin["slug"] == "arben-hoxha-2"  # two guides can share a name, never an address
    taken = host.post("/api/admin/listings/guides", json={**GUIDE, "slug": "arben-hoxha"})
    assert taken.status_code == 400 and "slug" in taken.get_json()["fields"]

    edited = host.put(f"/api/admin/listings/guides/{guide['id']}", json={"price_full_day": 130, "slug": "someone-else", "is_active": False})
    assert edited.get_json()["price_full_day"] == 130 and edited.get_json()["slug"] == "arben-hoxha"
    assert client.get("/api/guides/arben-hoxha").status_code == 404  # switched off
    assert host.delete(f"/api/admin/listings/guides/{twin['id']}").status_code == 204
    assert db.session.get(Guide, twin["id"]) is None

    # A sample guide someone already wrote to can be switched off, not deleted.
    sample = Guide.query.filter_by(is_sample=True).first()
    r = client.post(f"/api/guides/{sample.slug}/requests", json={"tour_date": (date.today() + timedelta(days=9)).isoformat(),
                                                                  "duration": "half", "group_size": 2, "name": "Ana Guest",
                                                                  "email": "ana@example.test"})
    assert r.status_code == 201, r.get_json()
    assert host.delete(f"/api/admin/listings/guides/{sample.id}").status_code == 409
    assert host.put(f"/api/admin/listings/guides/{sample.id}", json={"is_active": False}).status_code == 200


def test_partner_listings_and_photos_stay_out_of_the_hosts_desk(app, host, client):
    owner = account(app, "owner@bluebay.example")
    make_business(owner)
    approve(host, "business", 1)
    theirs = owner.post("/api/partner/listings/stays", json=STAY).get_json()
    approve(host, "stays", theirs["id"])
    desk = host.get("/api/admin/listings/").get_json()
    assert theirs["id"] not in [s["id"] for s in desk["stays"]]
    # The host changes a partner's listing through review, not by editing it as their own.
    assert host.put(f"/api/admin/listings/stays/{theirs['id']}", json={"price_per_night": 1}).status_code == 404
    assert host.delete(f"/api/admin/listings/stays/{theirs['id']}").status_code == 404
    # A partner's photo can't be put on a house listing, nor a house photo on a partner's.
    partner_pic, house_pic = upload(owner, "business"), upload(host, "house")
    assert host.put("/api/admin/listings/stays/1", json={"image_urls": [partner_pic]}).status_code == 400
    assert owner.put(f"/api/partner/listings/stays/{theirs['id']}", json={"image_urls": [house_pic]}).status_code == 400
    assert host.put("/api/admin/listings/stays/1", json={"image_urls": [house_pic]}).status_code == 200
    assert Tour.query.filter(Tour.business_id.is_(None)).count() == len(desk["experiences"])


def test_listings_can_carry_translations(app, client, host):
    # The seeded apartments come with their four translations.
    seeded = client.get("/api/hotels/1").get_json()["translations"]
    assert set(seeded) == {"sq", "fr", "it", "de"} and seeded["de"]["hotel_name"] == "Apartment 4 — Meerblick"
    words = {"it": {"hotel_name": "Monolocale sul porto", "description": "Luminoso, a due passi dal mare."}, "sq": {"description": ""}}
    saved = host.put("/api/admin/listings/stays/1", json={"translations": words}).get_json()
    assert saved["translations"] == {"it": words["it"]}  # empty entries are dropped
    assert client.get("/api/hotels/1").get_json()["translations"]["it"]["hotel_name"] == "Monolocale sul porto"
    for bad in ({"xx": {"description": "?"}}, {"it": {"price_per_night": "1"}}, {"it": "text"}, ["it"], {"it": {"hotel_name": ["x"]}}):
        r = host.put("/api/admin/listings/stays/1", json={"translations": bad})
        assert r.status_code == 400 and "translations" in r.get_json()["fields"], bad
    # Over-long text is trimmed to the same limit as the original field, and markup is stored as plain text.
    long = host.put("/api/admin/listings/stays/1", json={"translations": {"it": {"hotel_name": "x" * 500}}}).get_json()
    assert len(long["translations"]["it"]["hotel_name"]) == 120
    assert host.put("/api/admin/listings/stays/1", json={"translations": None}).get_json()["translations"] == {}

    guide = host.post("/api/admin/listings/guides", json={**GUIDE, "translations": {"fr": {"headline": "Butrint et le sud, à pied", "bio": "Né à Sarandë."}}}).get_json()
    assert client.get(f"/api/guides/{guide['slug']}").get_json()["translations"]["fr"]["bio"] == "Né à Sarandë."
    assert host.put(f"/api/admin/listings/guides/{guide['id']}", json={"translations": {"fr": {"name": "X"}}}).status_code == 400

    # A partner's translations are reviewed like the rest of their text.
    owner = account(app, "owner@bluebay.example")
    business = owner.post("/api/partner/business", json={"name": "Blue Bay", "city": "Ksamil", "description": "Family-run since 2012.",
                                                          "translations": {"de": {"tagline": "Familienbetrieb", "description": "Seit 2012 in Familienhand."}}})
    assert business.status_code == 201 and business.get_json()["translations"]["de"]["tagline"] == "Familienbetrieb"
    approve(host, "business", business.get_json()["id"])
    stay = owner.post("/api/partner/listings/stays", json={**STAY, "translations": {"sq": {"description": "Studio e qetë me tarracë."}}}).get_json()
    approve(host, "stays", stay["id"])
    assert client.get(f"/api/hotels/{stay['id']}").get_json()["translations"] == {"sq": {"description": "Studio e qetë me tarracë."}}
    edited = owner.put(f"/api/partner/listings/stays/{stay['id']}", json={"translations": {"sq": {"description": "Tekst i ri."}}}).get_json()
    assert edited["has_pending_changes"]
    assert client.get(f"/api/hotels/{stay['id']}").get_json()["translations"]["sq"]["description"] == "Studio e qetë me tarracë."
    assert client.get("/api/businesses/blue-bay").get_json()["business"]["translations"]["de"]["description"] == "Seit 2012 in Familienhand."
    assert owner.post("/api/partner/listings/stays", json={**STAY, "translations": {"sq": {"business_id": "1"}}}).status_code == 400

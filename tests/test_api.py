from datetime import date, timedelta


def future(days):
    return (date.today() + timedelta(days=days)).isoformat()


def test_health_and_config(client):
    assert client.get("/api/meta/health").json["database"] is True
    cfg = client.get("/api/meta/config").json
    assert cfg["payments"]["enabled"] is False
    assert "STRIPE_SECRET_KEY" not in str(cfg)


def test_destinations_and_filters(client):
    all_ = client.get("/api/destinations").json["destinations"]
    beaches = client.get("/api/destinations?category=beach").json["destinations"]
    assert len(all_) > len(beaches) > 3
    assert client.get("/api/destinations?category=nope").status_code == 400
    detail = client.get("/api/destinations/butrint").json
    assert detail["unesco"] and detail["connections"]
    assert client.get("/api/destinations/atlantis").status_code == 404


def test_links_are_prefilled(client):
    links = client.get(f"/api/destinations/sarande/links?checkin={future(30)}&checkout={future(33)}&adults=3").json
    booking = links["stay"][0]["url"]
    assert booking.startswith("https://www.booking.com/") and "group_adults=3" in booking
    assert any(l["kind"] == "ferry" for l in links["transport"])


def test_route_connect_and_via(client):
    r = client.get("/api/routes/connect?from=tirana&to=ksamil&via=berat").json
    assert r["stops"] == ["tirana", "berat", "ksamil"]
    assert r["directions_url"].startswith("https://www.google.com/maps/dir/")
    assert client.get("/api/routes/connect?from=tirana").status_code == 400


def test_itineraries(client):
    its = client.get("/api/itineraries").json["itineraries"]
    assert {i["days_count"] for i in its} >= {7, 10, 14}
    ten = client.get("/api/itineraries/10-day-explorer").json
    assert len(ten["days"]) == 10 and ten["stats"]["km_min"] > 500


def test_timeline_endpoint_validates(client):
    ok = client.post("/api/planner/timeline", json={"pace": "relaxed", "start_date": future(60),
                                                     "days": [{"stops": ["sarande", "butrint", "ksamil"]}]})
    assert ok.status_code == 200 and ok.json["days"][0]["events"]
    bad = client.post("/api/planner/timeline", json={"days": [{"stops": ["sarande", "<script>"]}]})
    assert bad.status_code == 400


def test_budget_endpoint(client):
    r = client.post("/api/planner/budget", json={"travelers": 2, "days": 7, "style": "comfort", "month": 9, "car_days": 5})
    assert r.status_code == 200 and r.json["total"][0] < r.json["total"][1]
    assert client.post("/api/planner/budget", json={"travelers": 2, "days": 3, "car_days": 9}).status_code == 400


def test_trip_share_edit_key_required(client):
    body = {"title": "Our Riviera week", "start_date": future(40), "days": [{"stops": ["sarande", "ksamil"]}]}
    created = client.post("/api/trips", json=body)
    assert created.status_code == 201
    sid, key = created.json["share_id"], created.json["edit_key"]
    assert "edit_key" not in client.get(f"/api/trips/{sid}").json
    body["title"] = "Hijacked"
    assert client.put(f"/api/trips/{sid}", json=body).status_code == 403
    assert client.put(f"/api/trips/{sid}", json=body, headers={"X-Edit-Key": "wrong"}).status_code == 403
    assert client.put(f"/api/trips/{sid}", json=body, headers={"X-Edit-Key": key}).json["title"] == "Hijacked"
    ics = client.get(f"/api/trips/{sid}/calendar.ics")
    assert ics.status_code == 200 and b"BEGIN:VCALENDAR" in ics.data


def test_guides_directory_and_request_flow(client):
    guides = client.get("/api/guides/").json
    assert len(guides["guides"]) >= 6 and "English" in guides["facets"]["languages"]
    assert all(g["is_sample"] for g in guides["guides"])
    boat = client.get("/api/guides/?specialty=Boat").json["guides"]
    assert [g["slug"] for g in boat] == ["dritan-boat"]

    req = {"tour_date": future(20), "duration": "full", "group_size": 4, "name": "Ana Traveller",
           "email": "ana@example.com", "language": "English", "stops": ["butrint", "ksamil"]}
    r = client.post("/api/guides/arben-history/requests", json=req)
    assert r.status_code == 201
    assert r.json["quoted_price"] == 160.0 and r.json["email_masked"].startswith("a•••")
    # Same date is now taken.
    assert client.post("/api/guides/arben-history/requests", json=req).status_code == 409
    avail = client.get(f"/api/guides/arben-history/availability?month={future(20)[:7]}").json
    assert future(20) in avail["busy"]
    # Group above the guide's maximum is rejected.
    big = {**req, "tour_date": future(21), "group_size": 40}
    assert client.post("/api/guides/arben-history/requests", json=big).status_code == 400


def test_booking_price_is_server_side_and_overlaps_rejected(client):
    hotel = client.get("/api/hotels/").json[0]
    body = {"hotel_id": hotel["id"], "start_date": future(10), "end_date": future(13), "guest_count": 2,
            "guest_name": "Ana Traveller", "guest_email": "ana@example.com",
            "amount_cents": 1, "total_cost": 0.01}  # tampering attempts are ignored
    r = client.post("/api/bookings/", json=body)
    assert r.status_code == 201
    b = r.json["booking"]
    assert b["total_cost"] == hotel["price_per_night"] * 3
    assert b["status"] == "requested"  # no payment provider configured in tests
    assert "id" not in b and "guest_email" not in b and len(b["reference"]) == 14
    overlap = {**body, "start_date": future(12), "end_date": future(15)}
    assert client.post("/api/bookings/", json=overlap).status_code == 409
    assert client.get(f"/api/bookings/{b['reference']}").json["guest_email_masked"].startswith("a•••")
    assert client.get("/api/bookings/1").status_code == 404  # sequential ids don't work


def test_booking_validation(client):
    hotel = client.get("/api/hotels/").json[0]
    base = {"hotel_id": hotel["id"], "guest_name": "A", "guest_email": "a@example.com"}
    past = client.post("/api/bookings/", json={**base, "start_date": future(-3), "end_date": future(2), "guest_count": 1})
    assert past.status_code == 400
    crowd = client.post("/api/bookings/", json={**base, "start_date": future(5), "end_date": future(6), "guest_count": 30})
    assert crowd.status_code == 400 and "guest_count" in crowd.json["fields"]
    email = client.post("/api/bookings/", json={**base, "guest_email": "not-an-email", "start_date": future(5),
                                                 "end_date": future(6), "guest_count": 1})
    assert email.json["fields"]["guest_email"]


def test_old_confirm_endpoint_is_gone(client):
    assert client.patch("/api/bookings/1/confirm", json={}).status_code in (404, 405)
    assert client.post("/api/create-payment-intent", json={"amount": 1}).status_code in (404, 405)


def test_non_json_writes_rejected(client):
    r = client.post("/api/contact/", data="name=x&email=y", content_type="application/x-www-form-urlencoded")
    assert r.status_code == 415


def test_security_headers(client):
    r = client.get("/api/meta/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert "frame-ancestors 'none'" in r.headers["Content-Security-Policy"]
    assert r.headers["Cache-Control"] == "no-store"


def test_cors_allowlist(client):
    evil = client.get("/api/destinations", headers={"Origin": "https://evil.example"})
    assert "Access-Control-Allow-Origin" not in evil.headers
    good = client.get("/api/destinations", headers={"Origin": "http://localhost:5173"})
    assert good.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"


def test_admin_endpoints_require_admin(client, admin):
    assert client.get("/api/admin/bookings").status_code == 401
    assert client.get("/api/admin/bookings", headers={"Authorization": "Bearer someone"}).status_code == 403
    assert client.get("/api/admin/bookings", headers=admin).status_code == 200
    r = client.post("/api/hotels/", json={"hotel_name": "X", "address": "Y", "city": "Z", "price_per_night": 50})
    assert r.status_code == 401


def test_webhook_requires_signature(client):
    r = client.post("/api/webhooks/stripe", data=b"{}", headers={"Stripe-Signature": "t=1,v1=bad"})
    assert r.status_code == 400


def test_concierge_offline_engine(client):
    def ask(q):
        return client.post("/api/concierge/", json={"messages": [{"role": "user", "content": q}]}).json

    route = ask("How long is the drive from Tirana to Ksamil?")
    assert route["engine"] == "offline" and "Tirana" in route["text"] and route["cards"][0]["type"] == "route"
    money = ask("Budget for 3 people, 10 days in August, cheap")
    assert "€" in money["text"] and money["cards"][0]["inputs"]["travelers"] == 3
    assert "112" in ask("emergency number?")["text"]
    assert ask("Show me local guides")["cards"]
    assert ask("Plan 10 days")["cards"][0]["slug"] == "10-day-explorer"


def test_concierge_validates_history(client):
    assert client.post("/api/concierge/", json={"messages": []}).status_code == 400
    assert client.post("/api/concierge/", json={"messages": [{"role": "system", "content": "x"}]}).status_code == 400
    long = client.post("/api/concierge/", json={"messages": [{"role": "user", "content": "Ksamil " * 5000}]})
    assert long.status_code == 200


def test_unknown_api_route_is_json_404(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404 and r.is_json

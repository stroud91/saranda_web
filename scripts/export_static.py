"""Export the API's read-only answers and engine data for static hosting.

The frontend can run with no backend at all (e.g. uploaded straight to a
Namecheap ``public_html``). In that mode it serves these pre-generated API
responses and runs JavaScript ports of the route, timeline, budget, quote and
offline-concierge engines.

This script produces two files from the real Flask app:

- ``travago-tour-app/src/data/static-api.json`` – GET responses captured from
  the API plus the raw data and constants the JS engines need.
- ``travago-tour-app/src/engine/parity.fixtures.json`` – inputs and the Python
  engines' outputs; the frontend test suite checks the JS ports match exactly.

Run from the repository root:  python scripts/export_static.py

The seeded sample guides are left out unless SHOW_SAMPLE_GUIDES=true is set,
exactly like the live site; the fixtures always carry them for the tests.
``tests/test_static_export.py`` fails if the committed files are out of date.
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

STATIC_API = os.path.join(ROOT, "travago-tour-app", "src", "data", "static-api.json")
FIXTURES = os.path.join(ROOT, "travago-tour-app", "src", "engine", "parity.fixtures.json")


def _app():
    from app import create_app
    from app.config import TestConfig, _bool

    class ExportConfig(TestConfig):
        LIVE_DATA_ENABLED = False
        SHOW_SAMPLE_GUIDES = _bool("SHOW_SAMPLE_GUIDES", False)
        WHATSAPP_NUMBER = ""
        CONTACT_EMAIL = "bookings@megrooms.com"

    return create_app(ExportConfig)


def build():
    from app.data import (CATEGORIES, DESTINATIONS, FALLBACK_SPEED_KMH, REGIONS, ROAD_FACTOR, ROUTE_LEGS,
                          essentials)
    from app.extensions import db
    from app.seeds.car_rentals import seed_car_rentals
    from app.seeds.guides import seed_guides
    from app.seeds.hotels import seed_hotels
    from app.seeds.tours import seed_tours
    from app.services import budget, knowledge, live, timeline

    app = _app()
    with app.app_context():
        db.create_all()
        seed_hotels()
        seed_guides()
        seed_tours()
        seed_car_rentals()
        client = app.test_client()

        def get(path):
            r = client.get("/api" + path)
            assert r.status_code == 200, (path, r.status_code, r.get_data(as_text=True)[:200])
            return r.get_json()

        def post(path, body):
            r = client.post("/api" + path, json=body)
            return {"status": r.status_code, "body": r.get_json()}

        paths = ["/meta/config", "/destinations", "/itineraries", "/essentials", "/routes/graph",
                 "/guides/", "/hotels/", "/tours/", "/car_rentals/"]
        paths += [f"/destinations/{d['slug']}" for d in DESTINATIONS]
        paths += [f"/destinations/{d['slug']}/links" for d in DESTINATIONS]
        paths += [f"/itineraries/{s}" for s in [i["slug"] for i in get("/itineraries")["itineraries"]]]
        guides = get("/guides/")["guides"]
        paths += [f"/guides/{g['slug']}" for g in guides]
        paths += [f"/hotels/{h['id']}" for h in get("/hotels/")]
        responses = {p: get(p) for p in paths}
        # Static hosting has no server-side configuration.
        responses["/meta/config"].update({
            "payments": {"enabled": False, "publishable_key": None, "deposit_percent": 100,
                         "methods": [{"id": "request", "label": "Request to book", "currency": "EUR",
                                      "note": "The host confirms your dates; you pay on arrival."}]},
            # Accounts and online payments need the Python app (they use a database and secret keys).
            "auth": {"enabled": False, "email": False},
            "concierge": {"enabled": True, "ai": False},
            "google_places": False,
            "mode": "static",
        })

        static_api = {
            "version": 1,
            "responses": responses,
            "data": {
                "destinations": DESTINATIONS,
                "regions": REGIONS,
                "categories": CATEGORIES,
                "route_legs": ROUTE_LEGS,
                "fallback_speed_kmh": FALLBACK_SPEED_KMH,
                "road_factor": ROAD_FACTOR,
                "aliases": knowledge.ALIASES,
                "climate": essentials.CLIMATE_SARANDE,
                "road_trip_tip": essentials.ROAD_TRIP_TIP,
                "save_money": essentials.SAVE_MONEY,
                "price_note": essentials.PRICE_NOTE,
                # API responses are key-sorted JSON; the concierge text follows source order.
                "packing_order": list(essentials.PACKING),
                "fallback_eur_all": live.FALLBACK_EUR_ALL,
                "wmo": {str(k): list(v) for k, v in live.WMO.items()},
                "timeline": {
                    "paces": timeline.PACES,
                    "long_drive_min": timeline.LONG_DRIVE_MIN,
                    "major_sight_latest": timeline.MAJOR_SIGHT_LATEST,
                    "late_end": timeline.LATE_END,
                    "evening": timeline.EVENING,
                    "lunch_earliest": timeline.LUNCH_EARLIEST,
                    "lunch_from": timeline.LUNCH_FROM,
                    "lunch_until": timeline.LUNCH_UNTIL,
                    "peak_months": sorted(timeline.PEAK_MONTHS),
                    "outdoor": sorted(timeline.OUTDOOR),
                },
                "budget": {
                    "tiers": essentials.BUDGET_TIERS,
                    "split": budget.SPLIT,
                    "stay_season": {str(k): v for k, v in budget.STAY_SEASON.items()},
                    "other_season": {str(k): v for k, v in budget.OTHER_SEASON.items()},
                    "car_per_day": list(budget.CAR_PER_DAY),
                    "car_peak": budget.CAR_PEAK,
                    "fuel_per_driving_day": list(budget.FUEL_PER_DRIVING_DAY),
                    "boat_day_pp": list(budget.BOAT_DAY_PP),
                    "private_boat": list(budget.PRIVATE_BOAT),
                },
            },
        }

        # ---- Parity fixtures: same inputs through the Python engines ----
        slugs = [d["slug"] for d in DESTINATIONS]
        hubs = ["sarande", "tirana", "himare", "gjirokaster", "kakome", "theth", "corfu"]
        connect_cases = []
        for a in hubs:
            for b in slugs:
                if a != b:
                    connect_cases.append({"query": f"from={a}&to={b}"})
        connect_cases += [
            {"query": "from=tirana&to=ksamil&via=berat"},
            {"query": "from=sarande&to=himare&via=blue-eye,gjirokaster"},
            {"query": "from=sarande&to=gjipe&modes=drive"},
            {"query": "from=sarande&to=corfu&modes=drive,ferry"},
            {"query": "from=vlore&to=kroreza&modes=drive"},
            {"query": "from=sarande&to=sarande"},
            {"query": "from=sarande&to=nowhere"},
            {"query": "from=sarande&to=ksamil&modes=plane"},
            {"query": "from=Bad Slug&to=ksamil"},
            {"query": "to=ksamil"},
        ]
        for c in connect_cases:
            r = client.get("/api/routes/connect?" + c["query"])
            c["status"], c["body"] = r.status_code, r.get_json()

        timeline_cases = []
        for it in get("/itineraries")["itineraries"]:
            detail = responses[f"/itineraries/{it['slug']}"]
            days = [{"stops": d["stops"], "start_time": d["start_time"]} for d in detail["days"]]
            for pace in ("relaxed", "balanced", "packed"):
                for start in (None, "2027-08-01", "2027-01-15"):
                    body = {"pace": pace, "days": days}
                    if start:
                        body["start_date"] = start
                    timeline_cases.append({"input": body, **post("/planner/timeline", body)})
        timeline_cases += [
            {"input": body, **post("/planner/timeline", body)} for body in (
                {"days": [{"stops": ["sarande"]}]},
                {"days": [{"stops": ["berat"], "start_time": "10:00"}], "pace": "packed"},
                {"days": [{"stops": ["sarande", "theth"]}], "start_date": "2027-02-01"},
                {"days": [{"stops": ["tirana", "sarande", "kakome", "corfu"], "start_time": "06:30"}]},
                {"days": [{"stops": ["sarande", "unknown-place"]}]},
                {"days": []},
                {"pace": "turbo", "days": [{"stops": ["sarande"]}]},
            )
        ]

        budget_cases = []
        for style in ("budget", "comfort", "premium"):
            for travelers in (1, 2, 3, 5, 11):
                for month in (1, 6, 8):
                    body = {"travelers": travelers, "days": 7, "style": style, "month": month,
                            "car_days": 3 if travelers > 2 else 0, "boat_days": 1 if month == 8 else 0}
                    budget_cases.append({"input": body, **post("/planner/budget", body)})
        budget_cases += [
            {"input": body, **post("/planner/budget", body)} for body in (
                {"travelers": 4, "days": 10, "style": "comfort", "month": 7, "car_days": 10, "boat_days": 2,
                 "private_boat": True, "guide_day_rate": 160, "guide_days": 2},
                {"travelers": 2, "days": 3, "car_days": 9},
                {"travelers": 0, "days": 3},
                {"travelers": 2, "days": 14},
            )
        ]

        hotels = get("/hotels/")
        quote_cases = []
        for h in hotels[:3]:
            for nights in (1, 3, 8):
                # Far-future dates so "check-in can't be in the past" never trips.
                body = {"hotel_id": h["id"], "start_date": "2035-06-10",
                        "end_date": f"2035-06-{10 + nights:02d}", "guest_count": 2}
                quote_cases.append({"input": body, **post("/bookings/quote", body)})
        h = hotels[0]
        quote_cases += [
            {"input": body, **post("/bookings/quote", body)} for body in (
                {"hotel_id": h["id"], "start_date": "2035-06-10", "end_date": "2035-06-10", "guest_count": 2},
                {"hotel_id": h["id"], "start_date": "2035-06-10", "end_date": "2035-09-10", "guest_count": 2},
                {"hotel_id": h["id"], "start_date": "2035-06-10", "end_date": "2035-06-12", "guest_count": 41},
                {"hotel_id": h["id"], "start_date": "2035-06-10", "end_date": "2035-06-12",
                 "guest_count": h["max_guests"] + 1},
                {"hotel_id": 9999, "start_date": "2035-06-10", "end_date": "2035-06-12", "guest_count": 2},
                {"hotel_id": h["id"], "start_date": "2001-06-10", "end_date": "2001-06-12", "guest_count": 2},
                {"hotel_id": h["id"], "start_date": "10/06/2035", "end_date": "2035-06-12", "guest_count": 2},
                {"start_date": "2035-06-10"},
            )
        ]

        questions = [
            "How long is the drive from Tirana to Ksamil?", "How far from Sarandë to Gjirokastra?",
            "ferry from saranda to corfu", "Distance between Berat and Himara", "route from Vlora to Theth",
            "Budget for 3 people, 10 days in August, cheap", "Budget for 2 people 7 days in August",
            "how much is a luxury week", "What does it cost on a tight budget for 1 person 5 nights in march?",
            "Show me local guides", "Plan 10 days", "plan a week", "what itinerary for 14 days",
            "What should I eat?", "emergency number?", "what should I pack", "Corfu ferry tips",
            "Do I need cash or euro?", "is driving safe?", "best beaches", "When is the best time to go?",
            "Tell me about Butrint", "Ksamil", "blue eye", "hello", "Mirëdita, si jeni?",
        ]
        concierge_cases = []
        for q in questions:
            r = post("/concierge/", {"messages": [{"role": "user", "content": q}]})
            concierge_cases.append({"input": q, **r})

        # The guide directory with the sample profiles switched on, so the frontend
        # tests cover filtering, requests and the concierge's answer either way.
        shown = app.config["SHOW_SAMPLE_GUIDES"]
        app.config["SHOW_SAMPLE_GUIDES"] = True
        sample_list = get("/guides/")
        sample_guides = {
            "responses": {"/guides/": sample_list,
                          **{f"/guides/{g['slug']}": get(f"/guides/{g['slug']}") for g in sample_list["guides"]}},
            "concierge": {"input": "Show me local guides",
                          **post("/concierge/", {"messages": [{"role": "user", "content": "Show me local guides"}]})},
        }
        app.config["SHOW_SAMPLE_GUIDES"] = shown

        fixtures = {"connect": connect_cases, "timeline": timeline_cases, "budget": budget_cases,
                    "quote": quote_cases, "concierge": concierge_cases, "sample_guides": sample_guides}
        db.session.remove()
        db.drop_all()
    return static_api, fixtures


def dumps(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"


def main():
    static_api, fixtures = build()
    for path, obj in ((STATIC_API, static_api), (FIXTURES, fixtures)):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(dumps(obj))
        print(f"wrote {os.path.relpath(path, ROOT)} ({os.path.getsize(path) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()

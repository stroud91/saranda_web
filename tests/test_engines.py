from datetime import date

import pytest

from app.data import DESTINATION_INDEX, ITINERARIES, ROUTE_LEGS
from app.services import budget, routing, timeline
from app.services.knowledge import find_places


def test_every_leg_and_itinerary_stop_is_a_known_destination():
    for leg in ROUTE_LEGS:
        assert leg["from"] in DESTINATION_INDEX and leg["to"] in DESTINATION_INDEX
        assert leg["min_minutes"] <= leg["max_minutes"]
    for it in ITINERARIES:
        assert len(it["days"]) == it["days_count"]
        for day in it["days"]:
            assert all(s in DESTINATION_INDEX for s in day["stops"]), day


def test_every_destination_is_reachable_from_sarande():
    for slug in DESTINATION_INDEX:
        result = routing.connect("sarande", slug)
        assert "straight-line" not in result["totals"]["sources"], slug


def test_planner_leg_is_used_directly():
    r = routing.connect("tirana", "berat")
    assert r["hops"] == ["tirana", "berat"]
    assert (r["totals"]["min_minutes"], r["totals"]["max_minutes"]) == (90, 120)
    assert r["legs"][0]["source"] == "planner"


def test_multi_hop_connection_tirana_to_ksamil():
    r = routing.connect("tirana", "ksamil")
    assert r["hops"][0] == "tirana" and r["hops"][-1] == "ksamil"
    assert len(r["hops"]) >= 3
    assert 240 <= r["totals"]["min_minutes"] <= r["totals"]["max_minutes"]


def test_reverse_direction_is_symmetric():
    a, b = routing.connect("sarande", "himare"), routing.connect("himare", "sarande")
    assert a["totals"]["min_minutes"] == b["totals"]["min_minutes"]


def test_drive_only_mode_avoids_boats():
    r = routing.connect("sarande", "gjipe", modes=frozenset({"drive"}))
    assert all(l["mode"] == "drive" for l in r["legs"])


def test_unknown_place_raises():
    with pytest.raises(routing.UnknownPlace):
        routing.connect("sarande", "atlantis")


def test_gjirokaster_day_matches_planner_rhythm():
    res = timeline.build_day(["sarande", "blue-eye", "gjirokaster", "sarande"], start_time="08:30")
    kinds = [e["type"] for e in res["events"]]
    assert kinds[0] == "depart" and kinds.count("lunch") == 1 and kinds.count("visit") >= 2
    assert kinds[-1] == "arrive"
    assert res["summary"]["end"] < "21:00"


def test_long_day_warns():
    res = timeline.build_day(["tirana", "sarande"], start_time="09:00")
    assert any(w["code"] == "long-drive" for w in res["warnings"])


def test_peak_month_heat_and_crowd_warnings():
    res = timeline.build_day(["sarande", "butrint", "ksamil"], start_time="11:00", travel_date=date(2027, 8, 1))
    codes = {w["code"] for w in res["warnings"]}
    assert "crowds" in codes and "heat" in codes


def test_bad_start_time_rejected():
    with pytest.raises(ValueError):
        timeline.build_day(["sarande"], start_time="25:00")


def test_budget_peak_costs_more_and_solo_costs_more_per_person():
    june = budget.estimate(travelers=2, days=7, style="comfort", month=6)
    aug = budget.estimate(travelers=2, days=7, style="comfort", month=8)
    solo = budget.estimate(travelers=1, days=7, style="comfort", month=6)
    assert aug["total"][1] > june["total"][1]
    assert solo["per_person"][0] > june["per_person"][0]
    assert june["per_person_per_day"][0] >= 50  # stays close to the planner's €70–130 comfort tier


def test_budget_extras_add_lines():
    est = budget.estimate(travelers=4, days=5, style="budget", car_days=3, boat_days=1, guide_day_rate=150, guide_days=1)
    keys = {l["key"] for l in est["lines"]}
    assert {"car", "fuel", "boat", "guide", "transport"} <= keys


def test_find_places_handles_diacritics_and_aliases():
    assert find_places("How far is Sarandë from Gjirokastra?") == ["sarande", "gjirokaster"]
    assert find_places("blue eye then ksamil") == ["blue-eye", "ksamil"]


def test_evening_arrival_at_base_is_check_in():
    res = timeline.build_day(["sarande", "bunec", "borsh", "qeparo", "porto-palermo", "himare"])
    last = res["events"][-1]
    assert last["type"] == "arrive" and "Check in" in last["title"]
    assert "+1d" not in res["summary"]["end"]

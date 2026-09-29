"""Read-only knowledge functions shared by the API, the Claude concierge
tools and the offline answer engine."""
import re
import unicodedata

from app.data import (CATEGORIES, CORFU_COMBOS, DAILY_RHYTHM, DESTINATIONS, ITINERARIES, ITINERARY_INDEX,
                      REGIONS, essentials)
from app.services import routing

ALIASES = {
    "saranda": "sarande", "sarande": "sarande", "sarandë": "sarande",
    "ksamil": "ksamil", "butrint": "butrint", "butrinti": "butrint",
    "blue eye": "blue-eye", "syri i kalter": "blue-eye", "syri": "blue-eye",
    "gjirokaster": "gjirokaster", "gjirokastra": "gjirokaster", "gjirokastër": "gjirokaster",
    "berat": "berat", "tirana": "tirana", "tirane": "tirana", "durres": "durres", "durrës": "durres",
    "himara": "himare", "himare": "himare", "dhermi": "dhermi", "vlora": "vlore", "vlore": "vlore",
    "llogara": "llogara", "borsh": "borsh", "qeparo": "qeparo", "porto palermo": "porto-palermo",
    "jale": "jale", "jala": "jale", "gjipe": "gjipe", "palase": "palase", "palasa": "palase",
    "bunec": "bunec", "lukove": "bunec", "kakome": "kakome", "kroreza": "kroreza", "krorez": "kroreza",
    "grama": "grama-bay", "apollonia": "apollonia", "kruja": "kruje", "kruje": "kruje",
    "shkoder": "shkoder", "shkodra": "shkoder", "theth": "theth", "corfu": "corfu", "kerkyra": "corfu",
    "lekures": "lekures-castle", "lekuresi": "lekures-castle", "mesopotam": "mesopotam",
    "airport": "tirana-airport", "tia": "tirana-airport",
}


def normalize(text):
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def find_places(text):
    """Destination slugs mentioned in free text, in order of appearance."""
    t = normalize(text)
    hits = []
    for alias, slug in sorted(ALIASES.items(), key=lambda kv: -len(kv[0])):
        for m in re.finditer(r"\b" + re.escape(normalize(alias)) + r"\b", t):
            hits.append((m.start(), slug))
            t = t[:m.start()] + " " * len(m.group()) + t[m.end():]
    seen, out = set(), []
    for _, slug in sorted(hits):
        if slug not in seen:
            seen.add(slug)
            out.append(slug)
    return out


def destination_card(d):
    return {k: d[k] for k in ("slug", "name", "region", "category", "summary", "lat", "lng",
                              "visit_min", "visit_max", "best_for", "unesco", "scene", "access", "tags")}


def search_destinations(query=None, category=None, region=None, limit=12):
    q = normalize(query or "")
    out = []
    for d in DESTINATIONS:
        if category and d["category"] != category:
            continue
        if region and d["region"] != region:
            continue
        if q:
            hay = normalize(" ".join([d["name"], d["summary"], " ".join(d["tags"]), d["best_for"]]))
            if not all(word in hay for word in q.split()):
                continue
        out.append(destination_card(d))
    return out[:limit]


def destination_detail(slug):
    d = routing.place(slug)
    return {**d, "region_name": REGIONS[d["region"]]["name"], "category_label": CATEGORIES[d["category"]]["label"],
            "connections": routing.nearby(slug)}


def itinerary_summary(it):
    stops = []
    for day in it["days"]:
        for s in day["stops"]:
            if not stops or stops[-1] != s:
                stops.append(s)
    route = routing.route_through(stops)
    # Departure airports are where the trip ends, not a place you stay.
    overnights = [d["overnight"] for d in it["days"] if routing.place(d["overnight"])["category"] != "hub"]
    return {
        "slug": it["slug"], "title": it["title"], "days_count": it["days_count"], "tagline": it["tagline"],
        "audience": it["audience"], "pace": it["pace"], "transport": it["transport"], "color": it["color"],
        "recommended": it.get("recommended", False),
        "bases": sorted(set(overnights), key=lambda s: stops.index(s) if s in stops else 99),
        "stats": {"km_min": route["totals"]["km_min"], "km_max": route["totals"]["km_max"],
                  "drive_minutes_min": route["totals"]["drive_minutes_min"],
                  "drive_minutes_max": route["totals"]["drive_minutes_max"],
                  "hotel_changes": len(set(overnights)),
                  "stops": len(set(stops))},
        "path": route["path"],
    }


def list_itineraries():
    return [itinerary_summary(it) for it in ITINERARIES]


def itinerary_detail(slug):
    it = ITINERARY_INDEX.get(slug)
    if not it:
        return None
    return {**it, **itinerary_summary(it)}


ESSENTIAL_TOPICS = {
    "seasons": lambda: {"seasons": essentials.SEASONS, "climate": essentials.CLIMATE_SARANDE},
    "money": lambda: {"money": essentials.MONEY},
    "booking": lambda: {"strategy": essentials.BOOKING_STRATEGY, "final_check": essentials.FINAL_CHECK},
    "emergency": lambda: {"numbers": essentials.EMERGENCY_NUMBERS},
    "budget": lambda: {"tiers": essentials.BUDGET_TIERS, "categories": essentials.BUDGET_CATEGORIES,
                       "save_money": essentials.SAVE_MONEY, "note": essentials.PRICE_NOTE},
    "food": lambda: {"dishes": essentials.FOOD, "restaurant_tip": essentials.RESTAURANT_TIP},
    "beaches": lambda: {"beaches": essentials.BEACHES, "rule": essentials.BEACH_RULE, "boat_day": essentials.BOAT_DAY_IDEA},
    "packing": lambda: {"packing": essentials.PACKING},
    "safety": lambda: {"safety": essentials.SAFETY, "daily_rhythm": DAILY_RHYTHM, "road_trip_tip": essentials.ROAD_TRIP_TIP},
    "corfu": lambda: {**essentials.CORFU, "combos": CORFU_COMBOS},
}


def essentials_topic(topic):
    fn = ESSENTIAL_TOPICS.get(topic)
    return fn() if fn else None


def all_essentials():
    return {
        "edition": essentials.EDITION,
        "last_reviewed": essentials.LAST_REVIEWED,
        "quick_start": essentials.QUICK_START,
        "seasons": essentials.SEASONS,
        "climate": essentials.CLIMATE_SARANDE,
        "money": essentials.MONEY,
        "booking_strategy": essentials.BOOKING_STRATEGY,
        "emergency": essentials.EMERGENCY_NUMBERS,
        "budget_tiers": essentials.BUDGET_TIERS,
        "budget_categories": essentials.BUDGET_CATEGORIES,
        "save_money": essentials.SAVE_MONEY,
        "food": essentials.FOOD,
        "restaurant_tip": essentials.RESTAURANT_TIP,
        "beaches": essentials.BEACHES,
        "beach_rule": essentials.BEACH_RULE,
        "boat_day": essentials.BOAT_DAY_IDEA,
        "packing": essentials.PACKING,
        "safety": essentials.SAFETY,
        "daily_rhythm": DAILY_RHYTHM,
        "road_trip_tip": essentials.ROAD_TRIP_TIP,
        "corfu": {**essentials.CORFU, "combos": CORFU_COMBOS},
        "final_check": essentials.FINAL_CHECK,
        "price_note": essentials.PRICE_NOTE,
        "disclaimer": essentials.DISCLAIMER,
        "sources": essentials.SOURCES,
    }

"""Road, ferry and boat connections between destinations.

``source="planner"`` legs come straight from the planner's *Driving Distances
& Road Planning* table. ``source="estimate"`` legs are companion estimates
that fill the gaps between planner stops so any two places can be connected.

All times are planning ranges in minutes, not guaranteed journey times:
summer traffic, road works, weather and stops change them significantly.
"""


def _leg(a, b, km, minutes, *, mode="drive", source="estimate", note=""):
    km_min, km_max = km if isinstance(km, tuple) else (km, km)
    return {
        "from": a,
        "to": b,
        "km_min": km_min,
        "km_max": km_max,
        "min_minutes": minutes[0],
        "max_minutes": minutes[1],
        "mode": mode,
        "source": source,
        "note": note,
    }


P = "planner"

ROUTE_LEGS = [
    # --- Planner table (authoritative ranges) ---------------------------
    _leg("tirana", "durres", 35, (45, 75), source=P),
    _leg("tirana", "berat", 100, (90, 120), source=P),
    _leg("tirana", "gjirokaster", 225, (180, 240), source=P),
    _leg("tirana", "sarande", (275, 300), (270, 360), source=P,
         note="Long day — break it with Berat or Gjirokastër if you can."),
    _leg("berat", "gjirokaster", 180, (180, 210), source=P, note="Scenic drive south."),
    _leg("gjirokaster", "sarande", (55, 65), (60, 90), source=P),
    _leg("sarande", "ksamil", 15, (25, 40), source=P),
    _leg("sarande", "butrint", 20, (30, 45), source=P),
    _leg("sarande", "blue-eye", (35, 40), (45, 60), source=P),
    _leg("sarande", "himare", (55, 65), (75, 105), source=P, note="Coastal road with bends — take it slow."),
    _leg("himare", "vlore", (75, 90), (90, 150), source=P, note="Crosses the Llogara Pass."),
    _leg("vlore", "tirana", 155, (120, 150), source=P),

    # --- Companion estimates -------------------------------------------
    _leg("tirana", "tirana-airport", 17, (20, 35)),
    _leg("tirana-airport", "durres", 30, (30, 45)),
    _leg("durres", "berat", 95, (90, 120)),
    _leg("tirana", "kruje", 32, (40, 60)),
    _leg("tirana", "shkoder", 100, (105, 135)),
    _leg("tirana-airport", "shkoder", 90, (90, 120)),
    _leg("shkoder", "theth", 75, (150, 180), note="Mountain road — check conditions and season."),
    _leg("berat", "apollonia", 60, (70, 90)),
    _leg("apollonia", "vlore", 35, (40, 55)),
    _leg("durres", "vlore", 120, (90, 120)),
    _leg("vlore", "llogara", 40, (50, 70), note="Switchbacks up to ~1,000 m."),
    _leg("llogara", "palase", 12, (20, 30), note="Switchbacks down to the coast."),
    _leg("palase", "dhermi", 6, (10, 15)),
    _leg("dhermi", "jale", 5, (10, 15)),
    _leg("jale", "gjipe", 3, (30, 50), note="Final stretch is a walk down to the bay."),
    _leg("jale", "himare", 10, (15, 25)),
    _leg("himare", "porto-palermo", 8, (12, 20)),
    _leg("porto-palermo", "qeparo", 6, (10, 15)),
    _leg("qeparo", "borsh", 5, (10, 15)),
    _leg("borsh", "bunec", 10, (15, 25)),
    _leg("bunec", "sarande", 25, (35, 50)),
    _leg("sarande", "lekures-castle", 4, (10, 15)),
    _leg("sarande", "mesopotam", 15, (20, 30)),
    _leg("ksamil", "butrint", 4, (8, 12)),
    _leg("blue-eye", "gjirokaster", 40, (45, 60)),
    _leg("blue-eye", "mesopotam", 22, (25, 35)),

    # --- Sea connections -------------------------------------------------
    _leg("sarande", "corfu", 27, (30, 90), mode="ferry",
         note="Seasonal schedules. Check the operator timetable, vehicle rules and port check-in time before booking."),
    _leg("sarande", "kakome", 15, (40, 60), mode="boat", note="Boat excursion; sea conditions decide the route."),
    _leg("sarande", "kroreza", 14, (40, 60), mode="boat", note="Boat excursion; sea conditions decide the route."),
    _leg("kakome", "kroreza", 1, (5, 10), mode="boat"),
    _leg("himare", "gjipe", 9, (25, 40), mode="boat", note="Water taxi in season."),
    _leg("palase", "grama-bay", 14, (40, 60), mode="boat", note="Full-day excursion; mainly boat access."),
    _leg("vlore", "grama-bay", 45, (75, 105), mode="boat", note="Full-day excursion from Vlorë or Orikum."),
]

# Rough average road speeds used only when no curated leg exists (km/h).
FALLBACK_SPEED_KMH = {"drive": 50, "ferry": 35, "boat": 22}
# Straight-line to road-distance factor for Albania's mountainous terrain.
ROAD_FACTOR = 1.35

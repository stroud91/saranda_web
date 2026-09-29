"""Day timeline estimator.

Turns an ordered list of stops into a clock-time schedule: departures,
drives / ferries / boat hops, visits and a lunch break, following the
planner's daily rhythm and road-trip advice. Produces both an expected
schedule and the latest likely finish so travellers can see the spread.
"""
from datetime import date as date_cls

from app.data import essentials
from app.services import routing

PACES = {
    # drive buffer multiplier, share of the visit range to use, lunch minutes
    "relaxed": {"buffer": 1.2, "visit": 1.0, "lunch": 90},
    "balanced": {"buffer": 1.1, "visit": 0.5, "lunch": 75},
    "packed": {"buffer": 1.0, "visit": 0.0, "lunch": 60},
}

LONG_DRIVE_MIN = 300          # warn above 5 hours of moving time
MAJOR_SIGHT_LATEST = 17 * 60  # arriving at a big sight after 17:00 on a long day
LATE_END = 21 * 60 + 30
EVENING = 16 * 60 + 30  # reaching the overnight base after this → just check in
LUNCH_EARLIEST, LUNCH_FROM, LUNCH_UNTIL = 12 * 60, 12 * 60 + 30, 15 * 60
PEAK_MONTHS = {7, 8}
OUTDOOR = {"beach", "history", "nature", "viewpoint", "boat"}


def parse_hhmm(value, default="08:30"):
    value = value or default
    try:
        hh, mm = value.split(":")
        hh, mm = int(hh), int(mm)
    except (ValueError, AttributeError):
        raise ValueError("start_time must be HH:MM")
    if not (0 <= hh < 24 and 0 <= mm < 60):
        raise ValueError("start_time must be HH:MM")
    return hh * 60 + mm


def fmt(minutes):
    minutes = int(round(minutes))
    day_offset, minutes = divmod(minutes, 24 * 60)
    out = f"{minutes // 60:02d}:{minutes % 60:02d}"
    return out + (f" (+{day_offset}d)" if day_offset else "")


def _round5(x):
    return int(5 * round(x / 5))


def visit_minutes(dest, pace):
    share = PACES[pace]["visit"]
    return _round5(dest["visit_min"] + (dest["visit_max"] - dest["visit_min"]) * share)


def build_day(stops, *, start_time="08:30", pace="balanced", travel_date=None, modes=routing.ALL_MODES):
    if pace not in PACES:
        raise ValueError("pace must be relaxed, balanced or packed")
    if not stops:
        raise ValueError("A day needs at least one stop")
    for s in stops:
        routing.place(s)

    cfg = PACES[pace]
    month = travel_date.month if isinstance(travel_date, date_cls) else None
    t = parse_hhmm(start_time)
    slack = 0  # extra minutes if every leg takes its maximum
    events, warnings = [], []
    lunch_done = False
    moving_min = moving_max = 0
    km_min = km_max = 0
    visit_total = 0
    long_drive_so_far = 0
    path = []

    def add(kind, title, minutes, **extra):
        nonlocal t
        ev = {"type": kind, "title": title, "start": fmt(t), "end": fmt(t + minutes),
              "start_min": t, "minutes": minutes, **extra}
        events.append(ev)
        t += minutes
        return ev

    def maybe_lunch(where, force=False):
        nonlocal lunch_done
        if not lunch_done and (force or LUNCH_FROM <= t <= LUNCH_UNTIL):
            add("lunch", f"Lunch + shade in {where}", cfg["lunch"], slug=None,
                note="Planner rhythm: 12:30–14:30 lunch and shade.")
            lunch_done = True

    def visit(dest, minutes):
        """Add a visit, fitting lunch in naturally. Returns the visit's start."""
        nonlocal lunch_done
        kw = dict(slug=dest["slug"], category=dest["category"], note=dest["planning_note"])
        if not lunch_done and LUNCH_EARLIEST <= t <= LUNCH_UNTIL:
            maybe_lunch(dest["name"], force=True)
        start = t
        if not lunch_done and t < LUNCH_FROM and t + minutes > LUNCH_FROM + 45:
            first_part = max(30, LUNCH_FROM - t)
            add("visit", dest["name"], first_part, **kw)
            maybe_lunch(dest["name"], force=True)
            add("visit", f"{dest['name']} (continued)", minutes - first_part, **{**kw, "note": ""})
        else:
            add("visit", dest["name"], minutes, **kw)
        return start

    first = routing.place(stops[0])
    path.append([first["lat"], first["lng"]])
    single = len(stops) == 1
    add("depart", ("Explore " if single else "Start in ") + first["name"], 0, slug=first["slug"])

    visited = set()
    if single:
        dest = first
        minutes = visit_minutes(dest, pace)
        visit(dest, minutes)
        visit_total += minutes
        visited.add(dest["slug"])

    for idx, (a, b) in enumerate(zip(stops, stops[1:])):
        seg = routing.connect(a, b, modes)
        for leg in seg["legs"]:
            maybe_lunch(routing.place(leg["from"])["name"])
            expected = _round5(routing.mid(leg) * (cfg["buffer"] if leg["mode"] == "drive" else 1.0))
            expected = max(expected, leg["min_minutes"])
            slack += max(0, leg["max_minutes"] - expected)
            to_place = routing.place(leg["to"])
            verb = {"drive": "Drive", "ferry": "Ferry", "boat": "Boat"}[leg["mode"]]
            add(leg["mode"], f"{verb} to {to_place['name']}", expected,
                slug=to_place["slug"], from_slug=leg["from"],
                min_minutes=leg["min_minutes"], max_minutes=leg["max_minutes"],
                km_min=leg["km_min"], km_max=leg["km_max"], source=leg["source"], note=leg["note"])
            moving_min += leg["min_minutes"]
            moving_max += leg["max_minutes"]
            km_min += leg["km_min"]
            km_max += leg["km_max"]
            long_drive_so_far += expected
            path.append([to_place["lat"], to_place["lng"]])
            if leg["mode"] in ("ferry", "boat"):
                warnings.append({"level": "info", "code": "sea",
                                 "text": f"{verb} to {to_place['name']}: schedules are seasonal and sea conditions can change routes — confirm with the operator."})

        dest = routing.place(b)
        is_last = idx == len(stops) - 2
        returning = b in visited or (b == stops[0] and is_last)
        if dest["category"] == "hub":
            add("arrive", f"Arrive {dest['name']}", 0, slug=dest["slug"],
                note="For flights, aim to arrive 2 hours before departure; allow time to return a rental car.")
            continue
        if returning:
            add("arrive", f"Back in {dest['name']} — free time", 0, slug=dest["slug"])
            continue
        if is_last and dest["base"] and t >= EVENING:
            add("arrive", f"Check in — evening in {dest['name']}", 0, slug=dest["slug"],
                note="Planner rhythm: 18:00–20:00 sunset and free time, then dinner and an evening walk.")
            continue

        if (t >= MAJOR_SIGHT_LATEST and long_drive_so_far >= 150
                and dest["category"] in ("history", "nature") and not dest["base"]):
            warnings.append({"level": "warn", "code": "late-sight",
                             "text": f"You reach {dest['name']} after a long drive late in the day. {essentials.ROAD_TRIP_TIP}"})
        minutes = visit_minutes(dest, pace)
        visit_start = visit(dest, minutes)
        visit_total += minutes
        visited.add(dest["slug"])

        if month in PEAK_MONTHS:
            if dest["category"] in OUTDOOR and visit_start < 15 * 60 + 30 and t > 12 * 60:
                warnings.append({"level": "info", "code": "heat",
                                 "text": f"{dest['name']} falls in the midday heat. July–August can be very hot — sightsee earlier or later."})
            if dest["peak_crowds"]:
                warnings.append({"level": "info", "code": "crowds",
                                 "text": f"{dest['name']} is very busy in July–August — arrive early and confirm parking."})
        if dest["slug"] == "theth" and month and month not in range(6, 10):
            warnings.append({"level": "warn", "code": "season",
                             "text": "Theth's mountain road and services are most reliable June–September. Check conditions."})

    if not lunch_done and t > LUNCH_UNTIL and len(events) > 2:
        warnings.append({"level": "info", "code": "lunch",
                         "text": "No natural lunch break — pack snacks or build in a stop around 13:00."})

    if moving_max >= LONG_DRIVE_MIN or long_drive_so_far >= LONG_DRIVE_MIN:
        warnings.append({"level": "warn", "code": "long-drive",
                         "text": f"Long travel day (up to {moving_max // 60}h{moving_max % 60:02d} on the road). Start early and leave buffers for fuel, photos and traffic."})
    if t + slack > LATE_END:
        warnings.append({"level": "warn", "code": "late-finish",
                         "text": f"If every leg runs long, you finish around {fmt(t + slack)}. Consider trimming a stop."})

    for ev in events:
        ev.pop("start_min", None)

    return {
        "events": events,
        "warnings": _dedupe(warnings),
        "summary": {
            "start": fmt(parse_hhmm(start_time)),
            "end": fmt(t),
            "end_latest": fmt(t + slack),
            "moving_minutes_min": moving_min,
            "moving_minutes_max": moving_max,
            "visit_minutes": visit_total,
            "km_min": km_min,
            "km_max": km_max,
            "stops": len(stops),
        },
        "path": path,
        "directions_url": routing.google_directions_url(stops),
    }


def _dedupe(warnings):
    seen, out = set(), []
    for w in warnings:
        if w["text"] not in seen:
            seen.add(w["text"])
            out.append(w)
    return out


def build_trip(days, *, pace="balanced", start_date=None):
    """Build timelines for many days. ``days`` items: {stops, start_time}."""
    from datetime import timedelta

    out, totals = [], {"km_min": 0, "km_max": 0, "moving_minutes_min": 0, "moving_minutes_max": 0, "visit_minutes": 0}
    for i, day in enumerate(days):
        travel_date = start_date + timedelta(days=i) if start_date else None
        result = build_day(day["stops"], start_time=day.get("start_time") or "08:30", pace=pace, travel_date=travel_date)
        result["day"] = i + 1
        result["date"] = travel_date.isoformat() if travel_date else None
        for k in totals:
            totals[k] += result["summary"][k]
        out.append(result)
    return {"days": out, "totals": totals}

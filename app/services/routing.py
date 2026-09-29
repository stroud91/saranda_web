"""Route connection engine.

Connects any two destinations by finding the fastest chain of curated legs
(Dijkstra over the planner's road table plus companion estimates). When no
curated chain exists, falls back to a straight-line estimate scaled for
Albania's mountain roads. Every result carries its ``source`` so the UI can be
honest about what is planner data and what is an estimate.
"""
import heapq
import math
from functools import lru_cache

from app.data import DESTINATION_INDEX, ROUTE_LEGS, FALLBACK_SPEED_KMH, ROAD_FACTOR

# Prefer roads; sea hops are used when they are the only or clearly better way.
MODE_WEIGHT = {"drive": 1.0, "ferry": 1.25, "boat": 1.6}
ALL_MODES = frozenset(MODE_WEIGHT)


class UnknownPlace(ValueError):
    pass


def haversine_km(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (a["lat"], a["lng"], b["lat"], b["lng"]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def place(slug):
    try:
        return DESTINATION_INDEX[slug]
    except KeyError:
        raise UnknownPlace(f"Unknown destination: {slug}") from None


def _orient(leg, a, b):
    """Return a copy of ``leg`` oriented a → b."""
    out = dict(leg)
    out["from"], out["to"] = a, b
    return out


@lru_cache(maxsize=1)
def _graph():
    graph = {}
    for leg in ROUTE_LEGS:
        a, b = leg["from"], leg["to"]
        graph.setdefault(a, []).append((b, _orient(leg, a, b)))
        graph.setdefault(b, []).append((a, _orient(leg, b, a)))
    return graph


def mid(leg):
    return (leg["min_minutes"] + leg["max_minutes"]) / 2


def estimated_leg(a_slug, b_slug, mode="drive"):
    a, b = place(a_slug), place(b_slug)
    crow = haversine_km(a, b)
    road_km = crow * (ROAD_FACTOR if mode == "drive" else 1.1)
    minutes = road_km / FALLBACK_SPEED_KMH[mode] * 60
    return {
        "from": a_slug,
        "to": b_slug,
        "km_min": round(road_km * 0.9),
        "km_max": round(road_km * 1.1),
        "min_minutes": max(5, round(minutes * 0.85 / 5) * 5),
        "max_minutes": max(10, round(minutes * 1.3 / 5) * 5),
        "mode": mode,
        "source": "straight-line",
        "note": "Straight-line estimate — no curated route between these points.",
    }


def connect(a_slug, b_slug, modes=ALL_MODES):
    """Fastest chain of legs from ``a_slug`` to ``b_slug``.

    Returns ``{"legs": [...], "hops": [slugs], "totals": {...}}``.
    """
    place(a_slug)
    place(b_slug)
    if a_slug == b_slug:
        return _summarise([a_slug], [])

    graph = _graph()
    best = {a_slug: 0.0}
    prev = {}
    queue = [(0.0, a_slug)]
    while queue:
        cost, node = heapq.heappop(queue)
        if node == b_slug:
            break
        if cost > best.get(node, math.inf):
            continue
        for nxt, leg in graph.get(node, ()):
            if leg["mode"] not in modes:
                continue
            new_cost = cost + mid(leg) * MODE_WEIGHT[leg["mode"]]
            if new_cost < best.get(nxt, math.inf):
                best[nxt] = new_cost
                prev[nxt] = (node, leg)
                heapq.heappush(queue, (new_cost, nxt))

    if b_slug not in prev:
        return _summarise([a_slug, b_slug], [estimated_leg(a_slug, b_slug)])

    legs, node = [], b_slug
    while node != a_slug:
        node, leg = prev[node][0], prev[node][1]
        legs.append(leg)
    legs.reverse()
    hops = [a_slug] + [leg["to"] for leg in legs]
    return _summarise(hops, legs)


def _summarise(hops, legs):
    totals = {
        "km_min": sum(l["km_min"] for l in legs),
        "km_max": sum(l["km_max"] for l in legs),
        "min_minutes": sum(l["min_minutes"] for l in legs),
        "max_minutes": sum(l["max_minutes"] for l in legs),
        "drive_minutes_min": sum(l["min_minutes"] for l in legs if l["mode"] == "drive"),
        "drive_minutes_max": sum(l["max_minutes"] for l in legs if l["mode"] == "drive"),
        "modes": sorted({l["mode"] for l in legs}),
        "sources": sorted({l["source"] for l in legs}),
        "hop_count": len(legs),
    }
    return {
        "hops": hops,
        "legs": legs,
        "totals": totals,
        "path": [[place(s)["lat"], place(s)["lng"]] for s in hops],
    }


def route_through(stops, modes=ALL_MODES):
    """Connect an ordered list of stops. Returns per-pair segments + totals."""
    segments = []
    for a, b in zip(stops, stops[1:]):
        seg = connect(a, b, modes)
        seg["from"], seg["to"] = a, b
        segments.append(seg)
    legs = [leg for seg in segments for leg in seg["legs"]]
    hops = [stops[0]] if stops else []
    for seg in segments:
        hops.extend(seg["hops"][1:])
    summary = _summarise(hops, legs) if stops else _summarise([], [])
    summary["segments"] = segments
    summary["stops"] = list(stops)
    return summary


def graph_payload():
    """Nodes and deduplicated edges for drawing the network on a map."""
    nodes = [
        {"slug": d["slug"], "name": d["name"], "lat": d["lat"], "lng": d["lng"],
         "category": d["category"], "region": d["region"], "base": d["base"]}
        for d in DESTINATION_INDEX.values()
    ]
    edges = [
        {**leg, "coords": [[place(leg["from"])["lat"], place(leg["from"])["lng"]],
                           [place(leg["to"])["lat"], place(leg["to"])["lng"]]]}
        for leg in ROUTE_LEGS
    ]
    return {"nodes": nodes, "edges": edges}


def nearby(slug, limit=6):
    """Directly connected places, fastest first."""
    place(slug)
    out = []
    for nxt, leg in _graph().get(slug, ()):
        out.append({"slug": nxt, "name": place(nxt)["name"], **{k: leg[k] for k in
                    ("km_min", "km_max", "min_minutes", "max_minutes", "mode", "source", "note")}})
    out.sort(key=lambda x: (x["min_minutes"] + x["max_minutes"]))
    return out[:limit]


def google_directions_url(stops):
    """Deep link to Google Maps driving directions through the stops."""
    from urllib.parse import quote

    if not stops:
        return None
    pts = [place(s) for s in stops]
    fmt = lambda p: f"{p['lat']:.5f},{p['lng']:.5f}"
    url = f"https://www.google.com/maps/dir/?api=1&travelmode=driving&origin={fmt(pts[0])}&destination={fmt(pts[-1])}"
    if len(pts) > 2:
        url += "&waypoints=" + quote("|".join(fmt(p) for p in pts[1:-1][:9]))
    return url

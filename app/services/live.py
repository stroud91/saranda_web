"""Live data providers with honest fallbacks.

- Weather & sea: Open-Meteo forecast + marine APIs (no key required).
- Currency: open.er-api.com EUR base rates (no key required).
- Places: Google Places API (New) text search — only when GOOGLE_MAPS_API_KEY
  is configured; the key never leaves the server.
- Road geometry: OSRM (public demo server by default, or your own instance).

Every response says where its numbers came from (``source``) and whether
they are live, cached or a typical-conditions fallback.
"""
from datetime import datetime, timezone

from flask import current_app

from app.data import essentials
from app.services import routing
from app.services.upstream import UpstreamError, cached, request_json

FALLBACK_EUR_ALL = 98.0  # used only if the FX feed is unreachable

WMO = {
    0: ("Clear sky", "sun"), 1: ("Mainly clear", "sun"), 2: ("Partly cloudy", "cloud-sun"), 3: ("Overcast", "cloud"),
    45: ("Fog", "fog"), 48: ("Rime fog", "fog"), 51: ("Light drizzle", "drizzle"), 53: ("Drizzle", "drizzle"),
    55: ("Heavy drizzle", "drizzle"), 61: ("Light rain", "rain"), 63: ("Rain", "rain"), 65: ("Heavy rain", "rain"),
    71: ("Light snow", "snow"), 73: ("Snow", "snow"), 75: ("Heavy snow", "snow"), 80: ("Rain showers", "rain"),
    81: ("Rain showers", "rain"), 82: ("Violent showers", "storm"), 95: ("Thunderstorm", "storm"),
    96: ("Thunderstorm, hail", "storm"), 99: ("Thunderstorm, hail", "storm"),
}


def _now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def typical_conditions(month=None):
    month = month or datetime.now(timezone.utc).month
    row = next(c for c in essentials.CLIMATE_SARANDE if c["month"] == month)
    return {"air_high": row["air_high"], "sea": row["sea"], "rain_days": row["rain_days"], "month": month}


def weather(slug="sarande"):
    dest = routing.place(slug)

    def produce():
        base = {"latitude": dest["lat"], "longitude": dest["lng"], "timezone": "Europe/Tirane"}
        fc = request_json("GET", "https://api.open-meteo.com/v1/forecast", params={
            **base,
            "current": "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,uv_index",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset",
            "forecast_days": 7,
        })
        marine = None
        if dest["region"] not in ("north", "central", "capital", "inland-south") or dest["slug"] == "durres":
            try:
                marine = request_json("GET", "https://marine-api.open-meteo.com/v1/marine", params={
                    **base, "current": "wave_height,sea_surface_temperature",
                    "daily": "wave_height_max", "forecast_days": 7,
                })
            except UpstreamError:
                marine = None
        cur = fc.get("current", {})
        code = cur.get("weather_code")
        label, icon = WMO.get(code, ("—", "cloud"))
        daily = fc.get("daily", {})
        days = []
        for i, day in enumerate(daily.get("time", [])):
            dcode = (daily.get("weather_code") or [None] * 7)[i]
            days.append({
                "date": day,
                "code": dcode,
                "label": WMO.get(dcode, ("—", "cloud"))[0],
                "icon": WMO.get(dcode, ("—", "cloud"))[1],
                "max": (daily.get("temperature_2m_max") or [None] * 7)[i],
                "min": (daily.get("temperature_2m_min") or [None] * 7)[i],
                "rain_chance": (daily.get("precipitation_probability_max") or [None] * 7)[i],
                "uv": (daily.get("uv_index_max") or [None] * 7)[i],
                "sunrise": ((daily.get("sunrise") or [""] * 7)[i] or "")[-5:],
                "sunset": ((daily.get("sunset") or [""] * 7)[i] or "")[-5:],
                "wave_max": ((marine or {}).get("daily", {}).get("wave_height_max") or [None] * 7)[i] if marine else None,
            })
        mcur = (marine or {}).get("current", {})
        return {
            "place": {"slug": dest["slug"], "name": dest["name"]},
            "live": True,
            "source": "Open-Meteo",
            "fetched_at": _now_iso(),
            "current": {
                "temp": cur.get("temperature_2m"),
                "feels_like": cur.get("apparent_temperature"),
                "wind_kmh": cur.get("wind_speed_10m"),
                "uv": cur.get("uv_index"),
                "is_day": bool(cur.get("is_day", 1)),
                "code": code,
                "label": label,
                "icon": icon,
                "sea_temp": mcur.get("sea_surface_temperature"),
                "wave_height": mcur.get("wave_height"),
            },
            "daily": days,
            "typical": typical_conditions(),
        }

    try:
        return cached(("weather", slug), current_app.config["WEATHER_CACHE_SECONDS"], produce)
    except UpstreamError:
        typical = typical_conditions()
        return {
            "place": {"slug": dest["slug"], "name": dest["name"]},
            "live": False,
            "source": "Typical monthly climate (fallback)",
            "fetched_at": _now_iso(),
            "current": {"temp": typical["air_high"], "sea_temp": typical["sea"], "label": "Typical for this month",
                        "icon": "sun", "is_day": True},
            "daily": [],
            "typical": typical,
        }


def fx_rates():
    def produce():
        data = request_json("GET", "https://open.er-api.com/v6/latest/EUR")
        rates = data.get("rates") or {}
        if "ALL" not in rates:
            raise UpstreamError("FX feed missing ALL")
        return {
            "base": "EUR",
            "rates": {k: rates[k] for k in ("ALL", "USD", "GBP", "CHF", "SEK", "NOK", "PLN") if k in rates},
            "live": True,
            "source": "open.er-api.com",
            "updated": data.get("time_last_update_utc"),
        }

    try:
        return cached(("fx",), current_app.config["FX_CACHE_SECONDS"], produce, fail_ttl=300)
    except UpstreamError:
        return {"base": "EUR", "rates": {"ALL": FALLBACK_EUR_ALL}, "live": False,
                "source": "Approximate fallback rate", "updated": None}


def eur_to_all():
    return fx_rates()["rates"].get("ALL", FALLBACK_EUR_ALL)


PLACES_FIELDS = ",".join([
    "places.id", "places.displayName", "places.formattedAddress", "places.rating", "places.userRatingCount",
    "places.googleMapsUri", "places.currentOpeningHours.openNow", "places.websiteUri", "places.priceLevel",
])


def google_place(slug):
    """Google rating & opening status for a destination (if configured)."""
    key = current_app.config.get("GOOGLE_MAPS_API_KEY")
    dest = routing.place(slug)
    if not key:
        return {"configured": False}

    def produce():
        data = request_json("POST", "https://places.googleapis.com/v1/places:searchText",
                            json={"textQuery": dest["maps_query"], "maxResultCount": 1, "languageCode": "en",
                                  "locationBias": {"circle": {"center": {"latitude": dest["lat"], "longitude": dest["lng"]},
                                                              "radius": 15000.0}}},
                            headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": PLACES_FIELDS})
        places = data.get("places") or []
        if not places:
            return {"configured": True, "found": False}
        p = places[0]
        return {
            "configured": True,
            "found": True,
            "name": (p.get("displayName") or {}).get("text"),
            "address": p.get("formattedAddress"),
            "rating": p.get("rating"),
            "rating_count": p.get("userRatingCount"),
            "open_now": (p.get("currentOpeningHours") or {}).get("openNow"),
            "maps_url": p.get("googleMapsUri"),
            "website": p.get("websiteUri"),
            "source": "Google Places",
            "fetched_at": _now_iso(),
        }

    try:
        return cached(("place", slug), current_app.config["PLACES_CACHE_SECONDS"], produce, fail_ttl=600)
    except UpstreamError:
        return {"configured": True, "found": False, "error": "Google Places is temporarily unavailable"}


def road_geometry(stops):
    """Road polyline through stops via OSRM; straight segments if disabled/unavailable."""
    pts = [routing.place(s) for s in stops]
    straight = {"coords": [[p["lat"], p["lng"]] for p in pts], "source": "straight", "live": False}
    base = current_app.config.get("OSRM_URL")
    if not base or len(pts) < 2:
        return straight
    coord_str = ";".join(f"{p['lng']:.5f},{p['lat']:.5f}" for p in pts)

    def produce():
        data = request_json("GET", f"{base.rstrip('/')}/route/v1/driving/{coord_str}",
                            params={"overview": "simplified", "geometries": "geojson"})
        routes = data.get("routes") or []
        if data.get("code") != "Ok" or not routes:
            raise UpstreamError("OSRM returned no route")
        r = routes[0]
        return {
            "coords": [[lat, lng] for lng, lat in r["geometry"]["coordinates"]],
            "distance_km": round(r["distance"] / 1000, 1),
            "duration_min": round(r["duration"] / 60),
            "source": "OSRM / OpenStreetMap",
            "live": True,
        }

    try:
        return cached(("geom", tuple(stops)), 7 * 24 * 3600, produce, fail_ttl=300)
    except UpstreamError:
        return straight

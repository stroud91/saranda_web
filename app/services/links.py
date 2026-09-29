"""Deep links into booking & map platforms.

Booking.com, Airbnb, GetYourGuide, Viator and Google don't offer open search
APIs for a site like this, so we hand the traveller a pre-filled search on
each platform instead (with optional affiliate IDs from config).
"""
from urllib.parse import urlencode, quote

from flask import current_app

from app.services import routing


def _q(params):
    return urlencode({k: v for k, v in params.items() if v not in (None, "")})


def stay_links(slug, checkin=None, checkout=None, adults=2):
    d = routing.place(slug)
    cfg = current_app.config
    city = d["name"].split(" (")[0]
    links = [
        {"provider": "Booking.com", "kind": "stay",
         "url": "https://www.booking.com/searchresults.html?" + _q({
             "ss": f"{city}, Albania" if d["region"] != "greece" else city, "checkin": checkin,
             "checkout": checkout, "group_adults": adults, "no_rooms": 1, "aid": cfg.get("BOOKING_AFFILIATE_ID")})},
        {"provider": "Airbnb", "kind": "stay",
         "url": f"https://www.airbnb.com/s/{quote(city + (', Albania' if d['region'] != 'greece' else ', Greece'))}/homes?" + _q({
             "checkin": checkin, "checkout": checkout, "adults": adults})},
        {"provider": "Google Hotels", "kind": "stay",
         "url": "https://www.google.com/travel/hotels?" + _q({"q": f"hotels in {city}"})},
    ]
    return links


def experience_links(slug):
    d = routing.place(slug)
    cfg = current_app.config
    q = d["name"].split(" (")[0]
    return [
        {"provider": "GetYourGuide", "kind": "tour",
         "url": "https://www.getyourguide.com/s/?" + _q({"q": q, "partner_id": cfg.get("GYG_PARTNER_ID")})},
        {"provider": "Viator", "kind": "tour",
         "url": "https://www.viator.com/searchResults/all?" + _q({"text": q, "pid": cfg.get("VIATOR_PARTNER_ID")})},
    ]


def map_links(slug):
    d = routing.place(slug)
    return [
        {"provider": "Google Maps", "kind": "map",
         "url": "https://www.google.com/maps/search/?" + _q({"api": 1, "query": d["maps_query"]})},
        {"provider": "Directions", "kind": "directions",
         "url": "https://www.google.com/maps/dir/?" + _q({"api": 1, "destination": f"{d['lat']:.5f},{d['lng']:.5f}"})},
        {"provider": "OpenStreetMap", "kind": "map",
         "url": f"https://www.openstreetmap.org/?mlat={d['lat']:.5f}&mlon={d['lng']:.5f}#map=14/{d['lat']:.5f}/{d['lng']:.5f}"},
    ]


def transport_links(slug):
    d = routing.place(slug)
    out = []
    if d["slug"] in ("sarande", "corfu"):
        out.append({"provider": "Current ferry timetables", "kind": "ferry",
                    "url": "https://www.google.com/search?" + _q({"q": "Sarandë Corfu ferry timetable operator"})})
    out.append({"provider": "Rental cars (Rentalcars.com)", "kind": "car",
                "url": "https://www.rentalcars.com/search-results?" + _q({"locationName": d["name"]})})
    return out


def all_links(slug, **stay_kw):
    return {
        "stay": stay_links(slug, **stay_kw),
        "experiences": experience_links(slug),
        "maps": map_links(slug),
        "transport": transport_links(slug),
    }

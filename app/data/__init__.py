"""Curated travel knowledge, versioned with the code.

Destinations, route legs, itineraries and practical advice change slowly and
are reviewed each season, so they live here rather than in the database.
Transactional data (guides, bookings, saved trips) lives in the database.
"""
from .destinations import DESTINATIONS, DESTINATION_INDEX, REGIONS, CATEGORIES
from .routes import ROUTE_LEGS, FALLBACK_SPEED_KMH, ROAD_FACTOR
from .itineraries import ITINERARIES, ITINERARY_INDEX, DAILY_RHYTHM, CORFU_COMBOS
from . import essentials

__all__ = [
    "DESTINATIONS", "DESTINATION_INDEX", "REGIONS", "CATEGORIES",
    "ROUTE_LEGS", "FALLBACK_SPEED_KMH", "ROAD_FACTOR",
    "ITINERARIES", "ITINERARY_INDEX", "DAILY_RHYTHM", "CORFU_COMBOS",
    "essentials",
]

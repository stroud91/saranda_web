"""Practical knowledge from the planner: seasons, money, budgets, food,
beaches, packing, safety and the Corfu connection.

All prices are indicative planning ranges, not fixed 2027 tariffs.
"""

EDITION = "2027 edition"
LAST_REVIEWED = "2026-09-29"

PRICE_NOTE = (
    "All prices are indicative planning ranges, not fixed 2027 tariffs. Summer accommodation, ferries, "
    "beach services, tours and car rental change by date, demand and operator. Always confirm the final "
    "price before paying."
)

DISCLAIMER = (
    "Independent travel-planning guide — not an official government publication. Distances, travel times, "
    "prices, opening hours, ferry schedules and business availability can change. Verify current "
    "information before booking or travelling."
)

SEASONS = [
    {"months": "May–June", "key": "early-summer", "verdict": "Great",
     "text": "Warm weather, strong beach conditions and generally more comfortable sightseeing."},
    {"months": "July–August", "key": "peak", "verdict": "Busy",
     "text": "Peak summer: the busiest beaches and strongest demand. Book early and sightsee early or late in the day."},
    {"months": "September", "key": "september", "verdict": "Best balance",
     "text": "An excellent balance of warm sea, beach weather and sightseeing."},
    {"months": "October–April", "key": "off-season", "verdict": "Culture season",
     "text": "Better for culture, food, hiking and city breaks; many seasonal beach businesses reduce hours."},
]

# Typical monthly climate for Sarandë (approximate long-term averages).
CLIMATE_SARANDE = [
    {"month": 1, "air_high": 14, "sea": 15, "rain_days": 12},
    {"month": 2, "air_high": 15, "sea": 14, "rain_days": 11},
    {"month": 3, "air_high": 17, "sea": 15, "rain_days": 10},
    {"month": 4, "air_high": 20, "sea": 16, "rain_days": 9},
    {"month": 5, "air_high": 24, "sea": 19, "rain_days": 6},
    {"month": 6, "air_high": 28, "sea": 22, "rain_days": 3},
    {"month": 7, "air_high": 31, "sea": 25, "rain_days": 1},
    {"month": 8, "air_high": 31, "sea": 26, "rain_days": 2},
    {"month": 9, "air_high": 28, "sea": 24, "rain_days": 4},
    {"month": 10, "air_high": 23, "sea": 22, "rain_days": 8},
    {"month": 11, "air_high": 19, "sea": 19, "rain_days": 13},
    {"month": 12, "air_high": 15, "sea": 17, "rain_days": 14},
]

MONEY = [
    "Albania uses the Albanian lek (ALL).",
    "Euros are widely familiar in tourist areas, but don't assume every small business accepts cards or euros.",
    "Keep some lek for cafés, parking, local transport and small purchases.",
    "ATMs are most available in cities and major tourist centres.",
]

BOOKING_STRATEGY = [
    "Book the first and last nights first, then build the road trip around them.",
    "For July–August, reserve popular coastal accommodation and boat trips early.",
    "Choose accommodation with parking if you are driving.",
    "In beach towns, check whether the quoted room price includes breakfast, parking and taxes.",
    "For archaeological sites and museums, confirm current opening hours and ticket arrangements before your visit.",
]

EMERGENCY_NUMBERS = [
    {"service": "General emergency", "number": "112"},
    {"service": "Police", "number": "129"},
    {"service": "Fire", "number": "128"},
    {"service": "Ambulance", "number": "127"},
]

# Planner: Daily Budget Guide — approx. daily spend per person (EUR).
BUDGET_TIERS = [
    {"key": "budget", "label": "Budget", "min": 35, "max": 65,
     "choices": "Simple room or hostel, bakeries, casual meals, local buses / shared rides"},
    {"key": "comfort", "label": "Comfort", "min": 70, "max": 130,
     "choices": "3–4★ hotel, restaurants, rental-car share, paid attractions"},
    {"key": "premium", "label": "Premium", "min": 140, "max": 250,
     "choices": "4–5★ hotel, private transfers, boat / private tours, premium dining"},
]

BUDGET_CATEGORIES = [
    {"item": "Breakfast", "range": "€4–€12 pp", "min": 4, "max": 12},
    {"item": "Casual lunch", "range": "€7–€15 pp", "min": 7, "max": 15},
    {"item": "Restaurant dinner", "range": "€12–€30+ pp", "min": 12, "max": 30},
    {"item": "Coffee / soft drink", "range": "€1.5–€5", "min": 1.5, "max": 5},
    {"item": "Local paid attraction", "range": "€2–€15+ pp depending on site", "min": 2, "max": 15},
    {"item": "Beach umbrella / sunbeds", "range": "Highly seasonal — confirm locally", "min": None, "max": None},
    {"item": "Rental car", "range": "Often €30–€70+ / day depending on season, car and insurance", "min": 30, "max": 70},
    {"item": "Private vehicle + driver", "range": "Highly variable — quote by route and group", "min": None, "max": None},
]

SAVE_MONEY = [
    "Travel in May, June, September or October.",
    "Stay 10–15 minutes outside the busiest beach centre.",
    "Book longer stays.",
    "Use local bakeries for breakfast or lunch.",
]

FOOD = [
    {"name": "Byrek", "what": "Layered pastry with fillings such as cheese, meat or greens.", "tag": "bakery"},
    {"name": "Grilled fish", "what": "Fresh local fish, often served simply with salad and lemon.", "tag": "coast"},
    {"name": "Tavë", "what": "Traditional baked dishes; versions vary by region.", "tag": "classic"},
    {"name": "Qifqi", "what": "Rice-based Gjirokastër speciality, often served as small fried balls.", "tag": "gjirokaster"},
    {"name": "Fërgesë", "what": "Rich dish usually based on peppers, tomato and cheese.", "tag": "classic"},
    {"name": "Seafood / mussels", "what": "Particularly good around the southern coast.", "tag": "coast"},
    {"name": "Village salad", "what": "Tomato, cucumber, onion, peppers and local cheese.", "tag": "fresh"},
    {"name": "Baklava", "what": "Sweet pastry with nuts and syrup.", "tag": "sweet"},
    {"name": "Local wine", "what": "Try regional wines with lunch or dinner.", "tag": "drink"},
    {"name": "Raki", "what": "Traditional spirit — drink responsibly.", "tag": "drink"},
]

RESTAURANT_TIP = (
    "At a coastal restaurant, ask what fish is fresh that day before choosing from the menu. In busy beach "
    "areas, compare the menu and final price before ordering shared seafood platters."
)

BEACH_RULE = (
    "In peak season, arrive early. Carry water, sun protection and a little cash. If you're driving, confirm "
    "parking before committing to a beach. For remote beaches, ask locally about road and sea conditions "
    "rather than relying on an old social-media post."
)

PACKING = {
    "Beach & summer": [
        "Swimwear + lightweight towel", "High-SPF sunscreen + lip balm", "Hat / sunglasses",
        "Reusable water bottle", "Water shoes for rocky beaches", "Small beach bag",
    ],
    "Road trip": [
        "Passport / travel documents", "Driving licence + rental documents",
        "Phone charger + car adapter / power bank", "Offline map backup", "Small amount of local cash",
        "Comfortable shoes", "Light jacket for evenings / mountain areas",
    ],
    "Family / children": [
        "Sun protection and hydration", "Snacks for long drives", "Lightweight first-aid basics",
        "Entertainment for road days",
    ],
    "Boat day": [
        "Dry bag or waterproof phone pouch", "Towel + spare clothes", "Water + snacks",
        "Motion-sickness medication if you normally need it",
    ],
}

SAFETY = [
    {"topic": "Driving", "tip": "Don't assume every road is fast or predictable; allow extra time on mountain and coastal roads."},
    {"topic": "Parking", "tip": "In busy coastal centres, confirm where you can legally park before leaving the car."},
    {"topic": "Sea conditions", "tip": "Boat routes can change because of wind and waves. Follow the captain's instructions."},
    {"topic": "Heat", "tip": "July and August can be very hot; schedule sightseeing earlier or later in the day."},
    {"topic": "Cash", "tip": "Keep small notes for cafés, parking and small purchases."},
    {"topic": "Respect", "tip": "Dress appropriately at religious sites and respect residents in villages."},
    {"topic": "Water", "tip": "Carry bottled or trusted drinking water on long road trips."},
]

ROAD_TRIP_TIP = (
    "Don't schedule a major sightseeing attraction at the exact end of a long driving day. Leave a buffer for "
    "fuel, photos, coffee, parking and unexpected traffic."
)

CORFU = {
    "summary": (
        "Corfu and Sarandë are close neighbours across the Ionian Sea, making a combined Greece–Albania holiday "
        "very practical. Ferry schedules are seasonal and change, so treat this as a planning framework rather "
        "than a timetable."
    ),
    "checklist": [
        "Check the exact sailing date and departure port.",
        "Check whether your ticket is passenger-only or includes a vehicle.",
        "Allow extra time for port check-in and border formalities.",
        "Keep passport / entry documents accessible.",
        "Check the operator's baggage rules.",
        "For a same-day Corfu excursion from Sarandë, compare the timetable with the time needed to clear the port on both sides.",
    ],
    "promise": "Always check the current operator schedule before booking.",
}

BEACHES = [
    {"slug": "ksamil", "name": "Ksamil", "best_for": "Classic turquoise-water holiday", "note": "Very busy in July–August"},
    {"slug": "himare", "name": "Himarë Beach", "best_for": "Easy access + restaurants", "note": "Good base for families"},
    {"slug": "dhermi", "name": "Dhërmi", "best_for": "Scenery + beach clubs", "note": "Popular in peak season"},
    {"slug": "jale", "name": "Jalë", "best_for": "Younger / lively atmosphere", "note": "Check seasonal opening"},
    {"slug": "gjipe", "name": "Gjipe", "best_for": "Adventure + dramatic scenery", "note": "Allow extra access time"},
    {"slug": "borsh", "name": "Borsh", "best_for": "Long beach + more space", "note": "Good for a slower beach day"},
    {"slug": "bunec", "name": "Bunec", "best_for": "Quieter coastal day", "note": "Bring essentials"},
    {"slug": "kroreza", "name": "Krorëz", "best_for": "Remote / boat experience", "note": "Boat-dependent"},
    {"slug": "grama-bay", "name": "Grama Bay", "best_for": "Wild scenery + history", "note": "Mainly boat access"},
]

BOAT_DAY_IDEA = (
    "Start in the morning, cruise the coast, swim in 2–3 bays, have lunch by the sea, then return before sunset. "
    "Remote places such as Grama Bay are mainly accessible by boat and are best treated as a full excursion."
)

FINAL_CHECK = (
    "Before departure: reconfirm accommodation, car rental, ferry / boat tickets, attraction opening times, "
    "weather and your travel insurance. Keep a copy of important documents offline."
)

QUICK_START = [
    "Choose your trip length.",
    "Pick your base cities.",
    "Check the road-time notes.",
    "Reserve accommodation.",
    "Recheck ferry schedules, opening times and local prices shortly before travel.",
]

SOURCES = [
    {"name": "The Ultimate Albania Travel Planner 2027", "kind": "planner"},
    {"name": "Albania's official tourism portal (Sarandë, Himarë, Riviera and destination pages)", "kind": "official"},
    {"name": "Open-Meteo forecast & marine APIs (live weather, sea temperature)", "kind": "live"},
    {"name": "Google Places (ratings & opening hours, when configured)", "kind": "live"},
    {"name": "OSRM / OpenStreetMap (road geometry, when enabled)", "kind": "live"},
    {"name": "Open exchange-rate feed (EUR → ALL)", "kind": "live"},
]

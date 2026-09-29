"""Trip budget estimator built on the planner's Daily Budget Guide.

The planner's tiers are per-person daily ranges. We split each tier into
components so we can adjust for season, room sharing, rental cars, boat days
and guides. Everything is an indicative planning range, never a quote.
"""
import math

from app.data import essentials

TIERS = {t["key"]: t for t in essentials.BUDGET_TIERS}

# Share of a tier's daily spend by component (sums to 1.0).
SPLIT = {"stay": 0.45, "food": 0.30, "transport": 0.10, "activities": 0.15}

# Accommodation multiplier by month: peak summer is far higher.
STAY_SEASON = {1: 0.8, 2: 0.8, 3: 0.8, 4: 0.9, 5: 1.0, 6: 1.15, 7: 1.45, 8: 1.5, 9: 1.1, 10: 0.95, 11: 0.8, 12: 0.85}
OTHER_SEASON = {7: 1.1, 8: 1.1}

CAR_PER_DAY = (30, 70)          # planner: often €30–€70+ / day
CAR_PEAK = 1.25
FUEL_PER_DRIVING_DAY = (12, 30)  # companion estimate per car
BOAT_DAY_PP = (30, 70)           # shared boat trip, companion estimate
PRIVATE_BOAT = (250, 600)        # per boat per day, companion estimate


def season_label(month):
    if month in (7, 8):
        return "peak"
    if month in (5, 6, 9, 10):
        return "shoulder"
    return "low"


def sharing_factor(travelers):
    """Accommodation cost per person relative to a couple sharing a room."""
    if travelers <= 1:
        return 1.6
    if travelers == 2:
        return 1.0
    if travelers <= 4:
        return 0.85
    return 0.8


def estimate(*, travelers=2, days=7, style="comfort", month=None, car_days=0, boat_days=0,
             private_boat=False, guide_day_rate=None, guide_days=0, eur_to_all=None):
    if style not in TIERS:
        raise ValueError("style must be budget, comfort or premium")
    tier = TIERS[style]
    month = month or 6
    stay_m = STAY_SEASON.get(month, 1.0)
    other_m = OTHER_SEASON.get(month, 1.0)
    share = sharing_factor(travelers)

    def rng(lo, hi):
        return [round(lo), round(hi)]

    lines = []

    def line(key, label, lo, hi, detail):
        lines.append({"key": key, "label": label, "min": round(lo), "max": round(hi), "detail": detail})

    # Per-person daily components from the tier, adjusted.
    stay_pp = [tier["min"] * SPLIT["stay"] * stay_m * share, tier["max"] * SPLIT["stay"] * stay_m * share]
    food_pp = [tier["min"] * SPLIT["food"] * other_m, tier["max"] * SPLIT["food"] * other_m]
    act_pp = [tier["min"] * SPLIT["activities"] * other_m, tier["max"] * SPLIT["activities"] * other_m]
    transport_pp = [tier["min"] * SPLIT["transport"], tier["max"] * SPLIT["transport"]]

    line("stay", "Accommodation", stay_pp[0] * days * travelers, stay_pp[1] * days * travelers,
         f"{tier['label']} tier, {season_label(month)} season, {travelers} traveller(s) sharing")
    line("food", "Food & drink", food_pp[0] * days * travelers, food_pp[1] * days * travelers,
         "Breakfast €4–12, lunch €7–15, dinner €12–30+ per person")
    line("activities", "Sights & activities", act_pp[0] * days * travelers, act_pp[1] * days * travelers,
         "Paid attractions €2–15+ per person per site")

    cars = math.ceil(travelers / 5) if car_days else 0
    local_days = max(0, days - car_days)
    if car_days:
        peak = CAR_PEAK if month in (7, 8) else 1.0
        line("car", "Rental car", CAR_PER_DAY[0] * peak * car_days * cars, CAR_PER_DAY[1] * peak * car_days * cars,
             f"{cars} car(s) × {car_days} day(s) — planner range €30–70+/day before insurance extras")
        line("fuel", "Fuel & parking", FUEL_PER_DRIVING_DAY[0] * car_days * cars, FUEL_PER_DRIVING_DAY[1] * car_days * cars,
             "Companion estimate")
    if local_days:
        line("transport", "Local transport", transport_pp[0] * local_days * travelers, transport_pp[1] * local_days * travelers,
             "Buses, taxis and shared rides on non-driving days")

    if boat_days:
        if private_boat:
            boats = math.ceil(travelers / 10)
            line("boat", "Private boat", PRIVATE_BOAT[0] * boat_days * boats, PRIVATE_BOAT[1] * boat_days * boats,
                 "Companion estimate — quote varies by route, boat and season")
        else:
            line("boat", "Boat trips", BOAT_DAY_PP[0] * boat_days * travelers, BOAT_DAY_PP[1] * boat_days * travelers,
                 "Shared boat day, companion estimate")

    if guide_days and guide_day_rate:
        line("guide", "Local guide", guide_day_rate * guide_days, guide_day_rate * guide_days * 1.1,
             f"{guide_days} guided day(s) for the group")

    total = [sum(l["min"] for l in lines), sum(l["max"] for l in lines)]
    pp = [total[0] / travelers, total[1] / travelers]
    ppd = [pp[0] / days, pp[1] / days]
    result = {
        "inputs": {"travelers": travelers, "days": days, "style": style, "month": month, "car_days": car_days,
                   "boat_days": boat_days, "private_boat": private_boat, "guide_days": guide_days},
        "season": season_label(month),
        "tier": tier,
        "lines": lines,
        "total": rng(*total),
        "per_person": rng(*pp),
        "per_person_per_day": rng(*ppd),
        "currency": "EUR",
        "save_money": essentials.SAVE_MONEY,
        "note": essentials.PRICE_NOTE,
    }
    if eur_to_all:
        result["total_all"] = [round(total[0] * eur_to_all, -2), round(total[1] * eur_to_all, -2)]
        result["eur_to_all"] = eur_to_all
    return result

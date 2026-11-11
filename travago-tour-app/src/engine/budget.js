// Port of app/services/budget.py: the planner's daily budget guide as ranges.
import { pyRound } from "./py";

export function createBudget(data) {
  const B = data.budget;
  const TIERS = Object.fromEntries(B.tiers.map((t) => [t.key, t]));

  const seasonLabel = (m) => ([7, 8].includes(m) ? "peak" : [5, 6, 9, 10].includes(m) ? "shoulder" : "low");
  const sharingFactor = (n) => (n <= 1 ? 1.6 : n === 2 ? 1.0 : n <= 4 ? 0.85 : 0.8);

  function estimate({ travelers = 2, days = 7, style = "comfort", month = null, car_days = 0, boat_days = 0,
    private_boat = false, guide_day_rate = null, guide_days = 0, eur_to_all = null } = {}) {
    if (!TIERS[style]) throw new Error("style must be budget, comfort or premium");
    const tier = TIERS[style];
    month = month || 6;
    const stayM = B.stay_season[String(month)] ?? 1.0;
    const otherM = B.other_season[String(month)] ?? 1.0;
    const share = sharingFactor(travelers);
    const S = B.split;
    const lines = [];
    const line = (key, label, lo, hi, detail) => lines.push({ key, label, min: pyRound(lo), max: pyRound(hi), detail });

    const stayPp = [tier.min * S.stay * stayM * share, tier.max * S.stay * stayM * share];
    const foodPp = [tier.min * S.food * otherM, tier.max * S.food * otherM];
    const actPp = [tier.min * S.activities * otherM, tier.max * S.activities * otherM];
    const transportPp = [tier.min * S.transport, tier.max * S.transport];

    line("stay", "Accommodation", stayPp[0] * days * travelers, stayPp[1] * days * travelers,
      `${tier.label} tier, ${seasonLabel(month)} season, ${travelers} traveller(s) sharing`);
    line("food", "Food & drink", foodPp[0] * days * travelers, foodPp[1] * days * travelers,
      "Breakfast €4–12, lunch €7–15, dinner €12–30+ per person");
    line("activities", "Sights & activities", actPp[0] * days * travelers, actPp[1] * days * travelers,
      "Paid attractions €2–15+ per person per site");

    const cars = car_days ? Math.ceil(travelers / 5) : 0;
    const localDays = Math.max(0, days - car_days);
    if (car_days) {
      const peak = [7, 8].includes(month) ? B.car_peak : 1.0;
      line("car", "Rental car", B.car_per_day[0] * peak * car_days * cars, B.car_per_day[1] * peak * car_days * cars,
        `${cars} car(s) × ${car_days} day(s) — planner range €30–70+/day before insurance extras`);
      line("fuel", "Fuel & parking", B.fuel_per_driving_day[0] * car_days * cars, B.fuel_per_driving_day[1] * car_days * cars,
        "Companion estimate");
    }
    if (localDays) {
      line("transport", "Local transport", transportPp[0] * localDays * travelers, transportPp[1] * localDays * travelers,
        "Buses, taxis and shared rides on non-driving days");
    }
    if (boat_days) {
      if (private_boat) {
        const boats = Math.ceil(travelers / 10);
        line("boat", "Private boat", B.private_boat[0] * boat_days * boats, B.private_boat[1] * boat_days * boats,
          "Companion estimate — quote varies by route, boat and season");
      } else {
        line("boat", "Boat trips", B.boat_day_pp[0] * boat_days * travelers, B.boat_day_pp[1] * boat_days * travelers,
          "Shared boat day, companion estimate");
      }
    }
    if (guide_days && guide_day_rate) {
      line("guide", "Local guide", guide_day_rate * guide_days, guide_day_rate * guide_days * 1.1,
        `${guide_days} guided day(s) for the group`);
    }

    const total = [lines.reduce((n, l) => n + l.min, 0), lines.reduce((n, l) => n + l.max, 0)];
    const pp = [total[0] / travelers, total[1] / travelers];
    const result = {
      inputs: { travelers, days, style, month, car_days, boat_days, private_boat, guide_days },
      season: seasonLabel(month),
      tier,
      lines,
      total: total.map((x) => pyRound(x)),
      per_person: pp.map((x) => pyRound(x)),
      per_person_per_day: pp.map((x) => pyRound(x / days)),
      currency: "EUR",
      save_money: data.save_money,
      note: data.price_note,
    };
    if (eur_to_all) {
      result.total_all = total.map((x) => pyRound(x * eur_to_all, -2));
      result.eur_to_all = eur_to_all;
    }
    return result;
  }

  return { estimate, seasonLabel };
}

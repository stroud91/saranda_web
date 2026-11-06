// Port of the offline answer engine in app/services/concierge.py.
import { escapeRe, normalize, thousands } from "./py";

export function createConcierge(data, responses, { routing, budget, eurToAll, weather }) {
  const index = routing.index;
  const name = (s) => index[s].name;
  const aliasPairs = Object.entries(data.aliases)
    .map(([alias, slug], i) => ({ alias: normalize(alias), slug, i, len: alias.length }))
    .sort((a, b) => b.len - a.len || a.i - b.i);

  function findPlaces(text) {
    let t = normalize(text);
    const hits = [];
    for (const { alias, slug } of aliasPairs) {
      const re = new RegExp(`\\b${escapeRe(alias)}\\b`, "g");
      const matches = [...t.matchAll(re)];
      for (const m of matches) {
        hits.push([m.index, slug]);
        t = t.slice(0, m.index) + " ".repeat(m[0].length) + t.slice(m.index + m[0].length);
      }
    }
    hits.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    return [...new Set(hits.map((h) => h[1]))];
  }

  const hm = (minutes) => {
    const m = Math.trunc(minutes);
    const h = Math.floor(m / 60);
    return h ? `${h}h${String(m % 60).padStart(2, "0")}` : `${m % 60} min`;
  };
  const range = (a, b, unit = "") => (a === b ? `${a}${unit}` : `${a}–${b}${unit}`);
  const num = (re, text, dflt = null) => {
    const m = re.exec(text);
    return m ? parseInt(m[1], 10) : dflt;
  };
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const E = () => responses["/essentials"];

  function topicText(topic) {
    const e = E();
    switch (topic) {
      case "food":
        return "**What to order:**\n" + e.food.map((f) => `- **${f.name}** — ${f.what}`).join("\n") + `\n\n${e.restaurant_tip}`;
      case "emergency":
        return "**Emergency numbers in Albania:**\n" + e.emergency.map((n) => `- ${n.service}: **${n.number}**`).join("\n");
      case "packing":
        return (data.packing_order || Object.keys(e.packing)).map((k) => `**${k}:** ` + e.packing[k].join(", ")).join("\n\n");
      case "corfu":
        return e.corfu.summary + "\n\n" + e.corfu.checklist.map((c) => `- ${c}`).join("\n") + "\n\n"
          + e.corfu.combos.map((c) => `- **${c.length}:** ${c.idea}`).join("\n");
      case "money":
        return e.money.map((m) => `- ${m}`).join("\n");
      case "safety":
        return e.safety.map((s) => `- **${s.topic}:** ${s.tip}`).join("\n");
      case "beaches":
        return "**Pick a beach by the experience you want:**\n" + e.beaches.map((b) => `- **${b.name}** — ${b.best_for} (${b.note})`).join("\n") + `\n\n${e.beach_rule}`;
      case "seasons":
        return e.seasons.map((s) => `- **${s.months}** (${s.verdict}): ${s.text}`).join("\n");
      default:
        return "";
    }
  }

  async function answer(question) {
    const q = normalize(question);
    const places = findPlaces(question);
    const mi = MONTHS.findIndex((k) => new RegExp(`\\b${k}`).test(q));
    const month = mi >= 0 ? mi + 1 : null;

    if (places.length >= 2 && /\b(how (long|far)|drive|get (to|from)|distance|route|from|to|between|ferry|boat)\b/.test(q)) {
      const [a, b] = places;
      const r = routing.connect(a, b);
      const t = r.totals;
      const lines = [`**${name(a)} → ${name(b)}**: about **${range(t.km_min, t.km_max, " km")}**, **${hm(t.min_minutes)}–${hm(t.max_minutes)}**.`];
      if (r.hops.length > 2) lines.push(`Best connection: ${r.hops.map(name).join(" → ")}.`);
      for (const leg of r.legs) if (leg.note) lines.push(`- ${name(leg.to)}: ${leg.note}`);
      lines.push("Times are planning ranges — summer traffic, road works and photo stops add up.");
      return { text: lines.join("\n"), cards: [{ type: "route", from: a, to: b }] };
    }

    if (/\b(budget|cost|how much|price|expensive|cheap|spend)\b/.test(q)) {
      const days = num(/(\d+)\s*(?:day|night)/, q, 7);
      const people = num(/(\d+)\s*(?:people|person|traveller|traveler|adult|of us|pax)/, q, 2);
      const style = /luxur|premium|5 ?star/.test(q) ? "premium"
        : /on a (tight |small )?budget|budget (style|travel|trip)|cheap|backpack|hostel|low[- ]cost/.test(q) ? "budget" : "comfort";
      const est = budget.estimate({ travelers: Math.max(1, Math.min(people, 20)), days: Math.max(1, Math.min(days, 30)), style, month, eur_to_all: await eurToAll() });
      const pp = est.per_person_per_day;
      const text = `For **${people} traveller(s), ${days} days, ${style} style** (${est.season} season): roughly `
        + `**€${thousands(est.total[0])}–€${thousands(est.total[1])}** in total — about **€${pp[0]}–€${pp[1]} per person per day**.\n`
        + est.lines.map((l) => `- ${l.label}: €${thousands(l.min)}–€${thousands(l.max)}`).join("\n")
        + "\n\nSave money: travel in May, June, September or October and stay 10–15 minutes outside the busiest beach centre.";
      return { text, cards: [{ type: "budget", inputs: est.inputs }] };
    }

    if (/\b(weather|temperature|hot|rain|sea temp|water temp|forecast|swim)\b/.test(q)) {
      const slug = places[0] || "sarande";
      const w = await weather(slug);
      const c = w.current;
      let text;
      if (w.live) {
        text = `**${w.place.name} right now:** ${c.label}, **${Math.round(c.temp)}°C**` + (c.sea_temp != null ? `, sea **${Math.round(c.sea_temp)}°C**` : "") + ".";
        if (w.daily.length) text += "\n" + w.daily.slice(0, 4).map((d) => `- ${d.date.slice(5)}: ${d.label}, ${Math.round(d.min)}–${Math.round(d.max)}°C`).join("\n");
      } else {
        text = `Typical for this month in Sarandë: highs around **${w.typical.air_high}°C**, sea about **${w.typical.sea}°C**.`;
      }
      return { text, cards: [] };
    }

    if (/\bguides?\b/.test(q)) {
      const gs = responses["/guides/"].guides;
      if (!gs.length) return { text: "Guide profiles are coming soon — message us on WhatsApp and we'll match you with a local guide.", cards: [] };
      const text = "Here are local guides you can request:\n" + gs.slice(0, 5)
        .map((g) => `- **${g.name}** (${g.base_city}) — ${g.headline}; ${g.languages.slice(0, 3).join(", ")}; from €${g.price_half_day.toFixed(0)} half day`).join("\n");
      return { text, cards: gs.slice(0, 3).map((g) => ({ type: "guide", slug: g.slug })) };
    }

    if (/\b(itinerar|days?|week|plan|route for)\b/.test(q) && !places.length) {
      const days = num(/(\d+)\s*(?:-\s*)?days?/, q) || (q.includes("week") ? 7 : null);
      const its = responses["/itineraries"].itineraries;
      const pick = days ? its.reduce((best, i) => (Math.abs(i.days_count - days) < Math.abs(best.days_count - days) ? i : best)) : its.find((i) => i.recommended);
      const text = `I'd start with **${pick.title}** — ${pick.tagline.toLowerCase()}. It covers ${pick.stats.stops} places `
        + `with ${pick.stats.hotel_changes} hotel base(s) and roughly ${hm(pick.stats.drive_minutes_min)}–`
        + `${hm(pick.stats.drive_minutes_max)} of total driving. Open it in the Planner to customise each day.`;
      return { text, cards: [{ type: "itinerary", slug: pick.slug }] };
    }

    const topics = [
      [/\b(eat|food|dish|restaurant|try|cuisine|byrek|seafood)\b/, "food"],
      [/\b(emergency|police|ambulance|fire|112|help)\b/, "emergency"],
      [/\b(pack|bring|luggage|checklist)\b/, "packing"],
      [/\b(corfu|ferry|greece)\b/, "corfu"],
      [/\b(money|cash|lek|euro|atm|card)\b/, "money"],
      [/\b(safe|safety|driving|parking|etiquette)\b/, "safety"],
      [/\b(beach|beaches|swim)\b/, "beaches"],
      [/\b(when|best time|season|month)\b/, "seasons"],
    ];
    for (const [re, topic] of topics) if (re.test(q)) return { text: topicText(topic), cards: [] };

    if (places.length) {
      const d = responses[`/destinations/${places[0]}`];
      const conns = d.connections.slice(0, 3).map((c) => `${c.name} (${hm(c.min_minutes)}–${hm(c.max_minutes)})`).join(", ");
      const text = `**${d.name}** — ${d.summary}\n\n- Best for: ${d.best_for || d.category_label}\n`
        + `- Suggested time: ${hm(d.visit_min)}–${hm(d.visit_max)}\n`
        + (d.planning_note ? `- Tip: ${d.planning_note}\n` : "")
        + (conns ? `- Nearby: ${conns}` : "");
      return { text, cards: [{ type: "destination", slug: d.slug }] };
    }

    return {
      text: "I'm your Saranda Companion. Try asking:\n- *How long from Tirana to Ksamil?*\n"
        + "- *Plan 10 days in Albania*\n- *Budget for 2 people, 7 days in August*\n"
        + "- *What should I eat in Gjirokastër?*\n- *Weather in Sarandë*\n- *Show me local guides*",
      cards: [],
    };
  }

  return { answer, findPlaces };
}

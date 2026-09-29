"""Travel concierge.

With ANTHROPIC_API_KEY configured, Claude answers using read-only tools over
the planner knowledge base, route engine, budget estimator, live weather and
the guide directory. Without a key (or if the API is unavailable) a built-in
intent engine answers the most common questions from the same data, so the
companion always works.

Security posture: tools are read-only and take validated arguments; the
conversation is capped in length; no secrets or PII are placed in prompts;
model output is rendered as plain text + light markdown by the client.
"""
import json
import logging
import re

from flask import current_app

from app.data import DESTINATION_INDEX, ITINERARIES
from app.services import budget as budget_svc
from app.services import knowledge, live, routing, timeline

log = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 6

SYSTEM_PROMPT = """You are the Saranda Companion — a warm, expert local travel concierge for southern Albania, \
based in Sarandë, working for the Meg'Rooms apartments website. You help travellers plan trips across Albania \
(and the Corfu connection) using the site's planner knowledge base.

How to answer:
- Use your tools for facts: destinations, drive times, route connections, day timelines, budgets, weather, \
itineraries, guides and practical essentials. Don't invent prices, timetables, opening hours or distances — \
if the tools don't have it, say so and suggest checking with the operator.
- Distances, times and prices are planning ranges. Present them as ranges and say they are estimates.
- Ferry schedules are seasonal: never state a fixed ferry time or price; tell travellers to check the current \
operator schedule.
- Be concise and practical: short paragraphs or tight bullet lists, bold key numbers. Use the traveller's \
language if they write in another language.
- When it helps, suggest a concrete next step in the app: open the Planner, the Route connector, a guide \
profile or an itinerary.
- If asked where to stay in Sarandë you may mention Meg'Rooms apartments, alongside general advice.
- Stay on travel topics for Albania and nearby Corfu. Politely decline unrelated requests."""

DEST_SLUGS = sorted(DESTINATION_INDEX)
TOOLS = [
    {
        "name": "search_destinations",
        "description": "Search the destination catalogue by free text, category or region. Returns short cards.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Free-text words, e.g. 'quiet beach' or 'castle'"},
                "category": {"type": "string", "enum": ["beach", "history", "nature", "city", "village", "viewpoint", "boat", "food", "hub"]},
                "region": {"type": "string", "enum": ["saranda", "riviera", "inland-south", "central", "capital", "north", "greece"]},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_destination",
        "description": "Full details for one destination: summary, suggested visit time, planning notes and direct connections.",
        "input_schema": {"type": "object", "properties": {"slug": {"type": "string", "enum": DEST_SLUGS}},
                         "required": ["slug"], "additionalProperties": False},
    },
    {
        "name": "connect_places",
        "description": "Fastest way between two destinations (multi-hop by road, ferry or boat) with distance and time ranges.",
        "input_schema": {"type": "object", "properties": {
            "from_slug": {"type": "string", "enum": DEST_SLUGS},
            "to_slug": {"type": "string", "enum": DEST_SLUGS}},
            "required": ["from_slug", "to_slug"], "additionalProperties": False},
    },
    {
        "name": "plan_day_timeline",
        "description": "Clock-time schedule for one day visiting stops in order (drives, visits, lunch) with warnings.",
        "input_schema": {"type": "object", "properties": {
            "stops": {"type": "array", "items": {"type": "string", "enum": DEST_SLUGS}, "minItems": 1, "maxItems": 8},
            "start_time": {"type": "string", "description": "HH:MM, default 08:30"},
            "pace": {"type": "string", "enum": ["relaxed", "balanced", "packed"]},
            "month": {"type": "integer", "minimum": 1, "maximum": 12}},
            "required": ["stops"], "additionalProperties": False},
    },
    {
        "name": "estimate_budget",
        "description": "Estimate a trip budget range in EUR from the planner's daily budget guide.",
        "input_schema": {"type": "object", "properties": {
            "travelers": {"type": "integer", "minimum": 1, "maximum": 20},
            "days": {"type": "integer", "minimum": 1, "maximum": 30},
            "style": {"type": "string", "enum": ["budget", "comfort", "premium"]},
            "month": {"type": "integer", "minimum": 1, "maximum": 12},
            "car_days": {"type": "integer", "minimum": 0, "maximum": 30},
            "boat_days": {"type": "integer", "minimum": 0, "maximum": 10}},
            "required": ["travelers", "days", "style"], "additionalProperties": False},
    },
    {
        "name": "list_itineraries",
        "description": "Ready-made itineraries (1 to 14 days) with stats. Use get_itinerary for the day-by-day plan.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_itinerary",
        "description": "Day-by-day plan for a ready-made itinerary.",
        "input_schema": {"type": "object", "properties": {
            "slug": {"type": "string", "enum": [i["slug"] for i in ITINERARIES]}},
            "required": ["slug"], "additionalProperties": False},
    },
    {
        "name": "list_guides",
        "description": "Local tour guides with languages, specialties, regions and day rates.",
        "input_schema": {"type": "object", "properties": {
            "language": {"type": "string"}, "specialty": {"type": "string"}}, "additionalProperties": False},
    },
    {
        "name": "get_weather",
        "description": "Current weather, sea temperature and 7-day forecast for a destination (live when available).",
        "input_schema": {"type": "object", "properties": {"slug": {"type": "string", "enum": DEST_SLUGS}},
                         "required": ["slug"], "additionalProperties": False},
    },
    {
        "name": "get_essentials",
        "description": "Practical planner knowledge by topic.",
        "input_schema": {"type": "object", "properties": {
            "topic": {"type": "string", "enum": sorted(knowledge.ESSENTIAL_TOPICS)}},
            "required": ["topic"], "additionalProperties": False},
    },
]


def _guides(language=None, specialty=None):
    from app.models import Guide

    rows = Guide.query.filter_by(is_active=True).all()
    out = []
    for g in rows:
        if language and not any(language.lower() in l.lower() for l in g.languages or []):
            continue
        if specialty and not any(specialty.lower() in s.lower() for s in g.specialties or []):
            continue
        d = g.to_dict()
        out.append({k: d[k] for k in ("slug", "name", "headline", "base_city", "languages", "specialties",
                                       "price_half_day", "price_full_day", "max_group", "has_vehicle", "is_sample")})
    return out


def run_tool(name, args):
    """Execute a concierge tool. Returns (json-able result, cards)."""
    cards = []
    if name == "search_destinations":
        res = knowledge.search_destinations(args.get("query"), args.get("category"), args.get("region"))
        cards = [{"type": "destination", "slug": r["slug"]} for r in res[:4]]
    elif name == "get_destination":
        res = knowledge.destination_detail(args["slug"])
        cards = [{"type": "destination", "slug": args["slug"]}]
    elif name == "connect_places":
        res = routing.connect(args["from_slug"], args["to_slug"])
        res.pop("path", None)
        cards = [{"type": "route", "from": args["from_slug"], "to": args["to_slug"]}]
    elif name == "plan_day_timeline":
        from datetime import date
        month = args.get("month")
        res = timeline.build_day(args["stops"], start_time=args.get("start_time") or "08:30",
                                 pace=args.get("pace") or "balanced",
                                 travel_date=date(2027, month, 15) if month else None)
        res.pop("path", None)
        cards = [{"type": "day", "stops": args["stops"]}]
    elif name == "estimate_budget":
        res = budget_svc.estimate(**{k: args[k] for k in ("travelers", "days", "style", "month", "car_days", "boat_days") if k in args},
                                  eur_to_all=live.eur_to_all())
        cards = [{"type": "budget", "inputs": res["inputs"]}]
    elif name == "list_itineraries":
        res = [{k: v for k, v in it.items() if k != "path"} for it in knowledge.list_itineraries()]
    elif name == "get_itinerary":
        res = knowledge.itinerary_detail(args["slug"])
        if res:
            res.pop("path", None)
        cards = [{"type": "itinerary", "slug": args["slug"]}]
    elif name == "list_guides":
        res = _guides(args.get("language"), args.get("specialty"))
        cards = [{"type": "guide", "slug": g["slug"]} for g in res[:3]]
    elif name == "get_weather":
        res = live.weather(args["slug"])
    elif name == "get_essentials":
        res = knowledge.essentials_topic(args["topic"])
    else:
        raise ValueError(f"Unknown tool {name}")
    return res, cards


def _claude_answer(messages):
    import anthropic

    client = anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"], max_retries=1, timeout=45.0)
    convo = [{"role": m["role"], "content": m["content"]} for m in messages]
    cards = []
    for _ in range(MAX_TOOL_ROUNDS):
        response = client.beta.messages.create(
            model=current_app.config["CONCIERGE_MODEL"],
            max_tokens=4096,
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            tools=TOOLS,
            messages=convo,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if response.stop_reason == "refusal":
            return {"text": "Sorry — I can't help with that one. Ask me anything about planning your Albania trip!",
                    "cards": [], "engine": "claude"}
        if response.stop_reason != "tool_use":
            text = "\n\n".join(b.text for b in response.content if b.type == "text").strip()
            return {"text": text or "…", "cards": _dedupe_cards(cards), "engine": "claude"}

        convo.append({"role": "assistant", "content": response.content})
        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            try:
                payload, new_cards = run_tool(block.name, dict(block.input or {}))
                cards.extend(new_cards)
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": json.dumps(payload, default=str)[:20000]})
            except Exception as exc:  # tool errors go back to the model, not the user
                log.info("concierge tool %s failed: %s", block.name, exc)
                results.append({"type": "tool_result", "tool_use_id": block.id, "is_error": True,
                                "content": f"Tool error: {exc}"})
        convo.append({"role": "user", "content": results})
    return {"text": "I gathered a lot of detail there — could you narrow the question a little?",
            "cards": _dedupe_cards(cards), "engine": "claude"}


def _dedupe_cards(cards):
    seen, out = set(), []
    for c in cards:
        key = json.dumps(c, sort_keys=True)
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out[:6]


# --------------------------------------------------------------------------
# Offline answer engine
# --------------------------------------------------------------------------

def _hm(minutes):
    h, m = divmod(int(minutes), 60)
    return f"{h}h{m:02d}" if h else f"{m} min"


def _range(a, b, unit=""):
    return f"{a}{unit}" if a == b else f"{a}–{b}{unit}"


def _num(pattern, text, default=None):
    m = re.search(pattern, text)
    return int(m.group(1)) if m else default


MONTHS = {m: i + 1 for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def offline_answer(question):
    q = knowledge.normalize(question)
    places = knowledge.find_places(question)
    month = next((v for k, v in MONTHS.items() if re.search(r"\b" + k, q)), None)

    # Route / distance questions
    if len(places) >= 2 and re.search(r"\b(how (long|far)|drive|get (to|from)|distance|route|from|to|between|ferry|boat)\b", q):
        a, b = places[0], places[1]
        r = routing.connect(a, b)
        t = r["totals"]
        via = " → ".join(DESTINATION_INDEX[s]["name"] for s in r["hops"])
        lines = [f"**{DESTINATION_INDEX[a]['name']} → {DESTINATION_INDEX[b]['name']}**: about "
                 f"**{_range(t['km_min'], t['km_max'], ' km')}**, **{_hm(t['min_minutes'])}–{_hm(t['max_minutes'])}**."]
        if len(r["hops"]) > 2:
            lines.append(f"Best connection: {via}.")
        for leg in r["legs"]:
            if leg["note"]:
                lines.append(f"- {DESTINATION_INDEX[leg['to']]['name']}: {leg['note']}")
        lines.append("Times are planning ranges — summer traffic, road works and photo stops add up.")
        return {"text": "\n".join(lines), "cards": [{"type": "route", "from": a, "to": b}]}

    if re.search(r"\b(budget|cost|how much|price|expensive|cheap|spend)\b", q):
        days = _num(r"(\d+)\s*(?:day|night)", q, 7)
        people = _num(r"(\d+)\s*(?:people|person|traveller|traveler|adult|of us|pax)", q, 2)
        style = "premium" if re.search(r"luxur|premium|5 ?star", q) else "budget" if re.search(r"budget|cheap|backpack|hostel", q) else "comfort"
        est = budget_svc.estimate(travelers=max(1, min(people, 20)), days=max(1, min(days, 30)), style=style,
                                  month=month, eur_to_all=live.eur_to_all())
        pp = est["per_person_per_day"]
        text = (f"For **{people} traveller(s), {days} days, {style} style** ({est['season']} season): roughly "
                f"**€{est['total'][0]:,}–€{est['total'][1]:,}** in total — about **€{pp[0]}–€{pp[1]} per person per day**.\n"
                + "\n".join(f"- {l['label']}: €{l['min']:,}–€{l['max']:,}" for l in est["lines"])
                + "\n\nSave money: travel in May, June, September or October and stay 10–15 minutes outside the busiest beach centre.")
        return {"text": text, "cards": [{"type": "budget", "inputs": est["inputs"]}]}

    if re.search(r"\b(weather|temperature|hot|rain|sea temp|water temp|forecast|swim)\b", q):
        slug = places[0] if places else "sarande"
        w = live.weather(slug)
        c = w["current"]
        if w["live"]:
            text = (f"**{w['place']['name']} right now:** {c['label']}, **{round(c['temp'])}°C**"
                    + (f", sea **{round(c['sea_temp'])}°C**" if c.get("sea_temp") is not None else "") + ".")
            if w["daily"]:
                text += "\n" + "\n".join(f"- {d['date'][5:]}: {d['label']}, {round(d['min'])}–{round(d['max'])}°C" for d in w["daily"][:4])
        else:
            ty = w["typical"]
            text = f"Typical for this month in Sarandë: highs around **{ty['air_high']}°C**, sea about **{ty['sea']}°C**."
        return {"text": text, "cards": []}

    if re.search(r"\bguides?\b", q):
        gs = _guides()
        if not gs:
            return {"text": "Guide profiles are coming soon — message us on WhatsApp and we'll match you with a local guide.", "cards": []}
        text = "Here are local guides you can request:\n" + "\n".join(
            f"- **{g['name']}** ({g['base_city']}) — {g['headline']}; {', '.join(g['languages'][:3])}; from €{g['price_half_day']:.0f} half day"
            for g in gs[:5])
        return {"text": text, "cards": [{"type": "guide", "slug": g["slug"]} for g in gs[:3]]}

    if re.search(r"\b(itinerar|days?|week|plan|route for)\b", q) and not places:
        days = _num(r"(\d+)\s*(?:-\s*)?days?", q) or (7 if "week" in q else None)
        its = knowledge.list_itineraries()
        pick = min(its, key=lambda i: abs(i["days_count"] - days)) if days else next(i for i in its if i["recommended"])
        text = (f"I'd start with **{pick['title']}** — {pick['tagline'].lower()}. It covers {pick['stats']['stops']} places "
                f"with {pick['stats']['hotel_changes']} hotel base(s) and roughly {_hm(pick['stats']['drive_minutes_min'])}–"
                f"{_hm(pick['stats']['drive_minutes_max'])} of total driving. Open it in the Planner to customise each day.")
        return {"text": text, "cards": [{"type": "itinerary", "slug": pick["slug"]}]}

    topic_map = [
        (r"\b(eat|food|dish|restaurant|try|cuisine|byrek|seafood)\b", "food"),
        (r"\b(emergency|police|ambulance|fire|112|help)\b", "emergency"),
        (r"\b(pack|bring|luggage|checklist)\b", "packing"),
        (r"\b(corfu|ferry|greece)\b", "corfu"),
        (r"\b(money|cash|lek|euro|atm|card)\b", "money"),
        (r"\b(safe|safety|driving|parking|etiquette)\b", "safety"),
        (r"\b(beach|beaches|swim)\b", "beaches"),
        (r"\b(when|best time|season|month)\b", "seasons"),
    ]
    for pattern, topic in topic_map:
        if re.search(pattern, q):
            return {"text": _topic_text(topic), "cards": []}

    if places:
        d = knowledge.destination_detail(places[0])
        conns = ", ".join(f"{c['name']} ({_hm(c['min_minutes'])}–{_hm(c['max_minutes'])})" for c in d["connections"][:3])
        text = (f"**{d['name']}** — {d['summary']}\n\n- Best for: {d['best_for'] or d['category_label']}\n"
                f"- Suggested time: {_hm(d['visit_min'])}–{_hm(d['visit_max'])}\n"
                + (f"- Tip: {d['planning_note']}\n" if d["planning_note"] else "")
                + (f"- Nearby: {conns}" if conns else ""))
        return {"text": text, "cards": [{"type": "destination", "slug": d["slug"]}]}

    return {"text": ("I'm your Saranda Companion. Try asking:\n- *How long from Tirana to Ksamil?*\n"
                     "- *Plan 10 days in Albania*\n- *Budget for 2 people, 7 days in August*\n"
                     "- *What should I eat in Gjirokastër?*\n- *Weather in Sarandë*\n- *Show me local guides*"),
            "cards": []}


def _topic_text(topic):
    data = knowledge.essentials_topic(topic)
    if topic == "food":
        return "**What to order:**\n" + "\n".join(f"- **{f['name']}** — {f['what']}" for f in data["dishes"]) + f"\n\n{data['restaurant_tip']}"
    if topic == "emergency":
        return "**Emergency numbers in Albania:**\n" + "\n".join(f"- {n['service']}: **{n['number']}**" for n in data["numbers"])
    if topic == "packing":
        return "\n\n".join(f"**{k}:** " + ", ".join(v) for k, v in data["packing"].items())
    if topic == "corfu":
        return data["summary"] + "\n\n" + "\n".join(f"- {c}" for c in data["checklist"]) + "\n\n" + \
            "\n".join(f"- **{c['length']}:** {c['idea']}" for c in data["combos"])
    if topic == "money":
        return "\n".join(f"- {m}" for m in data["money"])
    if topic == "safety":
        return "\n".join(f"- **{s['topic']}:** {s['tip']}" for s in data["safety"])
    if topic == "beaches":
        return "**Pick a beach by the experience you want:**\n" + "\n".join(
            f"- **{b['name']}** — {b['best_for']} ({b['note']})" for b in data["beaches"]) + f"\n\n{data['rule']}"
    if topic == "seasons":
        return "\n".join(f"- **{s['months']}** ({s['verdict']}): {s['text']}" for s in data["seasons"])
    return json.dumps(data)


def answer(messages):
    """Answer the latest user message. ``messages`` is validated history."""
    cfg = current_app.config
    if cfg.get("ANTHROPIC_API_KEY") and cfg.get("CONCIERGE_ENABLED"):
        try:
            return _claude_answer(messages)
        except Exception as exc:  # network/API failure: degrade gracefully
            log.warning("concierge falling back to offline engine: %s", exc.__class__.__name__)
    result = offline_answer(messages[-1]["content"])
    result["engine"] = "offline"
    return result

// A drop-in stand-in for the Flask API, used when the site is hosted as plain
// files (e.g. uploaded to Namecheap public_html with no Python app).
//
// Read-only endpoints are served from responses captured from the real API at
// build time (scripts/export_static.py). Route, timeline, budget, quote and
// concierge answers come from JS ports of the Python engines (parity-tested).
// Anything that would store data (bookings, guide requests, messages) returns
// a "handoff": a ready-to-send WhatsApp / email message for the guest.
import { createBudget } from "./budget";
import { createConcierge } from "./concierge";
import { createLive } from "./live";
import { EngineError } from "./py";
import { createRouting, UnknownPlace } from "./routing";
import { createTimeline } from "./timeline";
import { isPackedTrip, packTrip, unpackTrip } from "./tripLink";
import { validate } from "./validate";

const notFound = (message = "Not found") => Object.assign(new EngineError({ _: message }, 404), { message });

export function createLocalApi(staticApi, { contactEmail, whatsapp, liveData = true, osrmUrl, today } = {}) {
  const { responses, data } = staticApi;
  const routing = createRouting(data);
  const timeline = createTimeline(data, routing);
  const budget = createBudget(data);
  const live = createLive(data, routing, { enabled: liveData, osrmUrl });
  const concierge = createConcierge(data, responses, { routing, budget, eurToAll: live.eurToAll, weather: live.weather });
  const config = {
    ...responses["/meta/config"],
    whatsapp: whatsapp || responses["/meta/config"].whatsapp || null,
    contact_email: contactEmail || responses["/meta/config"].contact_email,
    road_geometry: Boolean(liveData && osrmUrl),
    stats: false, // nothing counts visits on a plain-files copy
  };
  const todayIso = () => (today ? today() : new Date().toISOString().slice(0, 10));
  const addDaysIso = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const nightsBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

  function handoff(subject, lines) {
    const body = lines.filter(Boolean).join("\n");
    const wa = config.whatsapp ? `https://wa.me/${config.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(`${subject}\n\n${body}`)}` : null;
    const mail = config.contact_email ? `mailto:${config.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
    return { subject, summary: body, whatsapp_url: wa, mailto_url: mail, email: config.contact_email };
  }

  const placeName = (s) => routing.index[s]?.name || s;

  // ---- handlers -----------------------------------------------------------
  function connect(q) {
    const args = validate({ from: { kind: "slug", required: true }, to: { kind: "slug", required: true }, via: { max_len: 400 }, modes: { max_len: 40 } }, q);
    const via = (args.via || "").split(",").filter(Boolean).slice(0, 8);
    let modes;
    if (args.modes) {
      modes = args.modes.split(",").filter((m) => ["drive", "ferry", "boat"].includes(m));
      if (!modes.length) throw new EngineError({ modes: "modes must include drive, ferry or boat" });
    }
    try {
      const result = routing.routeThrough([args.from, ...via, args.to], modes);
      result.directions_url = routing.googleDirectionsUrl(result.hops);
      return result;
    } catch (e) {
      if (e instanceof UnknownPlace) throw new EngineError({ from: e.message });
      throw e;
    }
  }

  const DAY_SCHEMA = {
    title: { max_len: 80 },
    stops: { kind: "list", required: true, min: 1, max_items: 10, item: { kind: "slug", required: true } },
    start_time: { kind: "hhmm", default: "08:30" },
    notes: { kind: "text", max_len: 500 },
  };

  function cleanDays(raw) {
    if (!Array.isArray(raw) || !raw.length) throw new EngineError({ days: "Add at least one day" });
    if (raw.length > 30) throw new EngineError({ days: "At most 30 days" });
    const days = [];
    const errors = {};
    raw.forEach((d, i) => {
      try {
        const day = validate(DAY_SCHEMA, d);
        const unknown = day.stops.filter((s) => !routing.index[s]);
        if (unknown.length) errors[`days.${i}`] = { stops: `Unknown destination(s): ${unknown.join(", ")}` };
        else days.push(day);
      } catch (e) {
        if (!(e instanceof EngineError)) throw e;
        errors[`days.${i}`] = e.fields;
      }
    });
    if (Object.keys(errors).length) throw new EngineError(errors);
    return days;
  }

  function planTimeline(body) {
    const opts = validate({ pace: { choices: Object.keys(timeline.paces), default: "balanced" }, start_date: { kind: "date" } }, body || {});
    const days = cleanDays((body || {}).days);
    try {
      return timeline.buildTrip(days, { pace: opts.pace, startDate: opts.start_date });
    } catch (e) {
      throw new EngineError({ days: e.message });
    }
  }

  const BUDGET_SCHEMA = {
    travelers: { kind: "int", required: true, min: 1, max: 20 },
    days: { kind: "int", required: true, min: 1, max: 30 },
    style: { choices: ["budget", "comfort", "premium"], default: "comfort" },
    month: { kind: "int", min: 1, max: 12 },
    car_days: { kind: "int", min: 0, max: 30, default: 0 },
    boat_days: { kind: "int", min: 0, max: 10, default: 0 },
    private_boat: { kind: "bool", default: false },
    guide_day_rate: { kind: "float", min: 0, max: 2000 },
    guide_days: { kind: "int", min: 0, max: 30, default: 0 },
  };

  async function planBudget(body) {
    const args = validate(BUDGET_SCHEMA, body);
    if (args.car_days > args.days) throw new EngineError({ car_days: "Car days can't exceed trip days" });
    return budget.estimate({ ...args, eur_to_all: await live.eurToAll() });
  }

  const STAY_SCHEMA = {
    hotel_id: { kind: "int", required: true, min: 1, label: "Stay" },
    start_date: { kind: "date", required: true, label: "Check-in" },
    end_date: { kind: "date", required: true, label: "Check-out" },
    guest_count: { kind: "int", required: true, min: 1, max: 40, label: "Guests" },
  };

  function validateStay(body) {
    const d = validate(STAY_SCHEMA, body);
    const hotel = responses[`/hotels/${d.hotel_id}`];
    if (!hotel) throw new EngineError({ hotel_id: "Stay not found" });
    if (d.start_date < todayIso()) throw new EngineError({ start_date: "Check-in can't be in the past" });
    const nights = nightsBetween(d.start_date, d.end_date);
    if (nights < 1) throw new EngineError({ end_date: "Check-out must be after check-in" });
    if (nights > 60) throw new EngineError({ end_date: "For stays over 60 nights, contact us directly" });
    if (nights < (hotel.min_nights || 1)) throw new EngineError({ end_date: `Minimum stay is ${hotel.min_nights} nights` });
    if (d.guest_count > (hotel.max_guests || 1)) throw new EngineError({ guest_count: `This stay sleeps up to ${hotel.max_guests}` });
    return { d, hotel, nights, total: Math.round((hotel.price_per_night * nights + (hotel.cleaning_fee || 0)) * 100) / 100 };
  }

  function quote(body) {
    const { hotel, nights, total } = validateStay(body);
    return { hotel_id: hotel.id, nights, nightly: hotel.price_per_night, cleaning_fee: hotel.cleaning_fee || 0, total, currency: "EUR", available: true };
  }

  const CONTACT = {
    name: { required: true, max_len: 120, label: "Name" },
    email: { kind: "email", required: true, label: "Email" },
    phone: { kind: "phone", label: "Phone" },
  };

  function bookStay(body) {
    if (body?.website) throw new EngineError({ _: "Request rejected" });
    const { d, hotel, nights, total } = validateStay(body);
    const c = validate({ guest_name: { ...CONTACT.name }, guest_email: { ...CONTACT.email }, guest_phone: CONTACT.phone, notes: { kind: "text", max_len: 1500 } }, body);
    return {
      booking: null,
      payment_required: false,
      handoff: handoff(`Booking request: ${hotel.hotel_name}`, [
        `Stay: ${hotel.hotel_name}`,
        `Dates: ${d.start_date} → ${d.end_date} (${nights} night${nights === 1 ? "" : "s"})`,
        `Guests: ${d.guest_count}`,
        `Quoted total: €${total.toFixed(2)}`,
        `Name: ${c.guest_name}`,
        `Email: ${c.guest_email}`,
        c.guest_phone && `Phone: ${c.guest_phone}`,
        c.notes && `Notes: ${c.notes}`,
      ]),
    };
  }

  function requestGuide(slug, body) {
    const g = responses[`/guides/${slug}`];
    if (!g) throw notFound("Guide not found");
    if (body?.website) throw new EngineError({ _: "Request rejected" });
    const d = validate({
      tour_date: { kind: "date", required: true, label: "Date" },
      duration: { choices: ["half", "full", "multi"], required: true },
      days: { kind: "int", min: 1, max: 14, default: 1 },
      group_size: { kind: "int", required: true, min: 1, max: 60, label: "Group size" },
      itinerary_slug: { kind: "slug" },
      stops: { kind: "list", max_items: 12, item: { kind: "slug", required: true } },
      pickup: { max_len: 200 },
      language: { max_len: 40 },
      ...CONTACT,
      message: { kind: "text", max_len: 2000 },
    }, body);
    const today = todayIso();
    if (d.tour_date <= today) throw new EngineError({ tour_date: "Pick a date from tomorrow onwards" });
    if (d.tour_date > addDaysIso(today, 540)) throw new EngineError({ tour_date: "Requests open up to 18 months ahead" });
    if (d.group_size > g.max_group) throw new EngineError({ group_size: `${g.name} guides groups of up to ${g.max_group}` });
    if (d.itinerary_slug && !responses[`/itineraries/${d.itinerary_slug}`]) throw new EngineError({ itinerary_slug: "Unknown itinerary" });
    if (d.language && !g.languages.includes(d.language)) throw new EngineError({ language: `${g.name} doesn't guide in ${d.language}` });
    const days = d.duration === "multi" ? d.days : 1;
    const price = d.duration === "half" ? g.price_half_day : d.duration === "full" ? g.price_full_day : g.price_full_day * days;
    const label = { half: "Half day (≈4h)", full: "Full day (≈8h)", multi: "Multi-day" }[d.duration];
    return {
      reference: null,
      guide: { slug: g.slug, name: g.name },
      tour_date: d.tour_date,
      duration: d.duration,
      duration_label: label,
      days,
      group_size: d.group_size,
      language: d.language,
      quoted_price: price,
      status: "handoff",
      handoff: handoff(`Guide request: ${g.name}`, [
        `Guide: ${g.name}`,
        `Date: ${d.tour_date} · ${label}${days > 1 ? ` · ${days} days` : ""}`,
        `Group: ${d.group_size}${d.language ? ` · ${d.language}` : ""}`,
        `Estimated price: €${price}`,
        (d.stops || []).length ? `Stops: ${d.stops.map(placeName).join(" → ")}` : null,
        d.pickup && `Pickup: ${d.pickup}`,
        `Name: ${d.name}`,
        `Email: ${d.email}`,
        d.phone && `Phone: ${d.phone}`,
        d.message && `Message: ${d.message}`,
      ]),
    };
  }

  function contact(body) {
    if (body?.website) return { ok: true };
    const d = validate({ ...CONTACT, topic: { choices: ["stay", "guide", "trip", "general"], default: "general" }, message: { kind: "text", required: true, max_len: 3000 } }, body);
    return { ok: true, handoff: handoff(`Website message (${d.topic})`, [d.message, "", `— ${d.name} <${d.email}>`]) };
  }

  async function ask(body) {
    const raw = (body || {}).messages;
    if (!Array.isArray(raw) || !raw.length) throw new EngineError({ messages: "Send at least one message" });
    const msgs = [];
    for (const m of raw.slice(-16)) {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
        throw new EngineError({ messages: "Each message needs a role and text content" });
      }
      const text = m.content.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim().slice(0, 1500);
      if (!text) continue;
      if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += "\n\n" + text;
      else msgs.push({ role: m.role, content: text });
    }
    while (msgs.length && msgs[0].role !== "user") msgs.shift();
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") throw new EngineError({ messages: "The last message must be from the traveller" });
    return { ...(await concierge.answer(msgs[msgs.length - 1].content)), engine: "offline" };
  }

  const TRIP_SCHEMA = {
    title: { required: true, max_len: 120 },
    start_date: { kind: "date" },
    travelers: { kind: "int", min: 1, max: 20, default: 2 },
    style: { choices: ["budget", "comfort", "premium"], default: "comfort" },
    pace: { choices: Object.keys(timeline.paces), default: "balanced" },
    template: { kind: "slug" },
  };

  // Same rules as the API's _trip_payload(); also applied to trips read from links.
  function cleanTrip(body) {
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new EngineError({ _: "Expected a JSON object" });
    if (JSON.stringify(body).length > 64 * 1024) throw new EngineError({ _: "Trip is too large" });
    const meta = validate(TRIP_SCHEMA, body);
    const days = cleanDays(body.days);
    const raw = body.checklist || {};
    if (typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length > 100) throw new EngineError({ checklist: "Invalid checklist" });
    const checklist = Object.fromEntries(Object.entries(raw).map(([k, v]) => [String(k).slice(0, 120), Boolean(v)]));
    return { ...meta, days, checklist };
  }

  async function saveTrip(body) {
    const data = cleanTrip(body);
    const id = await packTrip({ title: data.title, data });
    const now = new Date().toISOString();
    return { share_id: id, title: data.title, data, created_at: now, updated_at: now, edit_key: null };
  }

  async function getTrip(id) {
    if (!isPackedTrip(id)) throw notFound("Trip not found");
    try {
      // Links are untrusted input: re-validate exactly like a newly saved trip.
      const { data } = await unpackTrip(id);
      const clean = cleanTrip(data);
      return { share_id: id, title: clean.title, data: clean, created_at: null, updated_at: null };
    } catch {
      throw notFound("Trip not found");
    }
  }

  function filterGuides(q) {
    const all = responses["/guides/"];
    const lc = (s) => String(s || "").toLowerCase();
    const guides = all.guides.filter((g) =>
      (!q.language || g.languages.some((l) => lc(l) === lc(q.language)))
      && (!q.specialty || g.specialties.some((s) => lc(s) === lc(q.specialty)))
      && (!q.region || g.regions.includes(q.region))
      && (!(q.vehicle === "true" || q.vehicle === "1") || g.has_vehicle)
      && (!q.group || g.max_group >= Number(q.group)));
    return { guides, facets: all.facets };
  }

  function filterDestinations(q) {
    const all = responses["/destinations"];
    const norm = (s) => String(s).toLowerCase().normalize("NFKD").replace(/\p{Mn}/gu, "");
    const words = norm(q.q || "").split(/\s+/).filter(Boolean);
    const destinations = all.destinations.filter((d) =>
      (!q.category || d.category === q.category) && (!q.region || d.region === q.region)
      && (!words.length || words.every((w) => norm([d.name, d.summary, d.tags.join(" "), d.best_for].join(" ")).includes(w))));
    return { ...all, destinations };
  }

  // ---- router -------------------------------------------------------------
  const ROUTES = [
    ["GET", /^\/meta\/health$/, () => ({ status: "ok", database: false, mode: "static" })],
    ["GET", /^\/meta\/config$/, () => config],
    // Accounts and online payments need the Python app; here everyone is a visitor.
    ["GET", /^\/auth\/me$/, () => ({ user: null, email_delivery: false })],
    ["GET", /^\/destinations$/, (m, q) => filterDestinations(q)],
    ["GET", /^\/destinations\/([a-z0-9-]+)\/place$/, () => ({ configured: false })],
    ["GET", /^\/destinations\/([a-z0-9-]+)\/links$/, (m) => responses[`/destinations/${m[1]}/links`] || Promise.reject(notFound("Destination not found"))],
    ["GET", /^\/destinations\/([a-z0-9-]+)$/, (m) => responses[`/destinations/${m[1]}`] || Promise.reject(notFound("Destination not found"))],
    ["GET", /^\/itineraries$/, () => responses["/itineraries"]],
    ["GET", /^\/itineraries\/([a-z0-9-]+)$/, (m) => responses[`/itineraries/${m[1]}`] || Promise.reject(notFound("Itinerary not found"))],
    ["GET", /^\/essentials$/, () => responses["/essentials"]],
    ["GET", /^\/routes\/graph$/, () => responses["/routes/graph"]],
    ["GET", /^\/routes\/connect$/, (m, q) => connect(q)],
    ["GET", /^\/routes\/geometry$/, (m, q) => {
      const stops = (q.stops || "").split(",").filter(Boolean).slice(0, 12);
      if (stops.length < 2) throw new EngineError({ stops: "Provide at least two stops" });
      try {
        stops.forEach(routing.place);
      } catch (e) {
        throw new EngineError({ stops: e.message });
      }
      return live.geometry(stops);
    }],
    ["GET", /^\/live\/weather$/, (m, q) => live.weather(q.place || "sarande")],
    ["GET", /^\/live\/fx$/, () => live.fx()],
    ["GET", /^\/guides\/?$/, (m, q) => filterGuides(q)],
    ["GET", /^\/guides\/requests\/([A-Za-z0-9-]+)$/, () => Promise.reject(notFound("Request not found"))],
    ["GET", /^\/guides\/([a-z0-9-]+)\/availability$/, (m, q) => {
      if (!responses[`/guides/${m[1]}`]) throw notFound("Guide not found");
      const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month || "") ? q.month : todayIso().slice(0, 7);
      return { month, busy: [], earliest: addDaysIso(todayIso(), 1) };
    }],
    ["GET", /^\/guides\/([a-z0-9-]+)$/, (m) => responses[`/guides/${m[1]}`] || Promise.reject(notFound("Guide not found"))],
    ["GET", /^\/hotels\/?$/, () => responses["/hotels/"]],
    ["GET", /^\/hotels\/(\d+)\/availability$/, (m) => ({ hotel_id: Number(m[1]), booked_nights: [] })],
    ["GET", /^\/hotels\/(\d+)$/, (m) => responses[`/hotels/${m[1]}`] || Promise.reject(notFound("Stay not found"))],
    ["GET", /^\/tours\/?$/, () => responses["/tours/"]],
    ["GET", /^\/car_rentals\/?$/, (m, q) => responses["/car_rentals/"].filter((c) => !q.type || c.car_type === q.type)],
    // Partner businesses sign up and are reviewed on the server; a static copy has none.
    ["GET", /^\/businesses\/?$/, () => ({ businesses: [] })],
    ["GET", /^\/trips\/([^/]+)$/, (m) => getTrip(m[1])],
    ["GET", /^\/bookings\/([A-Za-z0-9-]+)$/, () => Promise.reject(notFound("Booking not found"))],
    ["POST", /^\/planner\/timeline$/, (m, q, b) => planTimeline(b)],
    ["POST", /^\/planner\/budget$/, (m, q, b) => planBudget(b)],
    ["POST", /^\/bookings\/quote$/, (m, q, b) => quote(b)],
    ["POST", /^\/bookings\/?$/, (m, q, b) => bookStay(b)],
    ["POST", /^\/guides\/([a-z0-9-]+)\/requests$/, (m, q, b) => requestGuide(m[1], b)],
    ["POST", /^\/contact\/?$/, (m, q, b) => contact(b)],
    ["POST", /^\/concierge\/?$/, (m, q, b) => ask(b)],
    ["POST", /^\/trips$/, (m, q, b) => saveTrip(b)],
    ["PUT", /^\/trips\/([^/]+)$/, (m, q, b) => saveTrip(b)],
  ];

  async function request(path, { method = "GET", body } = {}) {
    const [p, qs = ""] = path.split("?");
    const q = Object.fromEntries(new URLSearchParams(qs));
    for (const [verb, re, fn] of ROUTES) {
      if (verb !== method) continue;
      const m = re.exec(p);
      if (m) return fn(m, q, body);
    }
    throw notFound("Not found");
  }

  return { request, routing, timeline, budget, concierge, live, config, tripNames: () => Object.fromEntries(Object.values(routing.index).map((d) => [d.slug, d.name])) };
}

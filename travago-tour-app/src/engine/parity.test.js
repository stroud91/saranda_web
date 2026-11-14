// The static-hosting engines must answer exactly like the Flask API.
// Fixtures are produced by scripts/export_static.py from the Python engines.
import { describe, expect, it } from "vitest";
import staticApi from "../data/static-api.json";
import fixtures from "./parity.fixtures.json";
import { createLocalApi } from "./localApi";
import { pyRound } from "./py";
import { isPackedTrip, packTrip, tripCalendar, unpackTrip } from "./tripLink";

const local = createLocalApi(staticApi, { liveData: false });
// The published bundle hides the sample guides; these tests put them back to cover the guide flow.
const withSamples = { ...staticApi, responses: { ...staticApi.responses, ...fixtures.sample_guides.responses } };
const sampleLocal = createLocalApi(withSamples, { liveData: false });

// What the browser client sees: the JSON body on success, {error, fields} on failure.
async function call(path, opts, engine = local) {
  try {
    return { status: 200, body: await engine.request(path, opts) };
  } catch (e) {
    if (!e.fields) throw e;
    return { status: e.status, body: e.status === 404 ? { error: e.message } : { error: e.message, fields: e.fields } };
  }
}

describe("python helpers", () => {
  it("rounds half to even like Python", () => {
    expect([0.5, 1.5, 2.5, 3.5, 2.675].map((x) => pyRound(x))).toEqual([0, 2, 2, 4, 3]);
    expect(pyRound(1234, -2)).toBe(1200);
    expect(pyRound(1250, -2)).toBe(1200);
    expect(pyRound(1350, -2)).toBe(1400);
  });
});

describe("route connections", () => {
  it.each(fixtures.connect.map((c) => [c.query, c]))("%s", async (query, c) => {
    expect(await call(`/routes/connect?${query}`)).toEqual({ status: c.status, body: c.body });
  });
});

describe("day timelines", () => {
  it.each(fixtures.timeline.map((c, i) => [i, c]))("case %i", async (i, c) => {
    expect(await call("/planner/timeline", { method: "POST", body: c.input })).toEqual({ status: c.status, body: c.body });
  });
});

describe("budgets", () => {
  it.each(fixtures.budget.map((c, i) => [i, c]))("case %i", async (i, c) => {
    expect(await call("/planner/budget", { method: "POST", body: c.input })).toEqual({ status: c.status, body: c.body });
  });
});

describe("stay quotes", () => {
  it.each(fixtures.quote.map((c, i) => [i, c]))("case %i", async (i, c) => {
    expect(await call("/bookings/quote", { method: "POST", body: c.input })).toEqual({ status: c.status, body: c.body });
  });
});

describe("offline concierge", () => {
  it.each(fixtures.concierge.map((c) => [c.input, c]))("%s", async (q, c) => {
    const body = { messages: [{ role: "user", content: q }] };
    expect(await call("/concierge/", { method: "POST", body })).toEqual({ status: c.status, body: c.body });
  });
});

describe("captured GET responses", () => {
  it("serves every exported path", async () => {
    for (const [path, body] of Object.entries(staticApi.responses)) {
      if (path === "/meta/config") continue;
      expect((await call(path)).body, path).toEqual(body);
    }
  });
  it("filters guides by language and group size", async () => {
    const all = withSamples.responses["/guides/"].guides;
    const lang = all[0].languages[0];
    const { body } = await call(`/guides/?language=${encodeURIComponent(lang)}&group=1`, undefined, sampleLocal);
    expect(body.guides.length).toBeGreaterThan(0);
    expect(body.guides.every((g) => g.languages.includes(lang))).toBe(true);
    expect((await call("/guides/?group=999", undefined, sampleLocal)).body.guides).toEqual([]);
  });
  it("hides the sample guides in the published bundle", async () => {
    expect((await call("/meta/config")).body.guides).toBe(false);
    expect((await call("/guides/")).body.guides).toEqual([]);
    expect((await call(`/guides/${withSamples.responses["/guides/"].guides[0].slug}`)).status).toBe(404);
  });
  it("answers guide questions like the server, with and without guides", async () => {
    const c = fixtures.sample_guides.concierge;
    const body = { messages: [{ role: "user", content: c.input }] };
    expect(await call("/concierge/", { method: "POST", body }, sampleLocal)).toEqual({ status: c.status, body: c.body });
    expect((await call("/concierge/", { method: "POST", body })).body.text).toContain("coming soon");
  });
  it("404s unknown things", async () => {
    expect((await call("/destinations/atlantis")).status).toBe(404);
    expect((await call("/guides/nobody")).status).toBe(404);
    expect((await call("/nope")).status).toBe(404);
  });
  it("reports static mode with payments and AI off", async () => {
    const { body } = await call("/meta/config");
    expect(body.mode).toBe("static");
    expect(body.payments.enabled).toBe(false);
    expect(body.concierge.ai).toBe(false);
  });
});

describe("handoffs instead of storage", () => {
  const hotel = staticApi.responses["/hotels/"][0];
  const guide = withSamples.responses["/guides/"].guides[0];

  it("turns a stay booking into a ready-to-send message", async () => {
    const withContact = createLocalApi(staticApi, { liveData: false, whatsapp: "+355 69 000 0000", contactEmail: "hello@example.com" });
    const body = { hotel_id: hotel.id, start_date: "2035-06-10", end_date: "2035-06-14", guest_count: 2, guest_name: "Ana", guest_email: "ana@example.com" };
    const res = await withContact.request("/bookings", { method: "POST", body });
    expect(res.payment_required).toBe(false);
    expect(res.handoff.whatsapp_url).toMatch(/^https:\/\/wa\.me\/355690000000\?text=/);
    expect(res.handoff.mailto_url).toMatch(/^mailto:hello@example\.com\?subject=/);
    expect(res.handoff.summary).toContain("4 nights");
    expect(res.handoff.summary).toContain("Ana");
  });

  it("validates booking contact details", async () => {
    const body = { hotel_id: hotel.id, start_date: "2035-06-10", end_date: "2035-06-14", guest_count: 2, guest_name: "Ana", guest_email: "nope" };
    const res = await call("/bookings", { method: "POST", body });
    expect(res.body.fields).toEqual({ guest_email: "Enter a valid email address" });
  });

  it("prices a guide request and checks the group size", async () => {
    const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const base = { tour_date: soon, duration: "full", group_size: 2, name: "Ana", email: "ana@example.com" };
    const ok = await sampleLocal.request(`/guides/${guide.slug}/requests`, { method: "POST", body: base });
    expect(ok.quoted_price).toBe(guide.price_full_day);
    expect(ok.handoff.summary).toContain(guide.name);
    const multi = await sampleLocal.request(`/guides/${guide.slug}/requests`, { method: "POST", body: { ...base, duration: "multi", days: 3 } });
    expect(multi.quoted_price).toBe(guide.price_full_day * 3);
    const big = await call(`/guides/${guide.slug}/requests`, { method: "POST", body: { ...base, group_size: guide.max_group + 1 } }, sampleLocal);
    expect(big.body.error).toBe(`${guide.name} guides groups of up to ${guide.max_group}`);
    const past = await call(`/guides/${guide.slug}/requests`, { method: "POST", body: { ...base, tour_date: "2001-01-01" } }, sampleLocal);
    expect(past.body.error).toBe("Pick a date from tomorrow onwards");
  });

  it("drops honeypot contact messages silently", async () => {
    expect(await local.request("/contact", { method: "POST", body: { website: "spam" } })).toEqual({ ok: true });
    const res = await local.request("/contact", { method: "POST", body: { name: "Ana", email: "ana@example.com", message: "Hi" } });
    expect(res.handoff.summary).toContain("Hi");
  });
});

describe("trips packed into the link", () => {
  const trip = { title: "Riviera week", start_date: "2035-06-01", days: [{ stops: ["sarande", "ksamil"], title: "Beach day" }, { stops: ["butrint"] }], checklist: { passport: true } };

  it("round-trips through the share id", async () => {
    const saved = await local.request("/trips", { method: "POST", body: trip });
    expect(isPackedTrip(saved.share_id)).toBe(true);
    const loaded = await local.request(`/trips/${saved.share_id}`);
    expect(loaded.title).toBe("Riviera week");
    expect(loaded.data.days[0].stops).toEqual(["sarande", "ksamil"]);
    expect(loaded.data.days[1].start_time).toBe("08:30");
    expect(loaded.data.checklist).toEqual({ passport: true });
  });

  it("compresses long trips", async () => {
    const days = Array.from({ length: 14 }, () => ({ stops: ["sarande", "ksamil", "butrint", "blue-eye"], notes: "Swim, lunch, sunset." }));
    const id = await packTrip({ title: "Two weeks", data: { days } });
    expect(id.startsWith("z.")).toBe(true);
    expect(id.length).toBeLessThan(JSON.stringify(days).length);
    expect((await unpackTrip(id)).data.days).toHaveLength(14);
  });

  it("refuses decompression bombs and malformed trips from links", async () => {
    // ~2 MB of zeros compresses to a tiny link; it must be refused, not inflated.
    const big = new Uint8Array(2 * 1024 * 1024);
    const out = new Blob([big]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(out).arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    const bomb = "z." + btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await expect(unpackTrip(bomb)).rejects.toThrow("Trip is too large");
    expect((await call(`/trips/${bomb}`)).status).toBe(404);
    const bad = await packTrip({ title: "x", data: { title: "x", days: "not-a-list" } });
    expect((await call(`/trips/${bad}`)).status).toBe(404);
    const xss = await packTrip({ title: "x", data: { title: "<img src=x onerror=alert(1)>", days: [{ stops: ["sarande"], notes: "\u0000hi" }] } });
    const loaded = await local.request(`/trips/${xss}`);
    expect(loaded.data.days[0].notes).toBe("hi");
  });

  it("rejects tampered ids and unknown stops", async () => {
    expect((await call("/trips/z.not-really-deflate")).status).toBe(404);
    expect((await call("/trips/abc123")).status).toBe(404);
    const bad = await call("/trips", { method: "POST", body: { title: "x", days: [{ stops: ["atlantis"] }] } });
    expect(bad.body.error).toBe("Unknown destination(s): atlantis");
  });

  it("builds a calendar file", () => {
    const ics = tripCalendar("Riviera week", "2035-06-01", trip.days, "abc", { sarande: "Sarandë", ksamil: "Ksamil", butrint: "Butrint" });
    expect(ics).toContain("DTSTART;VALUE=DATE:20350601");
    expect(ics).toContain("DTSTART;VALUE=DATE:20350602");
    expect(ics).toContain("SUMMARY:Day 1: Beach day");
    expect(ics).toContain("Sarandë → Ksamil");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

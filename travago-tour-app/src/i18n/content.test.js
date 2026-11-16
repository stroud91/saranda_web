// Travel content must be fully translated: if a sentence in app/data changes or is
// added, the exported bundle changes with it and this test names what needs a row.
import { describe, expect, it } from "vitest";
import rows from "./content";
import bundle from "../data/static-api.json";
import { CONTENT_KEYS, applyLang, localizeContent, loc } from "./index";

// Short place names used as headings are the same in every language.
const SAME = new Set(["Blloku", "Durrës → Berat", "Berat → Gjirokastër", "Butrint + Ksamil", "Tirana", "Berat", "Gjirokastër", "Jalë", "Palasë", "Shkodër", "Theth", "Himarë / Dhërmi"]);
const marks = (s) => (s.match(/\d/g) || []).sort().join("");

function sentences() {
  const found = new Set();
  const walk = (node, key) => {
    if (typeof node === "string") { if (CONTENT_KEYS.has(key) && key !== "name" && /\p{L}/u.test(node)) found.add(node); return; }
    if (Array.isArray(node)) return node.forEach((v) => walk(v, key));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (k === "packing") Object.entries(v).forEach(([group, items]) => { found.add(group); items.forEach((s) => found.add(s)); });
        else walk(v, k);
      }
    }
  };
  for (const [path, answer] of Object.entries(bundle.responses)) {
    if (/^\/(destinations(\/[\w-]+)?|itineraries(\/[\w-]+)?|essentials)$/.test(path)) walk(answer, "");
  }
  return found;
}

describe("travel content", () => {
  it("has five non-empty columns per row and no repeated English text", () => {
    const seen = new Set();
    for (const row of rows) {
      expect(row, row[0]).toHaveLength(5);
      for (const cell of row) expect(typeof cell === "string" && cell.trim().length > 0, row[0]).toBe(true);
      expect(seen.has(row[0]), `duplicate: ${row[0]}`).toBe(false);
      seen.add(row[0]);
    }
  });
  it("keeps every number in every language", () => {
    for (const row of rows) for (const cell of row.slice(1)) expect(marks(cell), row[0]).toBe(marks(row[0]));
  });
  it("covers every sentence the travel API sends", () => {
    const have = new Set(rows.map((r) => r[0]));
    const missing = [...sentences()].filter((s) => !have.has(s) && !SAME.has(s));
    expect(missing).toEqual([]);
  });
  it("has no rows for text that no longer exists", () => {
    const used = sentences();
    for (const region of Object.values(bundle.responses["/destinations"].regions)) used.add(region.name);
    expect(rows.map((r) => r[0]).filter((s) => !used.has(s))).toEqual([]);
  });
});

describe("localizeContent and loc", () => {
  it("translates sentences and leaves identifiers, names of places and numbers alone", async () => {
    const butrint = bundle.responses["/destinations/butrint"];
    await applyLang("en");
    expect(localizeContent(butrint)).toBe(butrint);
    await applyLang("de");
    const de = localizeContent(butrint);
    expect(de).not.toBe(butrint);
    expect(de.summary).toMatch(/UNESCO-Welterbe/);
    expect(de.region_name).toBe("Saranda und Ksamil");
    expect(de.highlights).toContain("Antikes Theater");
    expect(de.tags).toContain("ruinen");
    expect([de.slug, de.name, de.region, de.category, de.scene, de.access]).toEqual([butrint.slug, butrint.name, butrint.region, butrint.category, butrint.scene, butrint.access]);
    expect(de.lat).toBe(butrint.lat);
    expect(butrint.summary).toMatch(/^Major archaeological park/); // the cached answer itself is untouched
    const all = localizeContent(bundle.responses["/destinations"]);
    expect(all.regions.saranda.name).toBe("Saranda und Ksamil");
    expect(all.categories.beach.label).toBe("Strände");
    await applyLang("sq");
    const packing = localizeContent(bundle.responses["/essentials"]).packing;
    expect(Object.keys(packing)).toContain("Plazh dhe verë");
    expect(packing["Plazh dhe verë"]).toContain("Kapelë / syze dielli");
    const week = localizeContent(bundle.responses["/itineraries/7-day-highlights"]);
    expect(week.title).toBe("7 ditë: më të mirat e Shqipërisë");
    expect(week.pace).toBe("active");
    expect(week.days[0].stops).toEqual(bundle.responses["/itineraries/7-day-highlights"].days[0].stops);
    await applyLang("en");
  });
  it("shows a listing in the visitor's language when its host wrote one", async () => {
    const stay = { hotel_name: "Sea View", description: "By the bay.", translations: { it: { description: "Sulla baia." }, sq: { hotel_name: "Pamje nga deti", description: "" } } };
    await applyLang("it");
    expect(loc(stay, "description")).toBe("Sulla baia.");
    expect(loc(stay, "hotel_name")).toBe("Sea View");
    await applyLang("sq");
    expect(loc(stay, "hotel_name")).toBe("Pamje nga deti");
    expect(loc(stay, "description")).toBe("By the bay."); // an empty translation falls back
    await applyLang("fr");
    expect(loc(stay, "description")).toBe("By the bay.");
    expect(loc(null, "description")).toBeUndefined();
    await applyLang("en");
  });
});

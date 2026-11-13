// The translation table must stay well-formed: CI fails if a row is short,
// a phrase is listed twice, or a translation loses a {value} or <tag>.
import { describe, expect, it } from "vitest";
import rows from "./table";
import { LANGS, applyLang, browserLang, currentLang, isLang, locale, plural, rich, tr } from "./index";

const marks = (s) => (s.match(/\{\w+\}|<\/?\w+>/g) || []).sort().join(" ");

describe("translation table", () => {
  it("has five non-empty columns in every row", () => {
    for (const row of rows) {
      expect(row, row[0]).toHaveLength(5);
      for (const cell of row) expect(typeof cell === "string" && cell.trim().length > 0, row[0]).toBe(true);
    }
  });
  it("lists each English phrase once", () => {
    const seen = new Set();
    for (const [en] of rows) {
      expect(seen.has(en), `duplicate: ${en}`).toBe(false);
      seen.add(en);
    }
  });
  it("keeps every {value} and <tag> in every language", () => {
    for (const row of rows) for (const cell of row.slice(1)) expect(marks(cell), row[0]).toBe(marks(row[0]));
  });
});

describe("tr, plural and rich", () => {
  it("offers Albanian, English, French, Italian and German", () => {
    expect(LANGS.map((l) => l.code)).toEqual(["sq", "en", "fr", "it", "de"]);
    expect(isLang("de")).toBe(true);
    expect(isLang("xx")).toBe(false);
    expect(isLang("constructor")).toBe(false);
  });
  it("answers in the chosen language and falls back to English", async () => {
    await applyLang("en");
    expect(tr("Request to book")).toBe("Request to book");
    await applyLang("sq");
    expect(currentLang()).toBe("sq");
    expect(locale()).toBe("sq-AL");
    expect(tr("Request to book")).toBe("Kërko rezervim");
    expect(tr("A phrase nobody has translated yet")).toBe("A phrase nobody has translated yet");
    await applyLang("de");
    expect(tr("up to {n} guests", { n: 4 })).toBe("bis zu 4 Gäste");
    expect(plural(1, "{n} night", "{n} nights")).toBe("1 Nacht");
    expect(plural(3, "{n} night", "{n} nights")).toBe("3 Nächte");
    await applyLang("nonsense");
    expect(currentLang()).toBe("en");
  });
  it("treats values as text, never as markup", async () => {
    await applyLang("fr");
    const parts = rich("Hosted by <a>{name}</a>, an independent local business.", { a: (c) => `[${c}]` }, { name: "<img src=x onerror=alert(1)>" });
    // The name lands inside the link part as a plain string; React escapes strings when it draws them.
    expect(parts.some((p) => typeof p === "object" && p.props.children === "[<img src=x onerror=alert(1)>]")).toBe(true);
    expect(parts.filter((p) => typeof p === "string").join("")).toContain("une entreprise locale indépendante");
    // A value that looks like one of the sentence's own tags is not treated as one.
    const sneaky = rich("Hosted by <a>{name}</a>, an independent local business.", { a: (c) => `[${c}]` }, { name: "x</a><a>y" });
    expect(sneaky.filter((p) => typeof p === "object")).toHaveLength(1);
    expect(sneaky.find((p) => typeof p === "object").props.children).toBe("[x</a><a>y]");
    await applyLang("en");
  });
  it("picks the first browser language we speak", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", { value: { languages: ["es-ES", "it-IT", "en"] }, configurable: true });
    expect(browserLang()).toBe("it");
    Object.defineProperty(globalThis, "navigator", { value: { languages: ["ja"] }, configurable: true });
    expect(browserLang()).toBe("en");
    if (original) Object.defineProperty(globalThis, "navigator", original);
  });
});

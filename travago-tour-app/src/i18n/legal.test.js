// The privacy policy and booking terms must be complete in every language: a sentence
// added or reworded in Legal.jsx without its translations fails here.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import legal from "./legal";
import table from "./table";
import { addTable, applyLang, tr } from "./index";

const marks = (s) => (s.match(/\{\w+\}|<\/?\w+>/g) || []).sort().join(" ");
const numbers = (s) => (s.match(/\d+/g) || []).sort().join(" ");

/** Every sentence the two pages show: tr("…"), R("…"), section titles and contents labels. */
function sentences() {
  const src = fs.readFileSync(new URL("../pages/Legal.jsx", import.meta.url), "utf8")
    .split("\n").filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line)).join("\n");
  const found = new Set();
  const add = (raw) => found.add(JSON.parse(`"${raw}"`));
  for (const m of src.matchAll(/\b(?:tr|R)\(\s*"((?:[^"\\]|\\.)*)"/g)) add(m[1]);
  for (const m of src.matchAll(/<Section id="\w+" title="((?:[^"\\]|\\.)*)"/g)) add(m[1]);
  for (const m of src.matchAll(/\["\w+", "((?:[^"\\]|\\.)*)"\]/g)) add(m[1]);
  return [...found];
}

describe("legal pages", () => {
  it("has five non-empty columns in every row and lists each sentence once", () => {
    const seen = new Set(table.map((r) => r[0]));
    for (const row of legal) {
      expect(row, row[0]).toHaveLength(5);
      for (const cell of row) expect(typeof cell === "string" && cell.trim().length > 0, row[0]).toBe(true);
      expect(seen.has(row[0]), `listed twice: ${row[0]}`).toBe(false);
      seen.add(row[0]);
    }
  });
  it("keeps every value, link, bold marker and number in every language", () => {
    for (const row of legal) {
      for (const cell of row.slice(1)) {
        expect(marks(cell), row[0]).toBe(marks(row[0]));
        expect(numbers(cell), row[0]).toBe(numbers(row[0])); // 14 days stays 14 days
      }
    }
  });
  it("translates every sentence on the privacy policy and the booking terms", () => {
    const known = new Set([...legal, ...table].map((r) => r[0]));
    const all = sentences();
    expect(all.length).toBeGreaterThan(140);
    expect(all.filter((s) => !known.has(s))).toEqual([]);
    // And nothing is left behind in the table after a sentence is removed from the pages.
    expect(legal.map((r) => r[0]).filter((s) => !all.includes(s))).toEqual([]);
  });
  it("is loaded on top of the language in use, and only then", async () => {
    await applyLang("de");
    expect(tr("Who we are")).toBe("Who we are");
    await addTable(() => import("./legal"));
    expect(tr("Who we are")).toBe("Wer wir sind");
    expect(tr("{n} days or more before check-in", { n: 14 })).toBe("14 Tage oder mehr vor der Anreise");
    await applyLang("en");
    await addTable(() => { throw new Error("English needs no table"); });
    expect(tr("Who we are")).toBe("Who we are");
  });
});

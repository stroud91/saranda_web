import { afterEach, describe, expect, it, vi } from "vitest";
import { axisTop, dateTicks } from "./chart";

describe("chart axis", () => {
  it("tops the axis at a round number whose half is a whole number", () => {
    const cases = { 0: 4, 3: 4, 5: 10, 10: 10, 11: 20, 35: 40, 41: 50, 99: 100, 101: 200, 450: 500, 1200: 2000 };
    for (const [value, top] of Object.entries(cases)) {
      expect(axisTop(Number(value))).toBe(top);
      expect(Number.isInteger(top / 2)).toBe(true);
    }
  });
  it("labels every day of a week and five days of longer periods", () => {
    expect(dateTicks(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dateTicks(30)).toEqual([0, 7, 15, 22, 29]);
    expect(dateTicks(365)[4]).toBe(364);
    // A narrow chart gets fewer dates rather than dates printed over each other.
    expect(dateTicks(30, 3)).toEqual([0, 15, 29]);
    expect(dateTicks(7, 4)).toEqual([0, 2, 4, 6]);
    expect(dateTicks(1)).toEqual([0]);
  });
});

describe("page-view counter", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  const setUp = async (nav = {}) => {
    const sent = [];
    vi.stubGlobal("navigator", { languages: ["en"], ...nav });
    vi.stubGlobal("document", { referrer: "https://www.google.com/search?q=saranda" });
    vi.stubGlobal("fetch", vi.fn(async (url, opts = {}) => {
      if (String(url).endsWith("/meta/health")) return { headers: { get: () => "application/json" }, json: async () => ({ status: "ok" }) };
      sent.push({ url, ...JSON.parse(opts.body), cookieless: opts.credentials === "same-origin" });
      return { ok: true };
    }));
    const { countView } = await import("./hits");
    return { sent, countView };
  };

  it("sends the page once, with where the visitor came from only on the first page", async () => {
    const { sent, countView } = await setUp();
    await countView("/stays");
    await countView("/stays"); // the same page again (a re-render) is not a second view
    await countView("/stays/1");
    expect(sent.map((s) => [s.url, s.path, s.referrer, s.lang])).toEqual([
      ["/api/meta/hit", "/stays", "https://www.google.com/search?q=saranda", "en"],
      ["/api/meta/hit", "/stays/1", "", "en"],
    ]);
  });
  it("sends nothing when the browser asks not to be tracked", async () => {
    for (const nav of [{ globalPrivacyControl: true }, { doNotTrack: "1" }]) {
      const { sent, countView } = await setUp(nav);
      await countView("/stays");
      expect(sent).toEqual([]);
      vi.resetModules();
    }
  });
});

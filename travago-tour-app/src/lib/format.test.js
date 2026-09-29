import { describe, expect, it } from "vitest";
import { hm, hmRange, euroRange, hash, addDays } from "./format";
import { project, smoothPath } from "./geo";

describe("format", () => {
  it("formats durations", () => {
    expect(hm(45)).toBe("45 min");
    expect(hm(90)).toBe("1h 30");
    expect(hm(120)).toBe("2h");
    expect(hmRange(60, 90)).toBe("1h – 1h 30");
  });
  it("formats euro ranges", () => {
    expect(euroRange([100, 250])).toMatch(/100.*250/);
  });
  it("hashes deterministically", () => {
    expect(hash("sarande")).toBe(hash("sarande"));
    expect(hash("sarande")).not.toBe(hash("ksamil"));
  });
  it("adds days across months", () => {
    expect(addDays("2027-06-29", 3)).toBe("2027-07-02");
  });
});

describe("geo", () => {
  it("projects into the box", () => {
    const { pts } = project([[41.3, 19.8], [39.87, 20.0]], 200, 100, 10);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(200);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
    expect(pts[0][1]).toBeLessThan(pts[1][1]); // north is up
    expect(smoothPath(pts)).toMatch(/^M.*Q/);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { Markdown } from "./markdown";

const md = (text) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Markdown, { text })));

describe("markdown", () => {
  it("renders bold, lists and internal links", () => {
    const html = md("**Hi**\n\n- one\n- two\n\nSee [the map](/map)");
    expect(html).toContain("<strong>Hi</strong>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain('href="/map"');
  });
  it("never renders HTML or external links", () => {
    const html = md('<img src=x onerror=alert(1)> [x](//evil.com) [y](/\\evil.com) [z](javascript:alert(1))');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("href=\"//");
    expect(html).not.toContain('href="javascript');
    expect(html).not.toMatch(/<a /);
    expect(html).toContain("&lt;img");
  });
});

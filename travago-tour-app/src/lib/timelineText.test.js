import { afterAll, describe, expect, it } from "vitest";
import fixtures from "../engine/parity.fixtures.json";
import { addTable, applyLang } from "../i18n";
import { stepTitle, warningText } from "./timelineText";

/** Every step title and warning the engine produced for the parity fixtures. */
function samples() {
  const titles = new Set(), warnings = [];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n.events)) n.events.forEach((e) => titles.add(e.title));
    if (Array.isArray(n.warnings)) warnings.push(...n.warnings);
    Object.values(n).forEach(walk);
  };
  walk(fixtures);
  return { titles: [...titles], warnings };
}

describe("timeline text", () => {
  afterAll(() => applyLang("en"));
  it("leaves English as it is", async () => {
    await applyLang("en");
    const { titles, warnings } = samples();
    expect(titles.length).toBeGreaterThan(10);
    for (const t of titles) expect(stepTitle(t)).toBe(t);
    for (const w of warnings) expect(warningText(w)).toBe(w.text);
  });
  it("translates every pattern the engine writes", async () => {
    await applyLang("de");
    expect(stepTitle("Drive to Gjirokastër")).toBe("Fahrt nach Gjirokastër");
    expect(stepTitle("Lunch + shade in Sarandë")).toBe("Mittagspause im Schatten in Sarandë");
    expect(warningText({ code: "long-drive", text: "Long travel day (up to 6h10 on the road). Start early and leave buffers for fuel, photos and traffic." }))
      .toBe("Langer Reisetag (bis zu 6h10 unterwegs). Starten Sie früh und planen Sie Puffer für Tanken, Fotos und Verkehr ein.");
    const { titles, warnings } = samples();
    const english = [...titles.map(stepTitle), ...warnings.map(warningText)]
      .filter((s) => /\b(Drive to|Start in|Arrive|Lunch|Back in|Check in|Ferry to|Boat to|falls in the midday|is very busy|Long travel day|If every leg|You reach|schedules are seasonal)\b/.test(s));
    expect(english).toEqual([]);
  });
  it("shows unknown text unchanged", async () => {
    await applyLang("fr");
    expect(stepTitle("Something new")).toBe("Something new");
    expect(warningText({ code: "new-code", text: "A brand new warning." })).toBe("A brand new warning.");
    expect(addTable).toBeTypeOf("function");
  });
});

import { describe, expect, it } from "vitest";
import { fold, groupPlaces } from "./PlacePicker";

const PLACES = [
  { slug: "ksamil", name: "Ksamil", category: "beach" },
  { slug: "tirana", name: "Tirana", category: "city" },
  { slug: "sarande", name: "Sarandë", category: "city" },
  { slug: "gjirokaster", name: "Gjirokastër", category: "history" },
  { slug: "borsh", name: "Borsh", category: "beach" },
  { slug: "port", name: "Some port", category: "harbour" },
  { slug: "tia", name: "Tirana Airport (TIA)", category: "hub" },
];

describe("place picker", () => {
  it("ignores accents and case when searching", () => {
    expect(fold("Sarandë")).toBe("sarande");
    expect(fold("GJIROKASTËR")).toBe("gjirokaster");
  });

  it("groups places by kind in a fixed order, A to Z inside each group", () => {
    const groups = groupPlaces(PLACES);
    expect(groups.map((g) => g.key)).toEqual(["city", "hub", "beach", "history", "other"]);
    expect(groups[0].places.map((p) => p.name)).toEqual(["Sarandë", "Tirana"]);
    expect(groups[2].places.map((p) => p.name)).toEqual(["Borsh", "Ksamil"]);
    expect(groups.at(-1).heading).toBe("Other places");
  });

  it("finds places typed without accents, and nothing for a miss", () => {
    expect(groupPlaces(PLACES, "gjirokaster").flatMap((g) => g.places).map((p) => p.slug)).toEqual(["gjirokaster"]);
    expect(groupPlaces(PLACES, "  tira ").flatMap((g) => g.places).map((p) => p.slug)).toEqual(["tirana", "tia"]);
    expect(groupPlaces(PLACES, "zzz")).toEqual([]);
  });

  it("doesn't reorder the list it was given", () => {
    const before = PLACES.map((p) => p.slug);
    groupPlaces(PLACES);
    expect(PLACES.map((p) => p.slug)).toEqual(before);
  });
});

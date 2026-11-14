import { describe, expect, it } from "vitest";
import { thumb } from "./photos";
import { KINDS, blank, toBody, toForm } from "./partners";
import { HOST_KINDS } from "./hostListings";

describe("photo addresses", () => {
  it("gives the small version of an uploaded photo", () => {
    expect(thumb("/media/u/0123456789abcdef0123456789abcdef.jpg")).toBe("/media/u/0123456789abcdef0123456789abcdef_s.jpg");
  });
  it("leaves any other address alone", () => {
    for (const url of ["/media/megrooms-logo.png", "https://example.com/a.jpg", "/media/u/short.jpg", "/media/u/0123456789abcdef0123456789abcdef_s.jpg", "", null, undefined]) {
      expect(thumb(url)).toBe(url);
    }
  });
});

describe("listing forms", () => {
  it("has a photos field on every kind of listing", () => {
    for (const kind of Object.values(KINDS)) expect(kind.fields.some((f) => f.name === "image_urls" && f.type === "photos")).toBe(true);
  });
  it("starts photos empty and sends them as a list", () => {
    const fields = KINDS.stays.fields;
    const form = blank(fields);
    expect(form.image_urls).toEqual([]);
    form.image_urls = ["/media/u/0123456789abcdef0123456789abcdef.jpg"];
    expect(toBody(fields, form).image_urls).toEqual(["/media/u/0123456789abcdef0123456789abcdef.jpg"]);
  });
  it("copies a saved listing's photos instead of sharing the list", () => {
    const item = { image_urls: ["a", "b"] };
    const form = toForm(KINDS.rentals.fields, item);
    form.image_urls.push("c");
    expect(item.image_urls).toEqual(["a", "b"]);
  });
  it("sends tick boxes as true or false and empty optional numbers as null", () => {
    const fields = HOST_KINDS.guides.fields;
    const form = { ...blank(fields), name: " Arben ", languages: "Albanian, English ,", licensed: true, price_half_day: "60", price_full_day: "" };
    const body = toBody(fields, form);
    expect(body.name).toBe("Arben");
    expect(body.languages).toEqual(["Albanian", "English"]);
    expect(body.licensed).toBe(true);
    expect(body.has_vehicle).toBe(false);
    expect(body.is_sample).toBe(false);
    expect(body.price_half_day).toBe(60);
    expect(body.price_full_day).toBeNull();
  });
  it("gives the host the business fields plus their own extras", () => {
    const names = (k) => HOST_KINDS[k].fields.map((f) => f.name);
    for (const f of KINDS.stays.fields) expect(names("stays")).toContain(f.name);
    expect(names("stays")).toEqual(expect.arrayContaining(["tag", "airbnb_rating"]));
    expect(names("rentals")).toContain("rental_company");
    expect(names("experiences")).toContain("start_time");
    expect(Object.keys(HOST_KINDS)).toEqual(["stays", "rentals", "experiences", "guides"]);
  });
});

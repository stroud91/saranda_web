// Shared pieces of the business portal: the three kinds of listing a business
// can manage, the form fields for each, and small API helpers.
import { BedDouble, Car, Ticket } from "lucide-react";
import { api, invalidate } from "./api";

const send = (method) => async (path, body) => {
  const res = await api(path, { method, body, cacheable: false });
  invalidate(); // public pages may show what just changed
  return res;
};
export const partnerPost = send("POST");
export const partnerPut = send("PUT");
export const partnerPatch = send("PATCH");
export const partnerDelete = send("DELETE");
export const fresh = (path) => api(path, { cacheable: false });

/** Field definitions drive both the form and what is sent; the server validates everything again. */
export const KINDS = {
  stays: {
    label: "Apartment or room", plural: "Apartments & rooms", add: "Add an apartment", icon: BedDouble,
    nameField: "hotel_name", priceField: "price_per_night", unit: "/ night",
    pause: { is_active: false }, resume: { is_active: true },
    fields: [
      { name: "hotel_name", label: "Name", required: true, max: 120, placeholder: "Sea-view studio with balcony" },
      { name: "city", label: "Town", required: true, max: 80, half: true, placeholder: "Sarandë" },
      { name: "address", label: "Address", required: true, max: 255, half: true },
      { name: "description", label: "Description", type: "textarea", required: true, max: 3000, hint: "What makes it special, what's nearby, anything guests should know." },
      { name: "image_urls", label: "Photos", type: "photos" },
      { name: "price_per_night", label: "Price per night (€)", type: "number", required: true, min: 5, max: 5000, half: true },
      { name: "cleaning_fee", label: "Cleaning fee (€)", type: "number", min: 0, max: 1000, half: true, initial: 0 },
      { name: "max_guests", label: "Guests", type: "number", min: 1, max: 40, half: true, initial: 2 },
      { name: "min_nights", label: "Minimum nights", type: "number", min: 1, max: 60, half: true, initial: 1 },
      { name: "bedrooms", label: "Bedrooms", type: "number", min: 0, max: 20, third: true, initial: 1 },
      { name: "beds", label: "Beds", type: "number", min: 1, max: 40, third: true, initial: 1 },
      { name: "bathrooms", label: "Bathrooms", type: "number", min: 0, max: 20, step: 0.5, third: true, initial: 1 },
      { name: "amenities", label: "Amenities", type: "tags", hint: "Separate with commas: Wi-Fi, Air conditioning, Parking, Sea view" },
    ],
    facts: (l) => [`${l.max_guests} guests`, `${l.bedrooms} bd`, l.city],
  },
  rentals: {
    label: "Rental", plural: "Rentals", add: "Add a rental", icon: Car,
    nameField: "car_model", priceField: "price_per_day", unit: "/ day",
    pause: { availability_status: "unavailable" }, resume: { availability_status: "available" },
    fields: [
      { name: "car_model", label: "What you rent", required: true, max: 120, placeholder: "Fiat Panda, 125cc scooter, 6m motorboat…" },
      { name: "car_type", label: "Type", type: "select", required: true, options: "rental_types", half: true },
      { name: "location", label: "Pick-up place", required: true, max: 120, half: true, placeholder: "Sarandë port" },
      { name: "price_per_day", label: "Price per day (€)", type: "number", required: true, min: 1, max: 5000, third: true },
      { name: "seats", label: "Seats", type: "number", min: 1, max: 60, third: true },
      { name: "transmission", label: "Gearbox", type: "select", options: ["manual", "automatic"], optional: "Not applicable", third: true },
      { name: "description", label: "Details", type: "textarea", max: 2000, hint: "Insurance, deposit, minimum age, delivery, fuel policy." },
      { name: "image_urls", label: "Photos", type: "photos" },
    ],
    facts: (l) => [l.car_type, l.location, l.seats ? `${l.seats} seats` : null],
  },
  experiences: {
    label: "Activity", plural: "Activities & tours", add: "Add an activity", icon: Ticket,
    nameField: "tour_name", priceField: "price", unit: "per person",
    pause: { is_available: false }, resume: { is_available: true },
    fields: [
      { name: "tour_name", label: "Name", required: true, max: 120, placeholder: "Sunset kayak to the Ksamil islands" },
      { name: "category", label: "Category", type: "select", required: true, options: "categories", half: true },
      { name: "destination_slug", label: "Nearest place", type: "destination", half: true },
      { name: "location", label: "Meeting point", required: true, max: 120 },
      { name: "description", label: "Description", type: "textarea", required: true, max: 3000, hint: "What happens, what's included, what to bring." },
      { name: "image_urls", label: "Photos", type: "photos" },
      { name: "price", label: "Price per person (€)", type: "number", required: true, min: 0, max: 5000, half: true },
      { name: "duration_hours", label: "Duration (hours)", type: "number", min: 0.5, max: 240, step: 0.5, half: true },
    ],
    facts: (l) => [l.category, l.location, l.duration_hours ? `${l.duration_hours}h` : null],
  },
};

export const PROFILE_FIELDS = [
  { name: "name", label: "Business name", required: true, max: 120 },
  { name: "tagline", label: "One line about you", max: 160, placeholder: "Family-run boat trips from Sarandë since 2010" },
  { name: "city", label: "Town", required: true, max: 80, half: true },
  { name: "address", label: "Address", max: 255, half: true },
  { name: "description", label: "About your business", type: "textarea", required: true, max: 3000 },
  { name: "email", label: "Public email", type: "email", max: 255, half: true, hint: "Shown on your page." },
  { name: "phone", label: "Phone", type: "tel", max: 40, half: true, placeholder: "+355 69 123 4567" },
  { name: "whatsapp", label: "WhatsApp number", type: "tel", max: 40, half: true, placeholder: "+355 69 123 4567" },
  { name: "website", label: "Website", type: "url", max: 255, half: true, placeholder: "https://…", hint: "Must start with https://" },
];

const empty = (f) => (f.type === "photos" ? [] : f.type === "checkbox" ? Boolean(f.initial) : f.type === "tags" ? "" : f.initial ?? "");

/** Blank form values for a set of fields. */
export const blank = (fields) => Object.fromEntries(fields.map((f) => [f.name, empty(f)]));

/** Form values from a saved item. */
export const toForm = (fields, item) =>
  Object.fromEntries(fields.map((f) => {
    const v = item[f.name];
    if (f.type === "tags") return [f.name, (v || []).join(", ")];
    if (f.type === "photos") return [f.name, [...(v || [])]];
    if (f.type === "checkbox") return [f.name, Boolean(v)];
    return [f.name, v ?? ""];
  }));

/** What to send: numbers as numbers, tags as a list, empty optional values as null. */
export const toBody = (fields, form) =>
  Object.fromEntries(fields.map((f) => {
    const v = form[f.name];
    if (f.type === "tags") return [f.name, String(v || "").split(",").map((s) => s.trim()).filter(Boolean)];
    if (f.type === "photos") return [f.name, v || []];
    if (f.type === "checkbox") return [f.name, Boolean(v)];
    if (f.type === "number") return [f.name, v === "" || v == null ? null : Number(v)];
    return [f.name, typeof v === "string" ? v.trim() || null : v];
  }));

/** Badge for a business or one of its listings, as its owner sees it. */
export function reviewBadge(item) {
  const status = item.review_status || item.status;
  if (status === "pending") return { tone: "sun", text: "Waiting for review" };
  if (status === "rejected") return { tone: "terracotta", text: "Needs changes" };
  if (status === "suspended") return { tone: "terracotta", text: "Suspended" };
  if (item.on === false) return { tone: "", text: "Paused" };
  if (item.is_sample) return { tone: "sun", text: "Sample profile" };
  if (item.has_pending_changes) return { tone: "sun", text: "Live · changes in review" };
  return { tone: "olive", text: "Live" };
}

const LABELS = {
  hotel_name: "Name", tour_name: "Name", car_model: "Name", car_type: "Type", price_per_night: "Price per night",
  price_per_day: "Price per day", price: "Price per person", max_guests: "Guests", min_nights: "Minimum nights",
  cleaning_fee: "Cleaning fee", duration_hours: "Duration (hours)", destination_slug: "Nearest place",
  location: "Location", whatsapp: "WhatsApp", image_urls: "Photos",
};
export const fieldLabel = (key) => LABELS[key] || key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const showValue = (v) => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined || v === "" ? "—" : String(v));

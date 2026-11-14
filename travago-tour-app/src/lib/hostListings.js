// The site's own listings, as the host edits them in the Host desk: the same
// forms as the business dashboard, plus a few fields only the host sets, plus guides.
import { Users } from "lucide-react";
import { KINDS } from "./partners";

const plus = (kind, extra, more = {}) => ({ ...kind, ...more, fields: [...kind.fields, ...extra] });

export const HOST_KINDS = {
  stays: plus(KINDS.stays, [
    { name: "tag", label: "Badge on the card", max: 40, half: true, placeholder: "Best for families" },
    { name: "airbnb_rating", label: "Airbnb rating", type: "number", min: 0, max: 5, step: 0.01, half: true },
  ], { label: "Apartment", plural: "Apartments" }),
  rentals: plus(KINDS.rentals, [{ name: "rental_company", label: "Company", max: 120, placeholder: "Meg'Rooms" }]),
  experiences: plus(KINDS.experiences, [{ name: "start_time", label: "Start time", type: "time", half: true }]),
  guides: {
    label: "Guide", plural: "Guides", add: "Add a guide", icon: Users,
    nameField: "name", priceField: "price_full_day", unit: "/ day",
    pause: { is_active: false }, resume: { is_active: true },
    fields: [
      { name: "name", label: "Name", required: true, max: 120 },
      { name: "headline", label: "One line about them", required: true, max: 200, placeholder: "Butrint and the south coast, on foot and by boat" },
      { name: "base_city", label: "Based in", required: true, max: 80, half: true, placeholder: "Sarandë" },
      { name: "years_experience", label: "Years guiding", type: "number", min: 0, max: 60, half: true, initial: 1 },
      { name: "bio", label: "About", type: "textarea", required: true, max: 4000 },
      { name: "languages", label: "Languages", type: "tags", required: true, hint: "Separate with commas: Albanian, English, Italian" },
      { name: "specialties", label: "Specialties", type: "tags", hint: "Separate with commas: History, Boat, Food, Hiking" },
      { name: "price_half_day", label: "Half day (€)", type: "number", required: true, min: 0, max: 5000, third: true },
      { name: "price_full_day", label: "Full day (€)", type: "number", required: true, min: 0, max: 10000, third: true },
      { name: "max_group", label: "Largest group", type: "number", min: 1, max: 60, third: true, initial: 8 },
      { name: "contact_email", label: "Email for requests", type: "email", max: 255, half: true },
      { name: "whatsapp", label: "WhatsApp number", type: "tel", max: 40, half: true, placeholder: "+355 69 123 4567" },
      { name: "palette", label: "Card colour", type: "select", options: "palettes", half: true, initial: "sea" },
      { name: "has_vehicle", label: "Has a vehicle", type: "checkbox", half: true },
      { name: "licensed", label: "Licensed guide", type: "checkbox", half: true },
      { name: "is_sample", label: "Sample profile (hidden from guests)", type: "checkbox", half: true },
    ],
    facts: (g) => [g.base_city, (g.languages || []).join(", ")],
  },
};

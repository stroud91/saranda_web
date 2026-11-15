// Five languages, one pattern.
//
// English text is the key: tr("Request to book"). Other languages come from
// table.js, one row per sentence; anything without a translation yet simply
// shows in English. The table is loaded only when a visitor isn't using English.
//
//   tr("Hello {name}", { name })                      values
//   rich("Read the <a>terms</a>", { a: (c) => <Link to="/terms">{c}</Link> })   links, bold
//
// tr() is a plain function, not a hook, so it can be used anywhere. Switching
// language remounts the app (see main.jsx), which re-reads every string.
import { Fragment, createElement } from "react";

export const LANGS = [
  { code: "sq", name: "Shqip", english: "Albanian" },
  { code: "en", name: "English", english: "English" },
  { code: "fr", name: "Français", english: "French" },
  { code: "it", name: "Italiano", english: "Italian" },
  { code: "de", name: "Deutsch", english: "German" },
];
const CODES = LANGS.map((l) => l.code);
const LOCALES = { sq: "sq-AL", en: "en-GB", fr: "fr-FR", it: "it-IT", de: "de-DE" };
const COLUMN = { sq: 1, fr: 2, it: 3, de: 4 }; // position in each table.js row

let current = "en";
let dict = null; // English text -> translation, for the current language
let content = null; // the same for travel content (place summaries, itineraries, advice)
const cache = {};
const contentCache = {};

export const isLang = (code) => CODES.includes(code);
export const currentLang = () => current;
/** Locale for dates and numbers, e.g. "de-DE". */
export const locale = () => LOCALES[current];

/** The visitor's language when they haven't chosen one: the first of their browser's languages we speak. */
export function browserLang() {
  const wanted = typeof navigator === "undefined" ? [] : navigator.languages || [navigator.language];
  for (const tag of wanted) {
    const code = String(tag || "").slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return "en";
}

async function load(code) {
  if (code === "en") return null;
  if (!cache[code]) {
    const { default: rows } = await import("./table.js");
    const col = COLUMN[code];
    cache[code] = new Map(rows.filter((r) => r[col]).map((r) => [r[0], r[col]]));
  }
  return cache[code];
}

async function loadContent(code) {
  if (code === "en") return null;
  if (!contentCache[code]) {
    const { default: rows } = await import("./content.js");
    const col = COLUMN[code];
    contentCache[code] = new Map(rows.filter((r) => r[col]).map((r) => [r[0], r[col]]));
  }
  return contentCache[code];
}

/** Make `code` the language tr() answers in. Resolves once its words are loaded. */
export async function applyLang(code) {
  const next = isLang(code) ? code : "en";
  try {
    dict = await load(next);
    current = next;
  } catch {
    dict = null; // the table didn't load (offline?): stay readable in English
    current = "en";
  }
  // Travel content is a separate, larger file. If it doesn't load, guides show in English.
  content = current === "en" ? null : await loadContent(current).catch(() => null);
  if (typeof document !== "undefined") document.documentElement.lang = current;
  return current;
}

/**
 * Add a page's own table to the language in use. Long texts that only one page
 * shows (the privacy policy, the booking terms) live in their own file, so other
 * pages don't download them: addTable(() => import("./legal.js")).
 */
export async function addTable(importer) {
  const code = current;
  if (code === "en" || !cache[code]) return;
  const { default: rows } = await importer();
  const col = COLUMN[code];
  for (const row of rows) if (row[col]) cache[code].set(row[0], row[col]);
}

const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text);

/** Translate a piece of interface text. Unknown text comes back unchanged. */
export function tr(text, vars) {
  if (typeof text !== "string" || !text) return text;
  return fill((dict && dict.get(text)) || text, vars);
}

// Fields of the travel API that hold sentences. Identifiers (slug, region, category,
// pace, access…) are never touched, so nothing that code compares against changes.
export const CONTENT_KEYS = new Set([
  "name", "summary", "best_for", "planning_note", "highlights", "tags", "blurb", "label", "category_label", "region_name", "note",
  "audience", "tagline", "title", "transport", "plan", "options", "why", "alternative", "beach_rule", "boat_day", "booking_strategy",
  "item", "choices", "checklist", "idea", "length", "promise", "disclaimer", "edition", "service", "final_check", "what", "money",
  "price_note", "quick_start", "restaurant_tip", "road_trip_tip", "tip", "topic", "save_money", "months", "text", "verdict",
]);

function swap(node, key) {
  if (typeof node === "string") return CONTENT_KEYS.has(key) ? content.get(node) || node : node;
  if (Array.isArray(node)) return node.map((v) => swap(v, key));
  if (!node || typeof node !== "object") return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    // The packing list is keyed by its group headings, so those are translated too.
    if (k === "packing" && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = Object.fromEntries(Object.entries(v).map(([group, items]) => [content.get(group) || group, swap(items, "item")]));
    } else out[k] = swap(v, k);
  }
  return out;
}

/** A copy of a travel API answer with its sentences in the visitor's language (English: returned as is). */
export const localizeContent = (data) => (content && data && typeof data === "object" ? swap(data, "") : data);

/**
 * A listing's own text in the visitor's language, if its host wrote one:
 * loc(stay, "description"). Falls back to the text as the host first wrote it.
 */
export const loc = (item, field) => (item && item.translations && item.translations[current] && item.translations[current][field]) || (item ? item[field] : undefined);

/** A stay's name on cards: its translation, else its short name, else its full name. */
export const stayName = (stay) => (stay && stay.translations && stay.translations[current] && stay.translations[current].hotel_name) || (stay ? stay.apartment_name || stay.hotel_name : undefined);

/** One or many: plural(n, "{n} night", "{n} nights"). */
export const plural = (n, one, many) => tr(n === 1 ? one : many, { n });

/**
 * Translate a sentence that contains links or emphasis. Mark them with tags in
 * the text and say how to draw each one:
 *   rich("See our <a>privacy policy</a>.", { a: (children) => <Link to="/privacy">{children}</Link> })
 * Values in {braces} work as in tr(). Only the tags you pass are understood.
 */
export function rich(text, parts = {}, vars) {
  const out = [];
  const re = /<(\w+)>(.*?)<\/\1>/gs;
  // Tags are read from the sentence itself, and values are filled in afterwards,
  // so a value that happens to contain "<a>…</a>" is only ever shown as text.
  const source = tr(text);
  let last = 0;
  let m;
  while ((m = re.exec(source))) {
    if (m.index > last) out.push(fill(source.slice(last, m.index), vars));
    const draw = parts[m[1]];
    const inner = fill(m[2], vars);
    out.push(createElement(Fragment, { key: out.length }, draw ? draw(inner) : inner));
    last = m.index + m[0].length;
  }
  if (last < source.length) out.push(fill(source.slice(last), vars));
  return out;
}

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
const cache = {};

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
  if (typeof document !== "undefined") document.documentElement.lang = current;
  return current;
}

const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text);

/** Translate a piece of interface text. Unknown text comes back unchanged. */
export function tr(text, vars) {
  if (typeof text !== "string" || !text) return text;
  return fill((dict && dict.get(text)) || text, vars);
}

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

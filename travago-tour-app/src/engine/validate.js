// Subset of app/validation.py with the same error messages, for static mode.
import { EngineError } from "./py";

// Python's str.capitalize(): first character upper-case, the rest lower-case.
const label = (name, f) => {
  if (f.label) return f.label;
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
const EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const PHONE = /^\+?[0-9 ()\-.]{6,25}$/;

function parse(name, f, raw) {
  const L = label(name, f);
  switch (f.kind || "str") {
    case "str":
    case "slug":
    case "hhmm": {
      if (typeof raw !== "string" && typeof raw !== "number") throw new Error(`${L} must be text`);
      const v = String(raw).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim().slice(0, f.max_len || 200);
      if (f.required && !v) throw new Error(`${L} is required`);
      if (f.kind === "slug" && v && !SLUG.test(v)) throw new Error(`${L} is not valid`);
      if (f.kind === "hhmm" && v && !HHMM.test(v)) throw new Error(`${L} must be HH:MM`);
      if (f.choices && !f.choices.includes(v)) throw new Error(`${L} must be one of: ${f.choices.join(", ")}`);
      return v;
    }
    case "int":
    case "float": {
      if (typeof raw === "boolean") throw new Error(`${L} must be a number`);
      const n = typeof raw === "number" ? raw : f.kind === "int" ? (/^\s*[-+]?\d+\s*$/.test(raw) ? Number(raw) : NaN) : Number(raw);
      if (!Number.isFinite(n)) throw new Error(`${L} must be a number`);
      const v = f.kind === "int" ? Math.trunc(n) : n;
      if (f.min !== undefined && v < f.min) throw new Error(`${L} must be at least ${f.min}`);
      if (f.max !== undefined && v > f.max) throw new Error(`${L} must be at most ${f.max}`);
      return v;
    }
    case "bool":
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === "1" || raw === 1) return true;
      if (raw === "false" || raw === "0" || raw === 0) return false;
      throw new Error(`${L} must be true or false`);
    case "date": {
      const s = String(raw).slice(0, 10);
      const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00Z") : null;
      if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error(`${L} must be a date (YYYY-MM-DD)`);
      return s;
    }
    case "list": {
      if (!Array.isArray(raw)) throw new Error(`${L} must be a list`);
      const maxItems = f.max_items ?? 50;
      if (raw.length > maxItems) throw new Error(`${L} has too many items (max ${maxItems})`);
      if (f.min !== undefined && raw.length < f.min) throw new Error(`${L} needs at least ${f.min} item(s)`);
      return f.item ? raw.map((x) => parse(`${name} item`, f.item, x)) : raw;
    }
    case "text": {
      if (typeof raw !== "string" && typeof raw !== "number") throw new Error(`${L} must be text`);
      const v = String(raw).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim().slice(0, f.max_len || 2000);
      if (f.required && !v) throw new Error(`${L} is required`);
      return v;
    }
    case "email": {
      const v = String(raw).trim().slice(0, f.max_len || 255);
      if (f.required && !v) throw new Error(`${L} is required`);
      if (v && !EMAIL.test(v)) throw new Error("Enter a valid email address");
      return v;
    }
    case "phone": {
      const v = String(raw).trim().slice(0, f.max_len || 40);
      if (v && !PHONE.test(v)) throw new Error("Enter a valid phone number");
      return v;
    }
    default:
      return raw;
  }
}

/** validate({name: {kind, required, min, max, choices, default}}, body) → cleaned object. */
export function validate(schema, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new EngineError({ _: "Expected a JSON object" });
  const out = {};
  const errors = {};
  for (const [name, f] of Object.entries(schema)) {
    const raw = data[name];
    if (raw === undefined || raw === null || raw === "") {
      if (f.required) errors[name] = `${label(name, f)} is required`;
      else out[name] = f.default ?? null;
      continue;
    }
    try {
      out[name] = parse(name, f, raw);
    } catch (e) {
      errors[name] = e.message;
    }
  }
  if (Object.keys(errors).length) throw new EngineError(errors);
  return out;
}

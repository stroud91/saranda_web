export const hm = (minutes) => {
  const m = Math.round(minutes || 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h}h ${String(r).padStart(2, "0")}` : `${h}h`;
};

export const hmRange = (a, b) => (a === b ? hm(a) : `${hm(a)} – ${hm(b)}`);
export const kmRange = (a, b) => (a === b ? `${a} km` : `${a}–${b} km`);

const eur = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const euro = (n) => eur.format(Math.round(n || 0));
export const euroRange = ([a, b]) => `${euro(a)} – ${euro(b)}`;
export const lek = (n) => `${Math.round(n || 0).toLocaleString("en")} L`;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const fmtDate = (iso, opts = { weekday: "short", day: "numeric", month: "short" }) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("en-GB", opts);
};

export const addDays = (iso, n) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const todayIso = (offset = 0) => addDays(new Date().toISOString().slice(0, 10), offset);

export const plural = (n, word, many = word + "s") => `${n} ${n === 1 ? word : many}`;

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Hash a string to a stable number (for procedural art). */
export const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const seeded = (seed) => {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

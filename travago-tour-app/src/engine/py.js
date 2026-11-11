// Small helpers that reproduce Python semantics the engines rely on, so the
// browser computes exactly what the Flask API does (see parity.test.js).

/** Python's round(): halves go to the even neighbour (round(2.5) == 2). */
export function pyRound(x, ndigits = 0) {
  if (ndigits === 0) {
    const f = Math.floor(x);
    const d = x - f; // exact for |x| < 2**52
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }
  if (ndigits < 0) {
    const step = 10 ** -ndigits;
    return pyRound(x / step) * step;
  }
  const step = 10 ** ndigits;
  return pyRound(x * step) / step;
}

export const divmod = (a, b) => [Math.floor(a / b), ((a % b) + b) % b];
export const pad2 = (n) => String(n).padStart(2, "0");
/** f"{n:,}" for integers. */
export const thousands = (n) => Math.trunc(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** unicodedata NFKD + drop combining marks + lower(), like knowledge.normalize. */
export const normalize = (text) => String(text).toLowerCase().normalize("NFKD").replace(/\p{Mn}/gu, "");

export const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class EngineError extends Error {
  constructor(fields, status = 400) {
    let first = Object.values(fields)[0];
    while (first && typeof first === "object") first = Object.values(first)[0];
    super(first || "Invalid request");
    this.status = status;
    this.fields = fields;
  }
}

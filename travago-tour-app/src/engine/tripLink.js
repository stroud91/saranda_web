// Shareable trips without a server: the trip itself is packed into the link.
// "z" ids are deflate-compressed (CompressionStream), "j" ids plain JSON;
// both are base64url so they survive in a URL path.

const b64url = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (str) => {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

const MAX_TRIP_BYTES = 64 * 1024;
const MAX_ID_CHARS = 16 * 1024;

async function pipe(bytes, Stream, format) {
  const out = new Blob([bytes]).stream().pipeThrough(new Stream(format));
  return new Uint8Array(await new Response(out).arrayBuffer());
}

// Inflate with a hard output cap, so a crafted link can't expand into a
// "zip bomb" — reading stops as soon as the limit is passed.
async function inflateCapped(bytes, limit) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error("Trip is too large");
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export const isPackedTrip = (id) => typeof id === "string" && id.length <= MAX_ID_CHARS && /^[zj]\.[A-Za-z0-9_-]+$/.test(id);

export async function packTrip(trip) {
  const bytes = new TextEncoder().encode(JSON.stringify(trip));
  if (typeof CompressionStream === "function") {
    try {
      return "z." + b64url(await pipe(bytes, CompressionStream, "deflate-raw"));
    } catch {
      /* fall through to plain encoding */
    }
  }
  return "j." + b64url(bytes);
}

export async function unpackTrip(id) {
  if (!isPackedTrip(id)) throw new Error("Not a packed trip");
  const raw = fromB64url(id.slice(2));
  const bytes = id[0] === "z" ? await inflateCapped(raw, MAX_TRIP_BYTES) : raw;
  if (bytes.length > MAX_TRIP_BYTES) throw new Error("Trip is too large");
  return JSON.parse(new TextDecoder().decode(bytes));
}

// RFC 5545 calendar, same shape as app/services/ics.py.
const esc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r/g, "").replace(/\n/g, "\\n").slice(0, 900);
const fold = (line) => {
  const enc = new TextEncoder();
  const parts = [];
  let cur = "";
  for (const ch of line) {
    if (enc.encode(cur + ch).length > 73) {
      parts.push(cur);
      cur = ch;
    } else cur += ch;
  }
  parts.push(cur);
  return parts.join("\r\n ");
};

export function tripCalendar(title, startIso, days, uidBase, names) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const start = Date.UTC(+startIso.slice(0, 4), +startIso.slice(5, 7) - 1, +startIso.slice(8, 10));
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Saranda Companion//Trip Planner//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(title)}`];
  days.forEach((day, i) => {
    const d = new Date(start + i * 86400000);
    const stops = (day.stops || []).map((s) => names[s] || s).join(" → ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uidBase.slice(0, 40)}-day${i + 1}@saranda-companion`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d)}`,
      `DTEND;VALUE=DATE:${ymd(new Date(d.getTime() + 86400000))}`,
      fold(`SUMMARY:${esc(`Day ${i + 1}: ${day.title || stops}`)}`),
      fold(`DESCRIPTION:${esc((day.notes ? day.notes + "\n" : "") + stops)}`),
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

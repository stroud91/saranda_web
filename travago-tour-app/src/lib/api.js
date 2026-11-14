// Thin fetch wrapper: JSON in/out, timeouts, readable errors, tiny GET cache.
//
// Two ways to run:
// - "server": the Flask API answers /api/* (cPanel Python app, Docker, dev).
// - "static": plain files only (e.g. uploaded to Namecheap public_html). The
//   same requests are answered in the browser by src/engine/localApi.js.
// VITE_API_MODE=static|server forces one; the default "auto" asks
// /api/meta/health once and falls back to static if no API answers.
const cache = new Map();
const TTL = 5 * 60 * 1000;
const FORCED = import.meta.env.VITE_API_MODE;

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

let modePromise = null;
let localPromise = null;

async function probe() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch("/api/meta/health", { headers: { Accept: "application/json" }, signal: ctrl.signal, credentials: "same-origin" });
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    if (!isJson) return "static"; // e.g. an SPA rewrite answered with index.html
    const data = await res.json();
    return data && data.status ? "server" : "static";
  } catch {
    return "static";
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves to "server" or "static" (cached after the first call). */
export function apiMode() {
  if (FORCED === "static" || FORCED === "server") return Promise.resolve(FORCED);
  if (!modePromise) modePromise = probe();
  return modePromise;
}

function localApi() {
  if (!localPromise) {
    localPromise = Promise.all([import("../engine/localApi"), import("../data/static-api.json")]).then(([m, data]) =>
      m.createLocalApi(data.default || data, {
        whatsapp: import.meta.env.VITE_WHATSAPP_NUMBER || "",
        contactEmail: import.meta.env.VITE_CONTACT_EMAIL || "",
        liveData: import.meta.env.VITE_LIVE_DATA !== "false",
        osrmUrl: import.meta.env.VITE_OSRM_URL || "https://router.project-osrm.org",
      })
    );
    localPromise.catch(() => {
      localPromise = null;
    });
  }
  return localPromise;
}

/** The in-browser API (static mode helpers such as calendar export use it). */
export const getLocalApi = localApi;

async function callLocal(path, method, body) {
  const local = await localApi();
  try {
    // Round-trip through JSON so callers get the same plain data a server sends.
    const result = await local.request(path, { method, body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)) });
    return result === undefined ? null : JSON.parse(JSON.stringify(result));
  } catch (e) {
    if (e && e.fields) throw new ApiError(e.message, e.status || 400, e.status === 404 ? null : e.fields);
    throw new ApiError("Something went wrong.", 500);
  }
}

async function callServer(path, { method, body, headers, timeout }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      credentials: "same-origin",
    });
  } catch (err) {
    throw new ApiError(err.name === "AbortError" ? "The request timed out. Check your connection." : "You appear to be offline.", 0);
  } finally {
    clearTimeout(timer);
  }
  return read(res);
}

async function read(res) {
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (isJson && data.error) || (res.status === 429 ? "Too many requests — please wait a moment." : res.status === 413 ? "That file is too large." : "Something went wrong.");
    throw new ApiError(msg, res.status, isJson ? data.fields : null);
  }
  return data;
}

/** Send one photo for a listing. `scope` is "business" (the owner's) or "house" (the host's own). */
export async function uploadPhoto(file, scope = "business") {
  if ((await apiMode()) === "static") throw new ApiError("Photos can't be added on this copy of the site.", 0);
  const form = new FormData();
  form.append("scope", scope);
  form.append("file", file, file.name || "photo.jpg");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  let res;
  try {
    // No Content-Type here: the browser writes the multipart boundary itself.
    res = await fetch("/api/uploads/", { method: "POST", body: form, headers: { Accept: "application/json", "X-Requested-With": "fetch" }, signal: ctrl.signal, credentials: "same-origin" });
  } catch (err) {
    throw new ApiError(err.name === "AbortError" ? "The upload took too long. Check your connection and try again." : "You appear to be offline.", 0);
  } finally {
    clearTimeout(timer);
  }
  return read(res);
}

export async function api(path, { method = "GET", body, headers, timeout = 20000, cacheable = method === "GET" } = {}) {
  const key = method + path;
  if (cacheable) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL) return hit.v;
  }
  const mode = await apiMode();
  const data = mode === "static" ? await callLocal(path, method, body) : await callServer(path, { method, body, headers, timeout });
  if (cacheable) cache.set(key, { t: Date.now(), v: data });
  return data;
}

export const post = (path, body, opts) => api(path, { ...opts, method: "POST", body });
export const put = (path, body, opts) => api(path, { ...opts, method: "PUT", body });
export const invalidate = (prefix = "") => {
  for (const k of cache.keys()) if (k.includes(prefix)) cache.delete(k);
};

/** Save a calendar file in the browser (static mode has no .ics endpoint). */
export async function downloadTripCalendar(trip, shareId) {
  const [{ tripCalendar }, local] = await Promise.all([import("../engine/tripLink"), localApi()]);
  const body = tripCalendar(trip.title, trip.data.start_date, trip.data.days || [], shareId || "trip", local.tripNames());
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "albania-trip.ics" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

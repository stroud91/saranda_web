// Thin fetch wrapper: JSON in/out, timeouts, readable errors, tiny GET cache.
const cache = new Map();
const TTL = 5 * 60 * 1000;

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

export async function api(path, { method = "GET", body, headers, timeout = 20000, cacheable = method === "GET" } = {}) {
  const key = method + path;
  if (cacheable) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL) return hit.v;
  }
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
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (isJson && data.error) || (res.status === 429 ? "Too many requests — please wait a moment." : "Something went wrong.");
    throw new ApiError(msg, res.status, isJson ? data.fields : null);
  }
  if (cacheable) cache.set(key, { t: Date.now(), v: data });
  return data;
}

export const post = (path, body, opts) => api(path, { ...opts, method: "POST", body });
export const put = (path, body, opts) => api(path, { ...opts, method: "PUT", body });
export const invalidate = (prefix = "") => {
  for (const k of cache.keys()) if (k.includes(prefix)) cache.delete(k);
};

// Browser-side live data for static hosting (no Flask server): the same free
// providers app/services/live.py uses, called directly, with the same fallbacks.
const CACHE = new Map();
const TTL = { weather: 30 * 60e3, fx: 12 * 3600e3, geom: 7 * 24 * 3600e3 };

async function cached(key, ttl, fn) {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await fn();
  CACHE.set(key, { t: Date.now(), v });
  return v;
}

async function getJson(url, timeout = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: "omit", referrerPolicy: "strict-origin-when-cross-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const INLAND_REGIONS = new Set(["north", "central", "capital", "inland-south"]);

export function createLive(data, routing, { enabled = true, osrmUrl = "https://router.project-osrm.org" } = {}) {
  const typical = (month = new Date().getMonth() + 1) => {
    const row = data.climate.find((c) => c.month === month);
    return { air_high: row.air_high, sea: row.sea, rain_days: row.rain_days, month };
  };
  const wmo = (code) => data.wmo[String(code)] || ["—", "cloud"];

  async function weather(slug = "sarande") {
    const dest = routing.place(slug);
    const fallback = () => {
      const ty = typical();
      return {
        place: { slug: dest.slug, name: dest.name }, live: false, source: "Typical monthly climate (fallback)",
        fetched_at: new Date().toISOString(),
        current: { temp: ty.air_high, sea_temp: ty.sea, label: "Typical for this month", icon: "sun", is_day: true },
        daily: [], typical: ty,
      };
    };
    if (!enabled) return fallback();
    try {
      return await cached(`weather:${slug}`, TTL.weather, async () => {
        const base = `latitude=${dest.lat}&longitude=${dest.lng}&timezone=Europe%2FTirane`;
        const fc = await getJson(`https://api.open-meteo.com/v1/forecast?${base}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset&forecast_days=7`);
        let marine = null;
        if (!INLAND_REGIONS.has(dest.region) || dest.slug === "durres") {
          marine = await getJson(`https://marine-api.open-meteo.com/v1/marine?${base}&current=wave_height,sea_surface_temperature&daily=wave_height_max&forecast_days=7`).catch(() => null);
        }
        const cur = fc.current || {};
        const [label, icon] = wmo(cur.weather_code);
        const daily = fc.daily || {};
        const at = (k, i) => (daily[k] || [])[i] ?? null;
        return {
          place: { slug: dest.slug, name: dest.name }, live: true, source: "Open-Meteo", fetched_at: new Date().toISOString(),
          current: {
            temp: cur.temperature_2m, feels_like: cur.apparent_temperature, wind_kmh: cur.wind_speed_10m, uv: cur.uv_index,
            is_day: Boolean(cur.is_day ?? 1), code: cur.weather_code, label, icon,
            sea_temp: marine?.current?.sea_surface_temperature ?? null, wave_height: marine?.current?.wave_height ?? null,
          },
          daily: (daily.time || []).map((date, i) => ({
            date, code: at("weather_code", i), label: wmo(at("weather_code", i))[0], icon: wmo(at("weather_code", i))[1],
            max: at("temperature_2m_max", i), min: at("temperature_2m_min", i), rain_chance: at("precipitation_probability_max", i),
            uv: at("uv_index_max", i), sunrise: (at("sunrise", i) || "").slice(-5), sunset: (at("sunset", i) || "").slice(-5),
            wave_max: marine?.daily?.wave_height_max?.[i] ?? null,
          })),
          typical: typical(),
        };
      });
    } catch {
      return fallback();
    }
  }

  async function fx() {
    const fallback = { base: "EUR", rates: { ALL: data.fallback_eur_all }, live: false, source: "Approximate fallback rate", updated: null };
    if (!enabled) return fallback;
    try {
      return await cached("fx", TTL.fx, async () => {
        const d = await getJson("https://open.er-api.com/v6/latest/EUR");
        if (!d.rates || !d.rates.ALL) throw new Error("FX feed missing ALL");
        const keep = ["ALL", "USD", "GBP", "CHF", "SEK", "NOK", "PLN"].filter((k) => k in d.rates);
        return { base: "EUR", rates: Object.fromEntries(keep.map((k) => [k, d.rates[k]])), live: true, source: "open.er-api.com", updated: d.time_last_update_utc };
      });
    } catch {
      return fallback;
    }
  }

  const eurToAll = async () => (await fx()).rates.ALL || data.fallback_eur_all;

  async function geometry(stops) {
    const pts = stops.map(routing.place);
    const straight = { coords: pts.map((p) => [p.lat, p.lng]), source: "straight", live: false };
    if (!enabled || !osrmUrl || pts.length < 2) return straight;
    try {
      return await cached(`geom:${stops.join(",")}`, TTL.geom, async () => {
        const coord = pts.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
        const d = await getJson(`${osrmUrl.replace(/\/$/, "")}/route/v1/driving/${coord}?overview=simplified&geometries=geojson`, 10000);
        const r = d.routes?.[0];
        if (d.code !== "Ok" || !r) throw new Error("no route");
        return {
          coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          distance_km: Math.round(r.distance / 100) / 10, duration_min: Math.round(r.duration / 60),
          source: "OSRM / OpenStreetMap", live: true,
        };
      });
    } catch {
      return straight;
    }
  }

  return { weather, fx, eurToAll, geometry, typical };
}

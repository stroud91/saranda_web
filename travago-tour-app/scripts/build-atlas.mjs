// Builds src/data/atlas.json for the 3D atlas: a land mask of Albania and its
// neighbours (Natural Earth 1:10m, public domain, via world-atlas) and a
// stylised relief model of Albania's mountain ranges.
//
//   npm run atlas
//
// The relief is an artistic model, not survey data: each range is a ridge line
// with a peak height, blended with fractal noise and lifted away from the coast.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

const here = dirname(fileURLToPath(import.meta.url));
const topo = JSON.parse(readFileSync(join(here, "../node_modules/world-atlas/countries-10m.json"), "utf8"));
const OUT = join(here, "../src/data/atlas.json");

// Area shown: Shkodër lake to Corfu.
const BBOX = { w: 18.85, e: 21.25, s: 39.25, n: 42.75 };
const LAT0 = (BBOX.s + BBOX.n) / 2;
const KX = Math.cos((LAT0 * Math.PI) / 180) * 111.32; // km per degree of longitude
const KY = 110.57; // km per degree of latitude
const WIDTH_KM = (BBOX.e - BBOX.w) * KX;
const HEIGHT_KM = (BBOX.n - BBOX.s) * KY;
const CELL_KM = 1.05;
const NX = Math.round(WIDTH_KM / CELL_KM);
const NY = Math.round(HEIGHT_KM / CELL_KM);

// ---- Land mask by scanline rasterisation --------------------------------
const NEIGHBOURS = new Set(["Greece", "North Macedonia", "Macedonia", "Montenegro", "Kosovo", "Serbia", "Italy"]);
const countries = feature(topo, topo.objects.countries).features;
const mask = new Uint8Array(NX * NY); // 0 sea, 1 neighbour, 2 Albania

function rings(geom) {
  if (geom.type === "Polygon") return geom.coordinates;
  if (geom.type === "MultiPolygon") return geom.coordinates.flat();
  return [];
}
const toCell = ([lng, lat]) => [((lng - BBOX.w) / (BBOX.e - BBOX.w)) * NX, ((BBOX.n - lat) / (BBOX.n - BBOX.s)) * NY];

function fill(geom, value) {
  const rs = rings(geom).map((r) => r.map(toCell));
  for (let y = 0; y < NY; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (const r of rs) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [x1, y1] = r[i];
        const [x2, y2] = r[j];
        if ((y1 > cy) !== (y2 > cy)) xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] - 0.5));
      const b = Math.min(NX - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = a; x <= b; x++) mask[y * NX + x] = Math.max(mask[y * NX + x], value);
    }
  }
}

let albania = null;
for (const f of countries) {
  const name = f.properties?.name;
  if (name === "Albania") albania = f;
  else if (NEIGHBOURS.has(name)) fill(f.geometry, 1);
}
if (!albania) throw new Error("Albania not found in world-atlas");
fill(albania.geometry, 2);

// Lakes (Natural Earth country shapes include them as land): [lat, lng, rx km, ry km]
const LAKES = [[42.16, 19.36, 7, 16], [41.02, 20.73, 7.5, 14], [40.87, 21.05, 6, 9], [40.80, 20.95, 2.5, 4]];
for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
  const lng = BBOX.w + ((x + 0.5) / NX) * (BBOX.e - BBOX.w);
  const lat = BBOX.n - ((y + 0.5) / NY) * (BBOX.n - BBOX.s);
  for (const [la, lo, rx, ry] of LAKES) {
    const dx = ((lng - lo) * KX) / rx, dy = ((lat - la) * KY) / ry;
    const wobble = 1 + 0.18 * Math.sin(Math.atan2(dy, dx) * 5 + la);
    if (dx * dx + dy * dy < wobble) mask[y * NX + x] = 0;
  }
}

// Albania outline (lng/lat, simplified) for the glowing border line.
function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    let best = -1;
    let dmax = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > dmax) { dmax = d; best = i; }
    }
    if (dmax > tol) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
const outline = rings(albania.geometry)
  .filter((r) => r.length > 20)
  .map((r) => simplify(r, 0.004).map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]));

// ---- Distance to the sea (chamfer) ----------------------------------------
const dist = new Float32Array(NX * NY).fill(1e9);
for (let i = 0; i < NX * NY; i++) if (!mask[i]) dist[i] = 0;
const D1 = 1, D2 = Math.SQRT2;
for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
  const i = y * NX + x;
  if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + D1);
  if (y > 0) dist[i] = Math.min(dist[i], dist[i - NX] + D1);
  if (x > 0 && y > 0) dist[i] = Math.min(dist[i], dist[i - NX - 1] + D2);
  if (x < NX - 1 && y > 0) dist[i] = Math.min(dist[i], dist[i - NX + 1] + D2);
}
for (let y = NY - 1; y >= 0; y--) for (let x = NX - 1; x >= 0; x--) {
  const i = y * NX + x;
  if (x < NX - 1) dist[i] = Math.min(dist[i], dist[i + 1] + D1);
  if (y < NY - 1) dist[i] = Math.min(dist[i], dist[i + NX] + D1);
  if (x < NX - 1 && y < NY - 1) dist[i] = Math.min(dist[i], dist[i + NX + 1] + D2);
  if (x > 0 && y < NY - 1) dist[i] = Math.min(dist[i], dist[i + NX - 1] + D2);
}

// ---- Relief model ----------------------------------------------------------
// [lat1, lng1, lat2, lng2, peak metres, half-width km]
const RIDGES = [
  [42.55, 19.55, 42.38, 20.15, 2600, 14], // Albanian Alps (Prokletije)
  [42.45, 19.75, 42.15, 20.05, 2100, 12],
  [42.10, 20.35, 41.65, 20.60, 2700, 10], // Korab
  [41.95, 20.05, 41.50, 20.30, 2100, 12], // Mirditë / Lurë
  [41.45, 19.95, 41.20, 20.10, 1800, 9], // Dajti / Krujë
  [41.25, 20.25, 40.85, 20.45, 2000, 10], // Shebenik–Jabllanicë
  [40.75, 20.05, 40.55, 20.20, 2400, 7], // Tomorr
  [40.55, 20.55, 40.10, 20.70, 2300, 10], // Gramoz / Morava
  [40.25, 20.35, 40.05, 20.50, 2480, 8], // Nemërçkë
  [40.30, 19.95, 40.05, 20.20, 1900, 7], // Trebeshinë–Dhëmbel
  [40.42, 19.43, 40.05, 19.85, 2000, 6], // Ceraunian (Llogara / Çika)
  [39.98, 19.95, 39.70, 20.25, 1800, 6], // Mali i Gjerë (Gjirokastër–Sarandë)
  [39.95, 19.80, 39.75, 20.00, 900, 5], // hills above Sarandë
  [42.05, 19.55, 41.85, 19.75, 900, 8], // Shkodër–Lezhë hills
  // neighbours, a little lower so Albania stays the focus
  [39.80, 19.62, 39.73, 19.95, 900, 5], // Pantokrator, Corfu
  [40.20, 20.85, 39.60, 21.05, 2200, 14], // Pindus
  [42.70, 19.10, 42.55, 19.50, 2000, 12], // Montenegro
  [41.90, 20.75, 41.30, 20.95, 2200, 12], // North Macedonia west
];
// Lowlands that stay flat: [lat, lng, radius km]
const PLAINS = [[40.85, 19.60, 30], [41.25, 19.55, 16], [42.05, 19.45, 10], [39.75, 20.25, 6], [40.98, 19.55, 22]];

const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y) => {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 5; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
};
const ridged = (x, y) => {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += a * (1 - Math.abs(vnoise(x * f, y * f) * 2 - 1)); f *= 2.1; a *= 0.5; }
  return s;
};
const km = (lat, lng) => [(lng - BBOX.w) * KX, (BBOX.n - lat) * KY];
const R = RIDGES.map(([la1, lo1, la2, lo2, h, w]) => ({ a: km(la1, lo1), b: km(la2, lo2), h, w }));
const P = PLAINS.map(([la, lo, r]) => ({ c: km(la, lo), r }));

const metres = new Float32Array(NX * NY);
const MAX_M = 2800;
for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
  const i = y * NX + x;
  if (!mask[i]) continue;
  const px = (x + 0.5) * CELL_KM, py = (y + 0.5) * CELL_KM;
  // Domain warp so ranges wander instead of running ruler-straight.
  const wx = px + 9 * (fbm(px / 30 + 7, py / 30) - 0.5);
  const wy = py + 9 * (fbm(px / 30, py / 30 + 3) - 0.5);
  let h = 0;
  for (const r of R) {
    const [ax, ay] = r.a, [bx, by] = r.b;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((wx - ax) * dx + (wy - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(wx - (ax + t * dx), wy - (ay + t * dy));
    const taper = 0.7 + 0.3 * Math.sin(Math.PI * t);
    h = Math.max(h, r.h * taper * Math.exp(-((d / (r.w * 1.15)) ** 2)));
  }
  const coast = Math.min(1, (dist[i] * CELL_KM) / 25);
  let base = 50 + 560 * coast * (0.25 + 0.75 * fbm(px / 35, py / 35));
  for (const p of P) {
    const d = Math.hypot(px - p.c[0], py - p.c[1]);
    const k = Math.min(1, d / p.r);
    base *= 0.15 + 0.85 * k * k;
    h *= 0.15 + 0.85 * k;
  }
  const crag = ridged(wx / 7, wy / 7);
  let m = base * (0.8 + 0.4 * fbm(px / 5, py / 5)) + h * (0.3 + 0.85 * crag);
  m = MAX_M * 1.05 * (1 - Math.exp(-m / (MAX_M * 1.05)));
  m *= Math.min(1, 0.3 + (dist[i] * CELL_KM) / 3); // beaches and cliffs meet the sea
  if (mask[i] === 1) m *= 0.85;
  metres[i] = m;
}

// Store as bytes, using the full 0–255 range.
const top = metres.reduce((a, b) => Math.max(a, b), 0);
const height = new Uint8Array(NX * NY);
for (let i = 0; i < NX * NY; i++) if (mask[i]) height[i] = Math.max(1, Math.round((metres[i] / top) * 255));

const b64 = (arr) => Buffer.from(arr).toString("base64");
const out = {
  attribution: "Borders: Natural Earth (public domain) via world-atlas. Relief: stylised model.",
  bbox: BBOX, lat0: LAT0, kmPerDeg: [KX, KY], size: [NX, NY], cellKm: CELL_KM, maxMetres: Math.round(top),
  outline, mask: b64(mask), height: b64(height),
};
writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`atlas ${NX}×${NY} cells, outline ${outline.map((r) => r.length).join("+")} pts → ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);

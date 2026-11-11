// Port of app/services/routing.py: Dijkstra over the planner's road table.
import { pyRound } from "./py";

export const MODE_WEIGHT = { drive: 1.0, ferry: 1.25, boat: 1.6 };
export const ALL_MODES = Object.keys(MODE_WEIGHT);

export class UnknownPlace extends Error {}

// Binary min-heap ordered like Python's heapq on (cost, node) tuples.
class Heap {
  constructor() {
    this.a = [];
  }
  static less(x, y) {
    return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]);
  }
  push(item) {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!Heap.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && Heap.less(a[l], a[m])) m = l;
        if (r < a.length && Heap.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

const rad = (d) => (d * Math.PI) / 180;

export function createRouting(data) {
  const index = Object.fromEntries(data.destinations.map((d) => [d.slug, d]));
  const graph = new Map();
  const orient = (leg, a, b) => ({ ...leg, from: a, to: b });
  const addEdge = (a, b, leg) => {
    if (!graph.has(a)) graph.set(a, []);
    graph.get(a).push([b, leg]);
  };
  for (const leg of data.route_legs) {
    addEdge(leg.from, leg.to, orient(leg, leg.from, leg.to));
    addEdge(leg.to, leg.from, orient(leg, leg.to, leg.from));
  }

  function place(slug) {
    const d = index[slug];
    if (!d) throw new UnknownPlace(`Unknown destination: ${slug}`);
    return d;
  }

  const mid = (leg) => (leg.min_minutes + leg.max_minutes) / 2;

  function haversineKm(a, b) {
    const h = Math.sin((rad(b.lat) - rad(a.lat)) / 2) ** 2
      + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin((rad(b.lng) - rad(a.lng)) / 2) ** 2;
    return 6371.0 * 2 * Math.asin(Math.sqrt(h));
  }

  function estimatedLeg(aSlug, bSlug, mode = "drive") {
    const crow = haversineKm(place(aSlug), place(bSlug));
    const roadKm = crow * (mode === "drive" ? data.road_factor : 1.1);
    const minutes = (roadKm / data.fallback_speed_kmh[mode]) * 60;
    return {
      from: aSlug,
      to: bSlug,
      km_min: pyRound(roadKm * 0.9),
      km_max: pyRound(roadKm * 1.1),
      min_minutes: Math.max(5, pyRound((minutes * 0.85) / 5) * 5),
      max_minutes: Math.max(10, pyRound((minutes * 1.3) / 5) * 5),
      mode,
      source: "straight-line",
      note: "Straight-line estimate — no curated route between these points.",
    };
  }

  function summarise(hops, legs) {
    const sum = (f, filter = () => true) => legs.filter(filter).reduce((n, l) => n + l[f], 0);
    return {
      hops,
      legs,
      totals: {
        km_min: sum("km_min"),
        km_max: sum("km_max"),
        min_minutes: sum("min_minutes"),
        max_minutes: sum("max_minutes"),
        drive_minutes_min: sum("min_minutes", (l) => l.mode === "drive"),
        drive_minutes_max: sum("max_minutes", (l) => l.mode === "drive"),
        modes: [...new Set(legs.map((l) => l.mode))].sort(),
        sources: [...new Set(legs.map((l) => l.source))].sort(),
        hop_count: legs.length,
      },
      path: hops.map((s) => [place(s).lat, place(s).lng]),
    };
  }

  function connect(aSlug, bSlug, modes = ALL_MODES) {
    place(aSlug);
    place(bSlug);
    if (aSlug === bSlug) return summarise([aSlug], []);
    const allowed = new Set(modes);
    const best = new Map([[aSlug, 0]]);
    const prev = new Map();
    const queue = new Heap();
    queue.push([0, aSlug]);
    while (queue.size) {
      const [cost, node] = queue.pop();
      if (node === bSlug) break;
      if (cost > (best.has(node) ? best.get(node) : Infinity)) continue;
      for (const [nxt, leg] of graph.get(node) || []) {
        if (!allowed.has(leg.mode)) continue;
        const newCost = cost + mid(leg) * MODE_WEIGHT[leg.mode];
        if (newCost < (best.has(nxt) ? best.get(nxt) : Infinity)) {
          best.set(nxt, newCost);
          prev.set(nxt, [node, leg]);
          queue.push([newCost, nxt]);
        }
      }
    }
    if (!prev.has(bSlug)) return summarise([aSlug, bSlug], [estimatedLeg(aSlug, bSlug)]);
    const legs = [];
    let node = bSlug;
    while (node !== aSlug) {
      const [p, leg] = prev.get(node);
      legs.push(leg);
      node = p;
    }
    legs.reverse();
    return summarise([aSlug, ...legs.map((l) => l.to)], legs);
  }

  function routeThrough(stops, modes = ALL_MODES) {
    const segments = [];
    for (let i = 0; i + 1 < stops.length; i++) {
      const seg = connect(stops[i], stops[i + 1], modes);
      seg.from = stops[i];
      seg.to = stops[i + 1];
      segments.push(seg);
    }
    const legs = segments.flatMap((s) => s.legs);
    const hops = stops.length ? [stops[0]] : [];
    for (const s of segments) hops.push(...s.hops.slice(1));
    const summary = summarise(hops, legs);
    summary.segments = segments;
    summary.stops = [...stops];
    return summary;
  }

  function googleDirectionsUrl(stops) {
    if (!stops.length) return null;
    const pts = stops.map(place);
    const fmt = (p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${fmt(pts[0])}&destination=${fmt(pts[pts.length - 1])}`;
    if (pts.length > 2) url += "&waypoints=" + encodeURIComponent(pts.slice(1, -1).slice(0, 9).map(fmt).join("|"));
    return url;
  }

  return { index, place, mid, connect, routeThrough, googleDirectionsUrl, haversineKm };
}

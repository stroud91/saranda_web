import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CATEGORY_META, MODE_META } from "../ui";
import { tileConfig } from "../../lib/mapTiles";

const ALBANIA_BOUNDS = [[39.55, 19.25], [42.55, 20.45]];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Inline SVG glyphs per category (kept tiny; markers are HTML divIcons).
const GLYPH = {
  beach: '<path d="M2 12c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M2 17c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M12 3v6" />',
  history: '<path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M2 10l10-6 10 6" />',
  nature: '<path d="M12 3l6 9H6zM12 9l7 10H5zM12 19v3" />',
  city: '<path d="M4 21V8l6-3v16M10 21V3l8 4v14M4 21h16" />',
  village: '<path d="M3 11l9-7 9 7v10H3zM9 21v-6h6v6" />',
  viewpoint: '<path d="M2 20l7-12 4 6 3-4 6 10z" />',
  boat: '<path d="M3 17l2 4h14l2-4zM12 3v12M12 3l7 12H12" />',
  food: '<path d="M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v7M8 21h8" />',
  hub: '<path d="M2 16l8-3V5a2 2 0 0 1 4 0v8l8 3v2l-8-2v3l2 2v1l-4-1-4 1v-1l2-2v-3l-8 2z" />',
};

function markerIcon(d, { selected, dim, order }) {
  const meta = CATEGORY_META[d.category] || CATEGORY_META.city;
  const size = d.base || selected ? 38 : 30;
  const label = selected || d.base || order ? `<span class="pin-label">${esc(d.name.split(" (")[0])}</span>` : "";
  const badge = order ? `<span class="pin-order">${order}</span>` : "";
  return L.divIcon({
    className: "",
    html: `<div class="pin ${selected ? "selected" : ""} ${dim ? "dim" : ""}" style="--pin:${meta.color};--size:${size}px">
      <svg viewBox="0 0 24 24" width="${size * 0.5}" height="${size * 0.5}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${GLYPH[d.category] || GLYPH.city}</svg>
      ${badge}${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function useDarkMode() {
  const get = () => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const [dark, setDark] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(get());
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    mq.addEventListener("change", update);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);
  return dark;
}

/** Leaflet measures its container once; keep it in sync with layout changes
 *  (page transitions, sheets, responsive panels) and fit once it has a size. */
function AutoResize({ points }) {
  const map = useMap();
  const fitted = useRef(false);
  const latest = useRef(points);
  latest.current = points;
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => {
      if (!el.clientWidth || !el.clientHeight) return;
      map.invalidateSize({ animate: false });
      if (!fitted.current) {
        fitted.current = true;
        const pts = latest.current;
        if (pts && pts.length > 1) map.fitBounds(pts, { padding: [60, 60], maxZoom: 11, animate: false });
        else if (pts && pts.length === 1) map.setView(pts[0], 11, { animate: false });
        else map.fitBounds(ALBANIA_BOUNDS, { animate: false });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function FitTo({ points, padding = 60, maxZoom = 11 }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) map.flyTo(points[0], 11, { duration: 0.8 });
    else map.flyToBounds(points, { padding: [padding, padding], maxZoom, duration: 0.9 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/**
 * props:
 *  nodes: [{slug,name,lat,lng,category,base}]
 *  edges: [{coords, mode, source}]  – the background network
 *  routes: [{coords, color, dashed}] – highlighted routes (animated)
 *  selected: slug | slug[], order: {slug: n}
 *  onSelect(slug)
 *  fit: [[lat,lng],...]
 */
export default function AlbaniaMap({ nodes = [], edges = [], routes = [], selected, order = {}, onSelect, fit, className = "", showNetwork = true, dimOthers = false, interactive = true }) {
  const dark = useDarkMode();
  const sel = useMemo(() => new Set(Array.isArray(selected) ? selected : selected ? [selected] : []), [selected]);
  const tiles = tileConfig(dark);
  return (
    <div className={`map-wrap ${tiles.filterDark ? "tiles-dark" : ""} ${className}`}>
      <MapContainer
        bounds={ALBANIA_BOUNDS}
        zoomControl={false}
        scrollWheelZoom={interactive}
        dragging={interactive}
        attributionControl
        className="leaflet-map"
        maxBounds={[[38.8, 18.2], [43.2, 21.6]]}
        minZoom={7}
      >
        <TileLayer
          key={tiles.url}
          url={tiles.url}
          attribution={tiles.attribution}
          subdomains={tiles.subdomains}
          maxZoom={tiles.maxZoom}
        />
        {interactive && <ZoomControl position="bottomright" />}
        {showNetwork && edges.map((e, i) => (
          <Polyline
            key={i}
            positions={e.coords}
            pathOptions={{
              color: e.mode === "drive" ? (dark ? "#3fd3cf" : "#0b5c7e") : MODE_META[e.mode]?.color,
              weight: e.mode === "drive" ? 2 : 2,
              opacity: dimOthers ? 0.12 : 0.35,
              dashArray: e.mode === "drive" ? null : "4 7",
            }}
          />
        ))}
        {routes.map((r, i) => (
          <Polyline key={`r${i}-${r.coords.length}`} positions={r.coords} pathOptions={{ color: "#fff", weight: 9, opacity: 0.9, lineCap: "round" }} />
        ))}
        {routes.map((r, i) => (
          <Polyline
            key={`rc${i}-${r.coords.length}`}
            positions={r.coords}
            pathOptions={{ color: r.color || "#d9653b", weight: 5, opacity: 1, lineCap: "round", dashArray: r.dashed ? "2 10" : null, className: "route-line" }}
          />
        ))}
        {nodes.map((d) => (
          <Marker
            key={d.slug + (sel.has(d.slug) ? "-s" : "") + (order[d.slug] || "") + (dark ? "d" : "")}
            position={[d.lat, d.lng]}
            icon={markerIcon(d, { selected: sel.has(d.slug), dim: dimOthers && !sel.has(d.slug) && !order[d.slug], order: order[d.slug] })}
            eventHandlers={onSelect ? { click: () => onSelect(d.slug) } : undefined}
            keyboard
            title={d.name}
          >
            {!sel.has(d.slug) && !d.base && !order[d.slug] && <Tooltip direction="top" offset={[0, -14]}>{d.name}</Tooltip>}
          </Marker>
        ))}
        <AutoResize points={fit} />
        <FitTo points={fit} />
      </MapContainer>
    </div>
  );
}

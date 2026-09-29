import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Route, X, Clock, Plus, ArrowRight, MousePointerClick, Layers, Navigation } from "lucide-react";
import AlbaniaMap from "../components/map/AlbaniaMap";
import SceneArt from "../components/art/SceneArt";
import { useApi } from "../lib/useApi";
import { hmRange, kmRange } from "../lib/format";
import { CATEGORY_META, CategoryIcon, MODE_META, toast } from "../components/ui";
import { useTrip } from "../store/trip";

export default function MapPage() {
  const { data: graph } = useApi("/routes/graph");
  const { data: dest } = useApi("/destinations");
  const [cats, setCats] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [connect, setConnect] = useState(false);
  const [pair, setPair] = useState([]);
  const [network, setNetwork] = useState(true);
  const { days, activeDay, addStop } = useTrip();

  useEffect(() => {
    document.title = "Map · Saranda Companion";
  }, []);

  const bySlug = useMemo(() => Object.fromEntries((dest?.destinations || []).map((d) => [d.slug, d])), [dest]);
  const nodes = useMemo(() => (graph?.nodes || []).map((n) => ({ ...n, ...(bySlug[n.slug] || {}) })).filter((n) => !cats.size || cats.has(n.category)), [graph, bySlug, cats]);
  const path = pair.length === 2 ? `/routes/connect?from=${pair[0]}&to=${pair[1]}` : null;
  const { data: route } = useApi(path);
  const d = selected ? bySlug[selected] : null;

  const onSelect = (slug) => {
    if (connect) {
      setPair((p) => (p.length >= 2 ? [slug] : p[0] === slug ? p : [...p, slug]));
      setSelected(null);
    } else setSelected(slug);
  };

  const toggleCat = (k) => {
    const next = new Set(cats);
    next.has(k) ? next.delete(k) : next.add(k);
    setCats(next);
  };

  const routeCoords = route?.path;
  return (
    <div className="map-page">
      <AlbaniaMap
        nodes={nodes}
        edges={network ? graph?.edges || [] : []}
        selected={connect ? pair : selected}
        order={connect ? Object.fromEntries(pair.map((s, i) => [s, i === 0 ? "A" : "B"])) : {}}
        routes={routeCoords ? [{ coords: routeCoords, color: "#d9653b" }] : []}
        fit={routeCoords || (d ? [[d.lat, d.lng]] : undefined)}
        onSelect={onSelect}
        dimOthers={connect && pair.length > 0}
        className="map-full"
      />

      <div className="map-overlay-top">
        <div className="chips scroll map-chips">
          <button className={`chip ${connect ? "on" : ""}`} onClick={() => { setConnect(!connect); setPair([]); setSelected(null); }}>
            <Route size={15} /> {connect ? "Connecting…" : "Connect two places"}
          </button>
          <button className={`chip ${network ? "on" : ""}`} onClick={() => setNetwork(!network)} aria-pressed={network}><Layers size={15} /> Routes</button>
          {Object.entries(CATEGORY_META).map(([k, m]) => (
            <button key={k} className={`chip ${cats.has(k) ? "on" : ""}`} onClick={() => toggleCat(k)} style={cats.has(k) ? { background: m.color, borderColor: m.color, color: "#fff" } : undefined}>
              <CategoryIcon category={k} size={14} /> {m.label}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {connect && pair.length < 2 && (
            <motion.div className="map-hint glass-card" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <MousePointerClick size={16} /> {pair.length === 0 ? "Tap your starting point" : `From ${bySlug[pair[0]]?.name} — now tap the destination`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="map-legend glass-card tiny">
        {Object.entries(MODE_META).map(([k, m]) => (
          <span key={k}><i className={`lg-line m-${k}`} style={{ "--c": k === "drive" ? "var(--accent)" : m.color }} /> {m.label}</span>
        ))}
      </div>

      <AnimatePresence>
        {connect && route && (
          <motion.div className="map-card-float glass-card" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
            <div className="row between">
              <b>{bySlug[pair[0]]?.name} → {bySlug[pair[1]]?.name}</b>
              <button className="icon-btn sm" onClick={() => setPair([])} aria-label="Clear route"><X size={16} /></button>
            </div>
            <div className="mcf-time">{hmRange(route.totals.min_minutes, route.totals.max_minutes)}</div>
            <div className="small muted">{kmRange(route.totals.km_min, route.totals.km_max)} · via {route.hops.slice(1, -1).map((s) => bySlug[s]?.name).join(", ") || "direct"}</div>
            <div className="mcf-legs">
              {route.legs.map((l, i) => (
                <span key={i} className="mcf-leg" style={{ "--c": MODE_META[l.mode].color }}>{MODE_META[l.mode].label} {hmRange(l.min_minutes, l.max_minutes)}</span>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <Link className="btn primary sm" to={`/routes?from=${pair[0]}&to=${pair[1]}`}>Timeline <ArrowRight size={14} /></Link>
              {route.directions_url && <a className="btn sm" href={route.directions_url} target="_blank" rel="noopener noreferrer"><Navigation size={14} /> Google Maps</a>}
            </div>
          </motion.div>
        )}
        {!connect && d && (
          <motion.div key={d.slug} className="map-card-float glass-card dest-float" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
            <div className="dest-float-art"><SceneArt scene={d.scene} seed={d.slug} /></div>
            <button className="icon-btn sm dest-float-x" onClick={() => setSelected(null)} aria-label="Close"><X size={16} /></button>
            <div className="dest-float-body">
              <span className="badge" style={{ color: CATEGORY_META[d.category]?.color }}><CategoryIcon category={d.category} size={12} /> {CATEGORY_META[d.category]?.label}</span>
              <h3>{d.name}</h3>
              <p className="small muted clamp-2">{d.summary}</p>
              <div className="row small muted" style={{ gap: 6 }}><Clock size={14} /> {hmRange(d.visit_min, d.visit_max)}</div>
              <div className="row" style={{ marginTop: 10 }}>
                <Link to={`/explore/${d.slug}`} className="btn primary sm">Details</Link>
                <button className="btn sm" onClick={() => { addStop(activeDay, d.slug); toast(`Added to Day ${activeDay + 1}`); }} disabled={!days.length}><Plus size={14} /> Day {activeDay + 1}</button>
                <button className="btn sm ghost" onClick={() => { setConnect(true); setPair([d.slug]); setSelected(null); }}><Route size={14} /> From here</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Box, Compass, Home as HomeIcon, Layers, Map as MapIcon, Navigation, Plane, Route as RouteIcon, Square, X } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { hmRange, kmRange } from "../lib/format";
import { CATEGORY_META, CategoryIcon, Skeleton } from "../components/ui";
import { createAtlas, webglSupported } from "../components/atlas/atlasScene";
import { prefersReducedMotion } from "../lib/media";
import { tr } from "../i18n";

const MODE_LABEL = { drive: "Drive", ferry: "Ferry", boat: "Boat" };

export default function Atlas() {
  const [params, setParams] = useSearchParams();
  const { data: graph } = useApi("/routes/graph");
  const { data: dest } = useApi("/destinations");
  const holder = useRef(null);
  const labels = useRef({});
  const engine = useRef(null);
  const [state, setState] = useState("loading"); // loading | ready | unsupported | error
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(params.get("place"));
  const [from, setFrom] = useState(params.get("from") || "tirana");
  const [to, setTo] = useState(params.get("to") || "ksamil");
  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState("");
  const [flight, setFlight] = useState({ flying: false, progress: 0 });
  const [layers, setLayers] = useState({ contours: true, network: true, scan: true, rotate: false });
  // Phones start with the map uncovered unless a route was linked.
  const [panel, setPanel] = useState(() => window.innerWidth >= 900 || Boolean(params.get("from")));
  const reduce = prefersReducedMotion();

  const nodes = useMemo(() => graph?.nodes || [], [graph]);
  const bySlug = useMemo(() => Object.fromEntries((dest?.destinations || []).map((d) => [d.slug, d])), [dest]);
  const name = useCallback((s) => bySlug[s]?.name || nodes.find((n) => n.slug === s)?.name || s, [bySlug, nodes]);

  useEffect(() => { document.title = "3D Atlas · Saranda Companion"; }, []);

  // Build the scene once the graph is loaded.
  useEffect(() => {
    if (!graph || engine.current) return undefined;
    if (!webglSupported()) {
      setState("unsupported");
      return undefined;
    }
    let cancelled = false;
    import("../data/atlas.json").then((mod) => {
      if (cancelled || !holder.current) return;
      try {
        engine.current = createAtlas(holder.current, {
          atlas: mod.default || mod,
          nodes: graph.nodes,
          edges: graph.edges,
          reduced: reduce,
          onHover: setHover,
          onSelect: (slug) => setSelected(slug),
          onFlight: (f) => setFlight((prev) => (prev.flying === f.flying && Math.abs(prev.progress - f.progress) < 0.01 ? prev : { flying: f.flying, progress: f.progress })),
        });
        engine.current.onFrame((screen) => {
          for (const [slug, el] of Object.entries(labels.current)) {
            const p = screen[slug];
            if (!el || !p) continue;
            el.style.transform = `translate(${p.x}px, ${p.y}px)`;
            el.style.opacity = p.visible ? String(Math.max(0, Math.min(1, (460 - p.dist) / 160))) : "0";
          }
        });
        setState("ready");
      } catch {
        setState("error");
      }
    }).catch(() => setState("error"));
    return () => {
      cancelled = true;
    };
  }, [graph, reduce]);

  useEffect(() => () => {
    engine.current?.destroy();
    engine.current = null;
  }, []);

  useEffect(() => {
    engine.current?.select(selected);
  }, [selected, state]);

  useEffect(() => {
    for (const [k, v] of Object.entries(layers)) engine.current?.setLayer(k, v);
  }, [layers, state]);

  const connect = useCallback(async (a = from, b = to, flyAfter = false) => {
    setRouteError("");
    try {
      const r = await api(`/routes/connect?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}`);
      setRoute(r);
      setSelected(null);
      engine.current?.setRoute(r);
      setParams({ from: a, to: b }, { replace: true });
      if (flyAfter) setTimeout(() => engine.current?.fly(), reduce ? 0 : 1500);
    } catch (e) {
      setRouteError(e.message);
    }
  }, [from, to, reduce, setParams]);

  // Deep links: /atlas?from=a&to=b(&fly=1) or /atlas?place=slug
  useEffect(() => {
    if (state !== "ready") return;
    const f = params.get("from"), t = params.get("to");
    if (f && t) connect(f, t, params.get("fly") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const clear = () => {
    engine.current?.stopFlight();
    engine.current?.clearRoute();
    setRoute(null);
    setParams({}, { replace: true });
  };

  const sel = selected ? bySlug[selected] || nodes.find((n) => n.slug === selected) : null;
  const meta = sel ? CATEGORY_META[sel.category] : null;
  const labelled = nodes.filter((n) => n.base || n.category === "hub" || n.slug === hover || n.slug === selected || route?.hops?.includes(n.slug));
  const options = nodes.filter((n) => n.category !== "boat");
  const legIndex = route ? Math.min(route.legs.length - 1, Math.floor(flight.progress * route.legs.length)) : 0;

  return (
    <div className="atlas-page">
      <div className="atlas-stage" ref={holder}>
        {state === "loading" && <div className="atlas-loading"><Skeleton h="100%" r={0} /><span>{tr("Raising the mountains…")}</span></div>}
        {(state === "unsupported" || state === "error") && (
          <div className="atlas-fallback card pad">
            <h2>{tr("3D isn't available on this device")}</h2>
            <p className="muted">{tr("Your browser couldn't start WebGL. The interactive 2D map has every place and road.")}</p>
            <Link className="btn primary" to="/map"><MapIcon size={18} /> {tr("Open the map")}</Link>
          </div>
        )}
        <div className="atlas-labels" aria-hidden="true">
          {labelled.map((n) => (
            <span
              key={n.slug}
              ref={(el) => { labels.current[n.slug] = el; }}
              className={`atlas-label ${n.slug === hover || n.slug === selected ? "hot" : ""} ${n.base ? "base" : ""}`}
            >
              {n.name}
            </span>
          ))}
        </div>
      </div>

      <div className="atlas-hud">
        <div className="atlas-title glass-dark">
          <Box size={18} />
          <div>
            <b>{tr("3D Atlas")}</b>
            <span className="tiny">{tr("Drag to orbit · scroll or pinch to zoom · tap a beacon")}</span>
          </div>
          <button type="button" className="icon-btn sm" onClick={() => setPanel((p) => !p)} aria-expanded={panel} aria-label={tr("Route panel")}><RouteIcon size={16} /></button>
          <button type="button" className="icon-btn sm" onClick={() => engine.current?.home()} aria-label={tr("Reset view")}><HomeIcon size={16} /></button>
        </div>

        <AnimatePresence>
          {panel && (
            <motion.form
              className="atlas-panel glass-dark"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              onSubmit={(e) => { e.preventDefault(); connect(); }}
            >
              <div className="atlas-od">
                <label><span className="dot a" /> <span className="sr-only">{tr("From")}</span>
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>{options.map((n) => <option key={n.slug} value={n.slug}>{n.name}</option>)}</select>
                </label>
                <label><span className="dot b" /> <span className="sr-only">{tr("To")}</span>
                  <select value={to} onChange={(e) => setTo(e.target.value)}>{nodes.map((n) => <option key={n.slug} value={n.slug}>{n.name}</option>)}</select>
                </label>
              </div>
              <div className="row gap-sm">
                <button className="btn sun sm" disabled={state !== "ready"}><RouteIcon size={16} /> {tr("Connect")}</button>
                {route && !flight.flying && <button type="button" className="btn glass sm" onClick={() => engine.current?.fly()} disabled={reduce}><Plane size={16} /> {tr("Fly it")}</button>}
                {flight.flying && <button type="button" className="btn glass sm" onClick={() => engine.current?.stopFlight()}><Square size={14} /> {tr("Stop")}</button>}
                {route && <button type="button" className="icon-btn sm" onClick={clear} aria-label={tr("Clear route")}><X size={16} /></button>}
              </div>
              {routeError && <p className="tiny atlas-error">{routeError}</p>}
              {route && (
                <div className="atlas-route">
                  <div className="atlas-route-sum">
                    <b>{hmRange(route.totals.min_minutes, route.totals.max_minutes)}</b>
                    <span className="tiny">{kmRange(route.totals.km_min, route.totals.km_max)} · {route.totals.modes.map((m) => MODE_LABEL[m]).join(" + ")}</span>
                  </div>
                  <ol className="atlas-legs">
                    {route.legs.map((l, k) => (
                      <li key={k} className={flight.flying && k === legIndex ? "now" : ""}>
                        <span className={`mode ${l.mode}`}>{MODE_LABEL[l.mode]}</span> {name(l.to)} <span className="tiny">{hmRange(l.min_minutes, l.max_minutes)}</span>
                      </li>
                    ))}
                  </ol>
                  {flight.flying && <div className="atlas-progress"><i style={{ transform: `scaleX(${flight.progress})` }} /></div>}
                  <Link className="tiny" to={`/routes?from=${route.hops[0]}&to=${route.hops[route.hops.length - 1]}`}>{tr("Open in the route planner →")}</Link>
                </div>
              )}
            </motion.form>
          )}
        </AnimatePresence>

        <div className="atlas-layers glass-dark" role="group" aria-label={tr("Layers")}>
          <Layers size={15} aria-hidden="true" />
          {[["contours", "Contours"], ["network", "Roads & ferries"], ["scan", "Scanner"], ["rotate", "Auto-orbit"]].map(([k, label]) => (
            <label key={k} className="atlas-toggle">
              <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} disabled={k === "rotate" && reduce} />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <AnimatePresence>
          {sel && (
            <motion.div className="atlas-card glass-dark" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>
              <button type="button" className="icon-btn sm atlas-card-x" onClick={() => setSelected(null)} aria-label={tr("Close")}><X size={16} /></button>
              <span className="badge glass"><CategoryIcon category={sel.category} size={13} /> {meta?.label || sel.category}</span>
              <h3>{sel.name}</h3>
              {sel.summary && <p className="small">{sel.summary}</p>}
              <div className="row gap-sm wrap">
                <Link className="btn primary sm" to={`/explore/${sel.slug}`}><Compass size={16} /> {tr("Explore")}</Link>
                <button type="button" className="btn glass sm" onClick={() => { setFrom("sarande"); setTo(sel.slug); setPanel(true); connect("sarande", sel.slug, true); }} disabled={sel.slug === "sarande"}>
                  <Navigation size={16} /> {tr("Fly from Sarandë")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="atlas-attrib tiny">Borders © Natural Earth · relief is a stylised model · <Link to="/credits">credits</Link></p>
      </div>
    </div>
  );
}

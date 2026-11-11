import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, Plane, Plus, X, Route as RouteIcon, Navigation, CalendarPlus, Clock, Gauge, Car, Ship, Sailboat, Info, MapPin } from "lucide-react";
import { useApi, useLivePost } from "../lib/useApi";
import { useDestinations } from "../lib/useDestinations";
import { hm, hmRange, kmRange } from "../lib/format";
import AlbaniaMap from "../components/map/AlbaniaMap";
import Timeline from "../components/planner/Timeline";
import { MODE_META, PageHeader, Segmented, Skeleton, toast } from "../components/ui";
import { useTrip } from "../store/trip";

const MODE_ICON = { drive: Car, ferry: Ship, boat: Sailboat };

function PlaceSelect({ id, value, onChange, list, label, dot }) {
  return (
    <div className="rc-field">
      <span className={`hc-dot ${dot}`} />
      <label htmlFor={id} className="rc-label">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {list.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
      </select>
    </div>
  );
}

function Journey({ result, name }) {
  const maxLeg = Math.max(...result.legs.map((l) => l.max_minutes), 1);
  return (
    <ol className="journey">
      {result.hops.map((slug, i) => {
        const leg = result.legs[i];
        const Icon = leg ? MODE_ICON[leg.mode] : null;
        const isStop = result.stops.includes(slug);
        return (
          <motion.li key={`${slug}-${i}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
            <div className={`j-node ${i === 0 ? "start" : i === result.hops.length - 1 ? "end" : isStop ? "via" : "pass"}`}>
              <span className="j-dot" />
              <Link to={`/explore/${slug}`} className="j-name">{name(slug)}</Link>
              {!isStop && <span className="tiny muted">via</span>}
            </div>
            {leg && (
              <div className={`j-leg m-${leg.mode}`}>
                <span className="j-line" />
                <div className="j-leg-body">
                  <div className="row" style={{ gap: 8 }}>
                    <span className="j-mode" style={{ "--c": MODE_META[leg.mode].color }}><Icon size={14} /> {MODE_META[leg.mode].label}</span>
                    <b>{hmRange(leg.min_minutes, leg.max_minutes)}</b>
                    <span className="small muted">{kmRange(leg.km_min, leg.km_max)}</span>
                    <span className={`badge ${leg.source === "planner" ? "sea" : leg.source === "estimate" ? "" : "terracotta"}`}>
                      {leg.source === "planner" ? "Planner data" : leg.source === "estimate" ? "Estimate" : "Straight-line"}
                    </span>
                  </div>
                  <div className="range-bar" aria-hidden="true">
                    <span style={{ left: `${(leg.min_minutes / maxLeg) * 100}%`, width: `${((leg.max_minutes - leg.min_minutes) / maxLeg) * 100}%` }} />
                    <i style={{ width: `${(leg.min_minutes / maxLeg) * 100}%` }} />
                  </div>
                  {leg.note && <p className="tiny muted j-note"><Info size={12} /> {leg.note}</p>}
                </div>
              </div>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}

function PlannerTable({ name }) {
  const { data } = useApi("/routes/graph");
  const rows = useMemo(() => (data?.edges || []).filter((e) => e.source === "planner").sort((a, b) => a.max_minutes - b.max_minutes), [data]);
  if (!data) return <Skeleton h={300} r={26} />;
  const max = Math.max(...rows.map((r) => r.max_minutes));
  return (
    <div className="card pad">
      <div className="panel-title"><h3><Gauge size={18} /> Driving distances & road planning</h3><span className="badge sea">From the planner</span></div>
      <p className="small muted">Approximate planning ranges, not guaranteed times — summer traffic, road works, weather and stops change journeys significantly.</p>
      <div className="dist-table">
        {rows.map((r) => (
          <Link key={r.from + r.to} to={`/routes?from=${r.from}&to=${r.to}`} className="dist-row">
            <span className="dist-name">{name(r.from)} → {name(r.to)}</span>
            <span className="dist-bar">
              <span className="dist-fill" style={{ width: `${(r.max_minutes / max) * 100}%` }}>
                <span className="dist-min" style={{ width: `${(r.min_minutes / r.max_minutes) * 100}%` }} />
              </span>
            </span>
            <span className="dist-time">{hmRange(r.min_minutes, r.max_minutes)}</span>
            <span className="dist-km small muted">{kmRange(r.km_min, r.km_max)}</span>
          </Link>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 12 }}>
        Road-trip tip: don't schedule a major sight at the exact end of a long driving day. Leave a buffer for fuel, photos, coffee, parking and traffic.
      </p>
    </div>
  );
}

export default function Routes() {
  const { list, bySlug, name } = useDestinations();
  const [params, setParams] = useSearchParams();
  const from = params.get("from") || "tirana";
  const to = params.get("to") || "ksamil";
  const via = (params.get("via") || "").split(",").filter(Boolean);
  const [modes, setModes] = useState("all");
  const [startTime, setStartTime] = useState("08:30");
  const [pace, setPace] = useState("balanced");
  const { days, set: setTrip } = useTrip();

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const modeParam = modes === "all" ? "" : modes === "road" ? "&modes=drive" : "&modes=drive,ferry";
  const { data: result, loading, error } = useApi(`/routes/connect?from=${from}&to=${to}${via.length ? `&via=${via.join(",")}` : ""}${modeParam}`);
  const stops = result?.hops || [];
  const roadOnly = result?.legs?.every((l) => l.mode === "drive");
  const { data: geom } = useApi(roadOnly && stops.length >= 2 ? `/routes/geometry?stops=${stops.join(",")}` : null);
  const timelineBody = useMemo(() => (result ? { pace, days: [{ stops: result.stops, start_time: startTime }] } : null), [result, pace, startTime]);
  const { data: tl } = useLivePost("/planner/timeline", timelineBody);

  useEffect(() => {
    document.title = `${name(from)} → ${name(to)} · Route connector`;
  }, [from, to, name]);

  const t = result?.totals;
  const coords = geom?.live ? geom.coords : result?.path;

  const addAsDay = () => {
    const newDays = [...days, { id: Math.random().toString(36).slice(2), title: `${name(from)} → ${name(to)}`, stops: result.stops, start_time: startTime, notes: "" }];
    setTrip({ days: newDays, activeDay: newDays.length - 1 });
    toast(`Added as Day ${newDays.length}`);
  };

  return (
    <div className="page container">
      <PageHeader eyebrow="Route connector" icon={RouteIcon} title="Connect any two places" lead="Fastest chain of roads, ferries and boats between destinations — with time ranges from the planner, a clock-time estimate and a live map." />

      <div className="rc card pad">
        <div className="rc-grid">
          <PlaceSelect id="rc-from" label="From" value={from} onChange={(v) => update({ from: v })} list={list} dot="a" />
          <button className="icon-btn rc-swap" onClick={() => update({ from: to, to: from, via: [...via].reverse().join(",") })} aria-label="Swap start and destination"><ArrowUpDown size={18} /></button>
          <PlaceSelect id="rc-to" label="To" value={to} onChange={(v) => update({ to: v })} list={list} dot="b" />
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          {via.map((v, i) => (
            <span key={v + i} className="chip sm on">via {name(v)} <button className="chip-x" onClick={() => update({ via: via.filter((_, j) => j !== i).join(",") })} aria-label={`Remove ${name(v)}`}><X size={12} /></button></span>
          ))}
          {via.length < 4 && (
            <label className="chip sm add-via">
              <Plus size={14} /> Add a stop
              <select value="" onChange={(e) => e.target.value && update({ via: [...via, e.target.value].join(",") })} aria-label="Add a stop along the way">
                <option value="">Add a stop</option>
                {list.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
              </select>
            </label>
          )}
          <span style={{ flex: 1 }} />
          <Segmented layoutId="rc-modes" value={modes} onChange={setModes} options={[{ value: "all", label: "All" }, { value: "ferry", label: "No boats" }, { value: "road", label: "Road only" }]} />
        </div>
      </div>

      {error && <div className="alert error" style={{ marginTop: 16 }}>{error.message}</div>}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div key={result.hops.join("-")} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="split" style={{ marginTop: 22 }}>
            <div className="stack" style={{ "--gap": "18px" }}>
              <div className="route-summary">
                <div>
                  <span className="eyebrow light">Door to door</span>
                  <div className="rs-time">{hmRange(t.min_minutes, t.max_minutes)}</div>
                  <div className="rs-sub">{kmRange(t.km_min, t.km_max)} · {t.hop_count} leg{t.hop_count === 1 ? "" : "s"} · {t.modes.map((m) => MODE_META[m].label).join(" + ")}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {result.directions_url && roadOnly && (
                    <a href={result.directions_url} target="_blank" rel="noopener noreferrer" className="btn glass sm"><Navigation size={16} /> Google Maps</a>
                  )}
                  <button className="btn glass sm" onClick={addAsDay}><CalendarPlus size={16} /> Add as a trip day</button>
                  <Link className="btn glass sm" to={`/atlas?from=${result.hops[0]}&to=${result.hops[result.hops.length - 1]}&fly=1`}><Plane size={16} /> Fly it in 3D</Link>
                </div>
              </div>
              <div className="card pad"><Journey result={result} name={name} /></div>
            </div>
            <div className="stack" style={{ "--gap": "18px" }}>
              <div className="map-card">
                <AlbaniaMap
                  nodes={stops.map((s) => bySlug[s]).filter(Boolean)}
                  order={Object.fromEntries(result.stops.map((s, i) => [s, i + 1]))}
                  routes={coords ? [{ coords, color: "#d9653b" }] : []}
                  fit={result.path}
                  showNetwork={false}
                />
                <span className="map-src tiny">{geom?.live ? `Road geometry · ${geom.source}` : "Schematic route"}</span>
              </div>
              <div className="card pad">
                <div className="panel-title">
                  <h3><Clock size={18} /> Timeline estimate</h3>
                  <div className="row" style={{ gap: 8 }}>
                    <select className="select sm-select" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Start time">
                      {["06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "11:00", "12:00", "14:00"].map((x) => <option key={x}>{x}</option>)}
                    </select>
                    <Segmented layoutId="rc-pace" value={pace} onChange={setPace} options={[{ value: "relaxed", label: "Relaxed" }, { value: "balanced", label: "Balanced" }, { value: "packed", label: "Packed" }]} />
                  </div>
                </div>
                {tl ? <Timeline day={tl.days[0]} /> : <Skeleton h={200} />}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {loading && !result && <Skeleton h={360} r={26} style={{ marginTop: 22 }} />}

      <section className="section">
        <PlannerTable name={name} />
      </section>
      <p className="small muted center"><MapPin size={14} /> Want the big picture? <Link to="/map">Open the interactive map</Link>.</p>
    </div>
  );
}

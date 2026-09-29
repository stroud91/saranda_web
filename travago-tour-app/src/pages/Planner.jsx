import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarRange, Plus, Share2, Download, RotateCcw, LayoutTemplate, Clock, Car, MapPin, CalendarDays, Link2, Check, Sparkles, Users,
} from "lucide-react";
import { useTrip, tripPayload } from "../store/trip";
import { useUi } from "../store/ui";
import { useApi, useLivePost } from "../lib/useApi";
import { post, put } from "../lib/api";
import { useDestinations } from "../lib/useDestinations";
import { hmRange, kmRange, plural, todayIso } from "../lib/format";
import DayCard from "../components/planner/DayCard";
import Timeline from "../components/planner/Timeline";
import BudgetPanel from "../components/planner/BudgetPanel";
import AlbaniaMap from "../components/map/AlbaniaMap";
import RouteSketch from "../components/art/RouteSketch";
import { Alert, Segmented, Sheet, Skeleton, Stat, toast } from "../components/ui";

const DAY_COLORS = ["#d9653b", "#0b5c7e", "#19c3c0", "#6e7f3a", "#d63c7a", "#f4b63f", "#0e8fb0", "#8e3b5f"];

function TemplatePicker({ open, onClose }) {
  const { data } = useApi("/itineraries");
  const load = useTrip((s) => s.loadItinerary);
  const { name } = useDestinations();
  const [loadingSlug, setLoadingSlug] = useState(null);
  const pick = async (slug) => {
    setLoadingSlug(slug);
    try {
      const { api } = await import("../lib/api");
      const it = await api(`/itineraries/${slug}`);
      load(it);
      toast(`Loaded “${it.title}”`);
      onClose();
    } finally {
      setLoadingSlug(null);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Start from an itinerary">
      <p className="small muted">Replaces your current days. You can edit everything afterwards.</p>
      <div className="stack" style={{ "--gap": "12px" }}>
        {(data?.itineraries || []).map((it) => (
          <button key={it.slug} className="template card hover" onClick={() => pick(it.slug)} disabled={!!loadingSlug}>
            <div className={`template-art tone-${it.color}`}><RouteSketch path={it.path} width={120} height={80} color="#fff" /></div>
            <div className="template-text">
              <b>{it.title}</b>
              <span className="tiny muted">{it.tagline}</span>
              <span className="tiny">{it.bases.map(name).join(" · ")}</span>
            </div>
            {loadingSlug === it.slug ? <span className="spinner" /> : <span className="badge sea">{it.days_count}d</span>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function ShareSheet({ open, onClose }) {
  const t = useTrip();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const url = t.shareId ? `${window.location.origin}/trip/${t.shareId}` : null;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const body = tripPayload(t);
      const res = t.shareId && t.editKey
        ? await put(`/trips/${t.shareId}`, body, { headers: { "X-Edit-Key": t.editKey } })
        : await post("/trips", body);
      t.set({ shareId: res.share_id, editKey: res.edit_key || t.editKey, savedAt: new Date().toISOString() });
      toast("Trip saved");
    } catch (e) {
      if (e.status === 403 || e.status === 404) t.set({ shareId: null, editKey: null });
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Save & share your trip" variant="center">
      <div className="stack">
        <p className="small muted">Saving creates a private link anyone can view. Only this device can edit it (it keeps a secret edit key).</p>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : <Share2 size={18} />} {t.shareId ? "Save changes" : "Save & create link"}</button>
        {error && <Alert kind="error">{error}</Alert>}
        {url && (
          <>
            <div className="share-link">
              <Link2 size={16} />
              <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Share link" />
              <button className="btn sm" onClick={copy}>{copied ? <Check size={16} /> : "Copy"}</button>
            </div>
            {navigator.share && <button className="btn" onClick={() => navigator.share({ title: t.title, url })}><Share2 size={16} /> Share…</button>}
            {t.startDate ? (
              <a className="btn" href={`/api/trips/${t.shareId}/calendar.ics`}><Download size={16} /> Add to calendar (.ics)</a>
            ) : (
              <p className="tiny muted">Set a start date to export the trip to your calendar.</p>
            )}
            {t.savedAt && <p className="tiny faint">Last saved {new Date(t.savedAt).toLocaleString()}</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}

function Checklist() {
  const { data } = useApi("/essentials");
  const { checklist, toggleCheck } = useTrip();
  if (!data) return <Skeleton h={200} />;
  const all = Object.values(data.packing).flat();
  const done = all.filter((i) => checklist[i]).length;
  return (
    <div>
      <div className="progress"><span style={{ width: `${(done / all.length) * 100}%` }} /></div>
      <p className="tiny muted">{done} of {all.length} packed</p>
      {Object.entries(data.packing).map(([group, items]) => (
        <div key={group} className="check-group">
          <h4>{group}</h4>
          {items.map((i) => (
            <label key={i} className={`check ${checklist[i] ? "on" : ""}`}>
              <input type="checkbox" checked={!!checklist[i]} onChange={() => toggleCheck(i)} />
              <span className="box"><Check size={13} /></span> {i}
            </label>
          ))}
        </div>
      ))}
      <Alert kind="info">{data.final_check}</Alert>
    </div>
  );
}

export default function Planner() {
  const t = useTrip();
  const { bySlug, name } = useDestinations();
  const openConcierge = useUi((s) => s.openConcierge);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "timeline");
  const [mobileView, setMobileView] = useState(params.get("tab") === "budget" ? "budget" : "days");
  const [templates, setTemplates] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    document.title = `${t.title} · Planner`;
  }, [t.title]);

  const body = useMemo(() => ({
    pace: t.pace,
    start_date: t.startDate || undefined,
    days: t.days.map((d) => ({ stops: d.stops, start_time: d.start_time })),
  }), [t.pace, t.startDate, t.days]);
  const { data: tl, error: tlError } = useLivePost("/planner/timeline", body);
  const active = Math.min(t.activeDay, t.days.length - 1);
  const activeTl = tl?.days?.[active];

  const mapRoutes = useMemo(() => (tl?.days || []).map((d, i) => ({ coords: d.path, color: i === active ? DAY_COLORS[i % DAY_COLORS.length] : "#8c9aa1", dashed: i !== active })), [tl, active]);
  const allStops = [...new Set(t.days.flatMap((d) => d.stops))];
  const activeStops = t.days[active]?.stops || [];
  const nodes = allStops.map((s) => bySlug[s]).filter(Boolean);

  const panel = (key) => {
    if (key === "timeline") return tlError ? <Alert kind="error">{tlError.message}</Alert> : activeTl ? <Timeline day={activeTl} /> : <Skeleton h={260} />;
    if (key === "map")
      return (
        <div className="map-card tall">
          <AlbaniaMap nodes={nodes} routes={mapRoutes} order={Object.fromEntries(activeStops.map((s, i) => [s, i + 1]))} fit={activeTl?.path?.length ? activeTl.path : nodes.map((n) => [n.lat, n.lng])} showNetwork={false} dimOthers onSelect={() => {}} />
        </div>
      );
    if (key === "budget") return <BudgetPanel />;
    return <Checklist />;
  };

  const tabs = [
    { value: "timeline", label: "Timeline" },
    { value: "map", label: "Map" },
    { value: "budget", label: "Budget" },
    { value: "checklist", label: "Packing" },
  ];

  return (
    <div className="page container planner">
      <header className="planner-head">
        <div className="eyebrow"><CalendarRange size={14} /> Trip planner</div>
        <input className="trip-title" value={t.title} onChange={(e) => t.set({ title: e.target.value.slice(0, 120) })} aria-label="Trip title" />
        <div className="planner-controls">
          <label className="field compact">
            <span className="label"><CalendarDays size={13} /> Start date</span>
            <input type="date" className="input" value={t.startDate} min={todayIso()} onChange={(e) => t.set({ startDate: e.target.value })} />
          </label>
          <div className="field compact">
            <span className="label">Pace</span>
            <Segmented layoutId="pace" value={t.pace} onChange={(v) => t.set({ pace: v })} options={[{ value: "relaxed", label: "Relaxed" }, { value: "balanced", label: "Balanced" }, { value: "packed", label: "Packed" }]} />
          </div>
          <div className="row planner-buttons">
            <button className="btn sm" onClick={() => setTemplates(true)}><LayoutTemplate size={16} /> Templates</button>
            <button className="btn sm primary" onClick={() => setSharing(true)}><Share2 size={16} /> Save & share</button>
            <button className="btn sm ghost" onClick={() => { if (confirm("Start a new empty trip?")) t.reset(); }}><RotateCcw size={16} /> New</button>
          </div>
        </div>
        {tl && (
          <div className="stats planner-stats">
            <Stat icon={CalendarRange} label="Days" value={t.days.length} sub={t.startDate ? `from ${new Date(t.startDate + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "set a start date"} />
            <Stat icon={MapPin} label="Places" value={allStops.length} sub={plural(new Set(t.days.map((d) => d.stops[d.stops.length - 1]).filter((s) => bySlug[s]?.category !== "hub")).size, "base")} />
            <Stat icon={Car} label="On the road" value={hmRange(tl.totals.moving_minutes_min, tl.totals.moving_minutes_max)} sub={kmRange(tl.totals.km_min, tl.totals.km_max)} />
            <Stat icon={Clock} label="Exploring" value={`${Math.round(tl.totals.visit_minutes / 60)}h`} sub="suggested visit time" />
          </div>
        )}
      </header>

      <div className="mobile-only planner-mobile-tabs">
        <Segmented layoutId="pm" value={mobileView} onChange={setMobileView} options={[{ value: "days", label: "Days" }, ...tabs]} />
      </div>

      <div className="planner-grid">
        <section className={`planner-days ${mobileView !== "days" ? "hide-mobile" : ""}`} aria-label="Days">
          {t.days.map((d, i) => (
            <DayCard key={d.id} day={d} index={i} active={i === active} summary={tl?.days?.[i]?.summary} onSelect={() => t.set({ activeDay: i })} />
          ))}
          <motion.button layout className="add-day" onClick={t.addDay} disabled={t.days.length >= 30}><Plus size={18} /> Add day {t.days.length + 1}</motion.button>
          <div className="card pad helper">
            <Sparkles size={18} />
            <div className="small">
              Not sure where to go next? <button className="linklike" onClick={() => openConcierge(`I'm planning ${t.days.length} days starting in ${name(t.days[0]?.stops[0])}. What should I add?`)}>Ask the concierge</button>, browse <Link to="/itineraries">itineraries</Link>, or <Link to="/guides">book a guide</Link> for a day.
            </div>
          </div>
        </section>
        <aside className="planner-side">
          <div className="desktop-only planner-tabs">
            <Segmented layoutId="pt" value={tab} onChange={setTab} options={tabs} />
            <span className="small muted">Day {active + 1}: {t.days[active]?.stops.map(name).join(" → ")}</span>
          </div>
          <div className="card pad planner-panel desktop-only">{panel(tab)}</div>
          {mobileView !== "days" && <div className="card pad planner-panel mobile-only">{panel(mobileView)}</div>}
        </aside>
      </div>
      <TemplatePicker open={templates} onClose={() => setTemplates(false)} />
      <ShareSheet open={sharing} onClose={() => setSharing(false)} />
    </div>
  );
}

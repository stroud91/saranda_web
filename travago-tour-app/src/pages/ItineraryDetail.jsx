import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarRange, Car, MapPin, BedDouble, Lightbulb, Users, Moon, ChevronDown } from "lucide-react";
import { useApi, useLivePost } from "../lib/useApi";
import { useGuidesOn } from "../lib/useConfig";
import { useDestinations } from "../lib/useDestinations";
import { hmRange } from "../lib/format";
import AlbaniaMap from "../components/map/AlbaniaMap";
import Timeline from "../components/planner/Timeline";
import { ErrorState, Skeleton, Stat } from "../components/ui";
import { useTrip } from "../store/trip";

export default function ItineraryDetail() {
  const { slug } = useParams();
  const { data: it, error } = useApi(`/itineraries/${slug}`);
  const { bySlug, name } = useDestinations();
  const load = useTrip((s) => s.loadItinerary);
  const navigate = useNavigate();
  const [open, setOpen] = useState(0);
  const body = useMemo(() => (it ? { days: it.days.map((d) => ({ stops: d.stops, start_time: d.start_time })) } : null), [it]);
  const { data: tl } = useLivePost("/planner/timeline", body, 0);
  const guides = useGuidesOn();
  useEffect(() => { if (it) document.title = `${it.title} · Saranda Companion`; }, [it]);

  if (error) return <div className="page container"><ErrorState error={error} /></div>;
  if (!it) return <div className="page container"><Skeleton h={400} r={26} /></div>;

  const stops = [...new Set(it.days.flatMap((d) => d.stops))];
  const openDay = it.days[open];
  return (
    <div className="page container">
      <div className={`itin-hero tone-${it.color}`}>
        <div>
          <div className="eyebrow light"><CalendarRange size={14} /> {it.days_count}-day itinerary</div>
          <h1>{it.title}</h1>
          <p className="lead light">{it.why}</p>
          <div className="row">
            <button className="btn dark" onClick={() => { load(it); navigate("/plan"); }}>Use this plan</button>
            {guides && <Link className="btn glass" to="/guides">Add a guide</Link>}
          </div>
        </div>
        <div className="stats itin-hero-stats">
          <Stat icon={Car} label="Driving" value={hmRange(it.stats.drive_minutes_min, it.stats.drive_minutes_max)} sub={`${it.stats.km_min}–${it.stats.km_max} km`} />
          <Stat icon={MapPin} label="Places" value={it.stats.stops} />
          <Stat icon={BedDouble} label="Bases" value={it.stats.hotel_changes} sub={it.bases.map(name).join(", ")} />
        </div>
      </div>
      {it.alternative && <div className="tip-card" style={{ marginTop: 18 }}><Lightbulb size={20} /><div><b>A more relaxed alternative</b><p className="mb-0">{it.alternative}</p></div></div>}

      <div className="split" style={{ marginTop: 24 }}>
        <div className="stack" style={{ "--gap": "12px" }}>
          {it.days.map((d, i) => {
            const summary = tl?.days?.[i]?.summary;
            return (
              <motion.div key={d.day} layout className={`itin-day card ${open === i ? "open" : ""}`}>
                <button className="itin-day-head" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                  <span className="day-num"><span>Day</span><b>{d.day}</b></span>
                  <span className="itin-day-title"><b>{d.title}</b><span className="tiny muted">{d.stops.map(name).join(" → ")}</span></span>
                  {summary && <span className="tiny muted hide-mobile">{summary.start}–{summary.end}</span>}
                  <ChevronDown size={18} className="chev" />
                </button>
                {open === i && (
                  <div className="itin-day-body">
                    <p>{d.plan}</p>
                    {d.options?.length > 0 && <div className="chips">{d.options.map((o) => <span key={o} className="chip sm">{o}</span>)}</div>}
                    <p className="tiny muted row" style={{ gap: 6, marginTop: 10 }}><Moon size={13} /> Overnight: <b>{name(d.overnight)}</b></p>
                    {tl?.days?.[i] && <Timeline day={tl.days[i]} compact />}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        <aside className="sticky-col stack" style={{ "--gap": "16px" }}>
          <div className="map-card tall">
            <AlbaniaMap
              nodes={stops.map((s) => bySlug[s]).filter(Boolean)}
              order={openDay ? Object.fromEntries(openDay.stops.map((s, k) => [s, k + 1])) : {}}
              routes={(tl?.days || []).map((d, i) => ({ coords: d.path, color: i === open ? "#d9653b" : "#0b5c7e", dashed: i !== open }))}
              fit={openDay && tl?.days?.[open] ? tl.days[open].path : it.path}
              showNetwork={false}
            />
          </div>
          {guides && <div className="card pad small"><Users size={16} /> Prefer not to drive? <Link to="/guides?vehicle=true">Driver-guides</Link> can handle the long legs.</div>}
        </aside>
      </div>
    </div>
  );
}

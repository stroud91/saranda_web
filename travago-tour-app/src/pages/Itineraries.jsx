import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarRange, Car, MapPin, BedDouble, Star } from "lucide-react";
import { useApi } from "../lib/useApi";
import { useDestinations } from "../lib/useDestinations";
import { hmRange } from "../lib/format";
import RouteSketch from "../components/art/RouteSketch";
import { PageHeader, Skeleton } from "../components/ui";
import { useTrip } from "../store/trip";
import { tr } from "../i18n";

export default function Itineraries() {
  const { data } = useApi("/itineraries");
  const { name } = useDestinations();
  const load = useTrip((s) => s.loadItinerary);
  const navigate = useNavigate();
  useEffect(() => { document.title = "Itineraries · Saranda Companion"; }, []);

  const use = async (slug) => {
    const { api } = await import("../lib/api");
    load(await api(`/itineraries/${slug}`));
    navigate("/plan");
  };

  return (
    <div className="page container">
      <PageHeader eyebrow={tr("Ready-made itineraries")} icon={CalendarRange} title={tr("Pick a plan, then make it yours")} lead={tr("From a single Blue Eye day trip to the 14-day grand tour. Every plan opens in the planner with live timelines and budgets.")} />
      <div className="grid" style={{ "--min": "320px" }}>
        {!data && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={360} r={26} />)}
        {data?.itineraries.map((it, i) => (
          <motion.article key={it.slug} className={`itin-card card ${it.recommended ? "recommended" : ""}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.08 }}>
            <div className={`itin-top tone-${it.color}`}>
              <div className="itin-days"><b>{it.days_count}</b><span>{it.days_count === 1 ? tr("day") : tr("days")}</span></div>
              {it.recommended && <span className="badge glass"><Star size={12} /> {tr("Recommended")}</span>}
              <RouteSketch path={it.path} width={300} height={150} className="itin-sketch" color="#fff" />
            </div>
            <div className="itin-body">
              <h3>{it.title}</h3>
              <p className="small muted">{it.tagline}</p>
              <div className="itin-stats">
                <span><Car size={14} /> {hmRange(it.stats.drive_minutes_min, it.stats.drive_minutes_max)}</span>
                <span><MapPin size={14} /> {it.stats.stops} places</span>
                <span><BedDouble size={14} /> {it.stats.hotel_changes} {it.stats.hotel_changes === 1 ? "base" : "bases"}</span>
              </div>
              <p className="tiny muted">{it.audience}</p>
              <div className="itin-bases small">{it.bases.map(name).join(" · ")}</div>
              <div className="row" style={{ marginTop: 14 }}>
                <Link to={`/itineraries/${it.slug}`} className="btn sm">{tr("Day by day")}</Link>
                <button className="btn primary sm" onClick={() => use(it.slug)}>{tr("Use this plan")}</button>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  );
}

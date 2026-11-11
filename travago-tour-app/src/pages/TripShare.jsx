import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, CalendarDays } from "lucide-react";
import { useApi, useLivePost } from "../lib/useApi";
import { useDestinations } from "../lib/useDestinations";
import { fmtDate, addDays, hmRange } from "../lib/format";
import Timeline from "../components/planner/Timeline";
import AlbaniaMap from "../components/map/AlbaniaMap";
import CalendarButton from "../components/planner/CalendarButton";
import { ErrorState, Skeleton, toast } from "../components/ui";
import { useTrip } from "../store/trip";

export default function TripShare() {
  const { shareId } = useParams();
  const { data: trip, error } = useApi(`/trips/${shareId}`);
  const { bySlug, name } = useDestinations();
  const loadShared = useTrip((s) => s.loadShared);
  const navigate = useNavigate();
  const body = useMemo(() => (trip ? { pace: trip.data.pace, start_date: trip.data.start_date || undefined, days: trip.data.days } : null), [trip]);
  const { data: tl } = useLivePost("/planner/timeline", body, 0);
  useEffect(() => { if (trip) document.title = `${trip.title} · Shared trip`; }, [trip]);
  if (error) return <div className="page container"><ErrorState error={error} /></div>;
  if (!trip) return <div className="page container"><Skeleton h={400} r={26} /></div>;
  const stops = [...new Set(trip.data.days.flatMap((d) => d.stops))];
  return (
    <div className="page container">
      <div className="share-hero">
        <div>
          <div className="eyebrow">Shared trip</div>
          <h1>{trip.title}</h1>
          <p className="muted">{trip.data.days.length} days{trip.data.start_date ? ` · from ${fmtDate(trip.data.start_date, { day: "numeric", month: "long", year: "numeric" })}` : ""} · {trip.data.travelers} traveller{trip.data.travelers === 1 ? "" : "s"}
            {tl && <> · {hmRange(tl.totals.moving_minutes_min, tl.totals.moving_minutes_max)} on the road</>}</p>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => { loadShared(trip); toast("Copied into your planner"); navigate("/plan"); }}><Copy size={16} /> Copy to my planner</button>
          {trip.data.start_date && <CalendarButton trip={trip} shareId={shareId}>Calendar</CalendarButton>}
        </div>
      </div>
      <div className="map-card" style={{ height: 360, margin: "18px 0" }}>
        <AlbaniaMap nodes={stops.map((s) => bySlug[s]).filter(Boolean)} routes={(tl?.days || []).map((d) => ({ coords: d.path, color: "#d9653b" }))} fit={stops.map((s) => bySlug[s]).filter(Boolean).map((d) => [d.lat, d.lng])} showNetwork={false} />
      </div>
      <div className="grid" style={{ "--min": "340px" }}>
        {trip.data.days.map((d, i) => (
          <div key={i} className="card pad">
            <div className="row between">
              <h3 className="mb-0">Day {i + 1}{d.title ? `: ${d.title}` : ""}</h3>
              {trip.data.start_date && <span className="badge"><CalendarDays size={12} /> {fmtDate(addDays(trip.data.start_date, i))}</span>}
            </div>
            <p className="small muted">{d.stops.map(name).join(" → ")}</p>
            {d.notes && <p className="small">{d.notes}</p>}
            {tl?.days?.[i] && <Timeline day={tl.days[i]} compact />}
          </div>
        ))}
      </div>
    </div>
  );
}

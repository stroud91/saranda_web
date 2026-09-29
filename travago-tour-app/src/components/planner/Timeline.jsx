import { motion } from "framer-motion";
import { Car, Ship, Sailboat, Utensils, MapPin, Flag, Home, AlertTriangle, Info, Navigation } from "lucide-react";
import { Link } from "react-router-dom";
import { hm, hmRange, kmRange } from "../../lib/format";

const ICON = { depart: Flag, drive: Car, ferry: Ship, boat: Sailboat, lunch: Utensils, visit: MapPin, arrive: Home };

export default function Timeline({ day, compact = false }) {
  if (!day) return null;
  const s = day.summary;
  return (
    <div className="timeline-wrap">
      <div className="tl-summary">
        <span><b>{s.start}</b> → <b>{s.end}</b>{s.end_latest !== s.end && <span className="muted"> (latest {s.end_latest})</span>}</span>
        {s.moving_minutes_max > 0 && <span className="muted">· on the move {hmRange(s.moving_minutes_min, s.moving_minutes_max)}</span>}
        {s.km_max > 0 && <span className="muted">· {kmRange(s.km_min, s.km_max)}</span>}
        {day.directions_url && s.moving_minutes_max > 0 && (
          <a className="tiny" href={day.directions_url} target="_blank" rel="noopener noreferrer"><Navigation size={12} /> Directions</a>
        )}
      </div>
      {day.warnings?.length > 0 && (
        <div className="tl-warnings">
          {day.warnings.map((w) => (
            <div key={w.text} className={`alert ${w.level === "warn" ? "warn" : "info"}`}>
              {w.level === "warn" ? <AlertTriangle size={16} /> : <Info size={16} />}
              <span className="small">{w.text}</span>
            </div>
          ))}
        </div>
      )}
      <ol className={`timeline ${compact ? "compact" : ""}`}>
        {day.events.map((e, i) => {
          const Icon = ICON[e.type] || MapPin;
          return (
            <motion.li
              key={i}
              className={`tl-item t-${e.type} ${e.category ? "c-" + e.category : ""}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.035 }}
            >
              <span className="tl-time">{e.start}</span>
              <span className="tl-icon"><Icon size={14} /></span>
              <div className="tl-body">
                <div className="tl-title">
                  {e.type === "visit" && e.slug ? <Link to={`/explore/${e.slug}`}>{e.title}</Link> : e.title}
                </div>
                {e.minutes > 0 && (
                  <div className="tl-meta tiny muted">
                    {["drive", "ferry", "boat"].includes(e.type)
                      ? `${hm(e.minutes)} expected · range ${hmRange(e.min_minutes, e.max_minutes)} · ${kmRange(e.km_min, e.km_max)}`
                      : `${e.start}–${e.end} · ${hm(e.minutes)}`}
                    {e.source === "planner" && <span className="badge sea" style={{ marginLeft: 6 }}>Planner</span>}
                  </div>
                )}
                {!compact && e.note && <div className="tl-note tiny">{e.note}</div>}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

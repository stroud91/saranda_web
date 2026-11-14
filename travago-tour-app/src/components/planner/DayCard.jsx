import { useEffect, useState } from "react";
import { Reorder, motion } from "framer-motion";
import { GripVertical, X, Plus, ChevronUp, ChevronDown, Copy, Trash2, Clock } from "lucide-react";
import { CategoryIcon, CATEGORY_META } from "../ui";
import StopPicker from "./StopPicker";
import { useTrip } from "../../store/trip";
import { useDestinations } from "../../lib/useDestinations";
import { fmtDate, addDays, uid } from "../../lib/format";
import { tr } from "../../i18n";

const TIMES = ["06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

export default function DayCard({ day, index, summary, active, onSelect }) {
  const { updateDay, removeDay, moveDay, duplicateDay, addStop, removeStop, startDate, days } = useTrip();
  const { bySlug } = useDestinations();
  const [picking, setPicking] = useState(false);
  // Reorder needs keys that survive moves: pair each stop with a local id and
  // only regenerate when the stops change from outside this card.
  const [items, setItems] = useState(() => day.stops.map((s) => `${s}::${uid()}`));
  useEffect(() => {
    if (items.map((k) => k.split("::")[0]).join() !== day.stops.join()) setItems(day.stops.map((s) => `${s}::${uid()}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.stops]);
  const onReorder = (next) => {
    setItems(next);
    updateDay(index, { stops: next.map((k) => k.split("::")[0]) });
  };
  return (
    <motion.article layout className={`day-card card ${active ? "active" : ""}`} onClick={onSelect}>
      <header className="day-head">
        <div className="day-num">
          <span>{tr("Day")}</span>
          <b>{index + 1}</b>
        </div>
        <div className="day-title">
          <input
            className="day-title-input"
            value={day.title}
            placeholder={day.stops.map((s) => bySlug[s]?.name?.split(" (")[0] || s).join(" → ")}
            onChange={(e) => updateDay(index, { title: e.target.value.slice(0, 80) })}
            aria-label={`Day ${index + 1} title`}
          />
          <div className="row tiny muted" style={{ gap: 10 }}>
            {startDate && <span>{fmtDate(addDays(startDate, index))}</span>}
            <label className="row" style={{ gap: 4 }}>
              <Clock size={12} />
              <select value={day.start_time} onChange={(e) => updateDay(index, { start_time: e.target.value })} aria-label={tr("Start time")} className="bare-select">
                {TIMES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            {summary && <span>ends ~{summary.end}{summary.moving_minutes_max > 0 && ` · ${Math.round(summary.moving_minutes_max / 60 * 10) / 10}h max moving`}</span>}
          </div>
        </div>
        <div className="day-actions">
          <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); moveDay(index, -1); }} disabled={index === 0} aria-label={tr("Move day up")}><ChevronUp size={16} /></button>
          <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); moveDay(index, 1); }} disabled={index === days.length - 1} aria-label={tr("Move day down")}><ChevronDown size={16} /></button>
          <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); duplicateDay(index); }} aria-label={tr("Duplicate day")}><Copy size={15} /></button>
          <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); removeDay(index); }} aria-label={tr("Delete day")}><Trash2 size={15} /></button>
        </div>
      </header>
      <Reorder.Group axis="y" values={items} onReorder={onReorder} className="stop-list">
        {items.map((key, k) => {
          const slug = key.split("::")[0];
          const d = bySlug[slug];
          return (
            <Reorder.Item key={key} value={key} className="stop" whileDrag={{ scale: 1.03, boxShadow: "var(--sh-3)" }}>
              <GripVertical size={16} className="grip" aria-hidden="true" />
              <span className="stop-idx" style={{ "--c": CATEGORY_META[d?.category]?.color }}>{k + 1}</span>
              <span className="stop-name"><CategoryIcon category={d?.category} size={14} /> {d?.name || slug}</span>
              <button className="icon-btn xs" onClick={(e) => { e.stopPropagation(); removeStop(index, k); }} disabled={day.stops.length <= 1} aria-label={`Remove ${d?.name || slug}`}><X size={14} /></button>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
      <button className="add-stop" onClick={(e) => { e.stopPropagation(); setPicking(true); }} disabled={day.stops.length >= 10}>
        <Plus size={16} /> {tr("Add stop")}
      </button>
      {day.notes && <p className="tiny muted day-notes">{day.notes}</p>}
      <StopPicker open={picking} onClose={() => setPicking(false)} onPick={(slug) => addStop(index, slug)} near={day.stops[day.stops.length - 1]} />
    </motion.article>
  );
}

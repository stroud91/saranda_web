import { useMemo } from "react";
import { Wallet, Car, Sailboat, Users, PiggyBank } from "lucide-react";
import { motion } from "framer-motion";
import { useLivePost } from "../../lib/useApi";
import { euro, lek } from "../../lib/format";
import { Segmented, Stepper, Skeleton } from "../ui";
import { useTrip } from "../../store/trip";
import { tr } from "../../i18n";

const COLORS = { stay: "#0b5c7e", food: "#d9653b", activities: "#19c3c0", car: "#6e7f3a", fuel: "#a9b872", transport: "#8c9aa1", boat: "#0e8fb0", guide: "#d63c7a" };

export default function BudgetPanel() {
  const t = useTrip();
  const month = t.startDate ? Number(t.startDate.slice(5, 7)) : new Date().getMonth() + 1;
  const days = t.days.length;
  const body = useMemo(() => ({
    travelers: t.travelers, days, style: t.style, month,
    car_days: Math.min(t.carDays, days), boat_days: t.boatDays,
    guide_day_rate: t.guideRate || undefined, guide_days: t.guideDays,
  }), [t.travelers, days, t.style, month, t.carDays, t.boatDays, t.guideRate, t.guideDays]);
  const { data, loading } = useLivePost("/planner/budget", body, 250);
  const total = data ? data.total[1] : 1;
  return (
    <div className="budget">
      <div className="budget-controls">
        <div className="field"><span className="label">{tr("Travel style")}</span>
          <Segmented layoutId="style" value={t.style} onChange={(v) => t.set({ style: v })} options={[{ value: "budget", label: "Budget" }, { value: "comfort", label: "Comfort" }, { value: "premium", label: "Premium" }]} />
        </div>
        <div className="row between">
          <span className="row small" style={{ gap: 6 }}><Users size={16} /> {tr("Travellers")}</span>
          <Stepper label={tr("travellers")} value={t.travelers} min={1} max={20} onChange={(v) => t.set({ travelers: v })} />
        </div>
        <div className="row between">
          <span className="row small" style={{ gap: 6 }}><Car size={16} /> {tr("Rental-car days")}</span>
          <Stepper label={tr("car days")} value={Math.min(t.carDays, days)} min={0} max={days} onChange={(v) => t.set({ carDays: v })} />
        </div>
        <div className="row between">
          <span className="row small" style={{ gap: 6 }}><Sailboat size={16} /> {tr("Boat days")}</span>
          <Stepper label={tr("boat days")} value={t.boatDays} min={0} max={10} onChange={(v) => t.set({ boatDays: v })} />
        </div>
      </div>
      {!data && loading && <Skeleton h={180} />}
      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="budget-result">
          <div className="budget-total">
            <span className="stat-label"><Wallet size={14} /> Estimated total · {data.season} season</span>
            <div className="budget-amount">{euro(data.total[0])} – {euro(data.total[1])}</div>
            <div className="small muted">
              {euro(data.per_person_per_day[0])}–{euro(data.per_person_per_day[1])} per person per day
              {data.total_all && <> · ≈ {lek(data.total_all[0])}–{lek(data.total_all[1])}</>}
            </div>
          </div>
          <div className="budget-bar" role="img" aria-label={tr("Budget breakdown")}>
            {data.lines.map((l) => (
              <motion.span key={l.key} layout style={{ width: `${(l.max / total) * 100}%`, background: COLORS[l.key] || "#999" }} title={`${l.label}: ${euro(l.min)}–${euro(l.max)}`} />
            ))}
          </div>
          <ul className="budget-lines">
            {data.lines.map((l) => (
              <li key={l.key}>
                <span className="swatch" style={{ background: COLORS[l.key] }} />
                <span className="bl-label">{l.label}<span className="tiny muted block">{l.detail}</span></span>
                <b>{euro(l.min)}–{euro(l.max)}</b>
              </li>
            ))}
          </ul>
          <div className="tip-card small"><PiggyBank size={18} /><div><b>{tr("Save money")}</b><p className="mb-0">{data.save_money.join(" ")}</p></div></div>
          <p className="tiny faint">{data.note}</p>
        </motion.div>
      )}
    </div>
  );
}

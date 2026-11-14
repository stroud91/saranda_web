import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { tr } from "../../i18n";

const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Month grid. `busy` = Set of ISO dates; `range` = [startIso, endIso] highlight. */
export default function MonthCalendar({ month, onMonth, busy = new Set(), selected, range, onPick, minDate }) {
  const [y, m] = month.split("-").map(Number);
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  }, [y, m, month]);
  const shift = (n) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    onMonth(d.toISOString().slice(0, 7));
  };
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="cal">
      <div className="cal-head">
        <button className="icon-btn sm" onClick={() => shift(-1)} aria-label={tr("Previous month")} disabled={minDate && month <= minDate.slice(0, 7)}><ChevronLeft size={18} /></button>
        <b>{label}</b>
        <button className="icon-btn sm" onClick={() => shift(1)} aria-label={tr("Next month")}><ChevronRight size={18} /></button>
      </div>
      <div className="cal-grid" role="grid">
        {WEEK.map((w) => <span key={w} className="cal-w">{w}</span>)}
        {cells.map((iso, i) => {
          if (!iso) return <span key={i} />;
          const past = minDate && iso < minDate;
          const isBusy = busy.has(iso);
          const inRange = range && range[0] && range[1] && iso >= range[0] && iso < range[1];
          const cls = ["cal-d", isBusy && "busy", past && "past", selected === iso && "sel", inRange && "in", range?.[0] === iso && "start"].filter(Boolean).join(" ");
          return (
            <button key={iso} className={cls} disabled={past || isBusy || !onPick} onClick={() => onPick?.(iso)} aria-label={`${iso}${isBusy ? " unavailable" : ""}`} aria-pressed={selected === iso}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="cal-legend tiny muted"><span><i className="lg sel" /> {tr("Selected")}</span><span><i className="lg busy" /> {tr("Unavailable")}</span></div>
    </div>
  );
}

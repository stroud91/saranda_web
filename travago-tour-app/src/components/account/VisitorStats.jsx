import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ShieldCheck } from "lucide-react";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import { axisTop, dateTicks } from "../../lib/chart";
import { Alert, Segmented, Skeleton } from "../ui";
import { LANGS, locale, tr } from "../../i18n";

const RANGES = [{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }, { value: 90, label: "90 days" }, { value: 365, label: "12 months" }];
const DEVICES = { phone: "Phone", computer: "Computer", tablet: "Tablet" };
const num = (n) => Number(n || 0).toLocaleString(locale());

const H = 220;
const PAD = { top: 14, right: 14, bottom: 28, left: 38 };

/** Visitors per day: one line, a crosshair that finds the day, and the same numbers as a table below. */
function VisitorsChart({ series }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(640);
  const [at, setAt] = useState(null); // index of the day being read, or null
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = series.length;
  const top = axisTop(Math.max(...series.map((d) => d.visitors), 0));
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v) => PAD.top + innerH - (v / top) * innerH;
  const line = series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.visitors).toFixed(1)}`).join("");
  const area = `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;

  const find = (e) => {
    const box = wrap.current.getBoundingClientRect();
    const ratio = (e.clientX - box.left - PAD.left) / innerW;
    setAt(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  };
  const onKey = (e) => {
    const move = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (move) setAt((i) => Math.max(0, Math.min(n - 1, (i ?? n - 1) + move)));
    else if (e.key === "Home") setAt(0);
    else if (e.key === "End") setAt(n - 1);
    else if (e.key === "Escape") setAt(null);
    else return;
    e.preventDefault();
  };
  const day = at === null ? null : series[at];
  const last = series[n - 1];
  const left = at === null ? 0 : x(at);
  return (
    <div
      className="chart" ref={wrap} tabIndex={0} role="group" onKeyDown={onKey}
      aria-label={tr("Visitors per day. Use the left and right arrow keys to read each day.")}
      onPointerMove={find} onPointerDown={find} onPointerLeave={() => setAt(null)} onFocus={() => setAt((i) => i ?? n - 1)} onBlur={() => setAt(null)}
    >
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true">
        {[0, top / 2, top].map((v) => (
          <g key={v}>
            <line className="chart-grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="chart-tick" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">{num(v)}</text>
          </g>
        ))}
        {dateTicks(n, Math.floor(innerW / 68)).map((i, k, all) => (
          <text key={i} className="chart-tick" x={x(i)} y={H - 8} textAnchor={k === 0 ? "start" : k === all.length - 1 ? "end" : "middle"}>
            {fmtDate(series[i].day, { day: "numeric", month: "short" })}
          </text>
        ))}
        <path className="chart-area" d={area} />
        <path className="chart-line" d={line} />
        {day && <line className="chart-cross" x1={left} x2={left} y1={PAD.top} y2={y(0)} />}
        <circle className="chart-dot" cx={x(day ? at : n - 1)} cy={y((day || last).visitors)} r="5" />
      </svg>
      {day && (
        <div className={`chart-tip ${left > width / 2 ? "flip" : ""}`} style={{ left }} role="status">
          <span className="chart-tip-date">{fmtDate(day.day, { weekday: "short", day: "numeric", month: "short" })}</span>
          <span className="chart-tip-row"><i className="chart-key" /><b>{num(day.visitors)}</b> {tr(day.visitors === 1 ? "visitor" : "visitors")}</span>
          <span className="chart-tip-row"><i /><b>{num(day.views)}</b> {tr(day.views === 1 ? "page view" : "page views")}</span>
          {day.bookings > 0 && <span className="chart-tip-row"><i /><b>{num(day.bookings)}</b> {tr(day.bookings === 1 ? "booking" : "bookings")}</span>}
        </div>
      )}
    </div>
  );
}

/** The chart's numbers for anyone who'd rather read them (or can't see the chart). */
function DayTable({ series }) {
  return (
    <details className="chart-table">
      <summary>{tr("Show these numbers as a table")}</summary>
      <div className="chart-table-scroll">
        <table>
          <thead><tr><th scope="col">{tr("Day")}</th><th scope="col">{tr("Visitors")}</th><th scope="col">{tr("Page views")}</th><th scope="col">{tr("Bookings")}</th></tr></thead>
          <tbody>
            {[...series].reverse().map((d) => (
              <tr key={d.day}><th scope="row">{fmtDate(d.day, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</th><td>{num(d.visitors)}</td><td>{num(d.views)}</td><td>{num(d.bookings)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** One list, largest first: a name, its number and a bar to compare by. */
function Ranked({ title, hint, rows, total, name = (key) => key }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <section className="rank card pad">
      <h3>{title}</h3>
      {hint && <p className="tiny muted">{hint}</p>}
      {!rows.length ? <p className="small muted">{tr("Nothing counted yet.")}</p> : (
        <ol className="rank-list">
          {rows.map((r) => (
            <li key={r.key}>
              <span className="rank-name">{name(r.key)}</span>
              <span className="rank-value"><b>{num(r.count)}</b>{total > 0 && <span className="muted"> · {Math.round((r.count / total) * 100)}%</span>}</span>
              <span className="rank-bar" aria-hidden="true"><span style={{ width: `${Math.max(1.5, (r.count / max) * 100)}%` }} /></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function VisitorStats() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api(`/admin/stats?days=${days}`, { cacheable: false })
      .then((d) => { if (live) { setData(d); setError(""); } })
      .catch((e) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [days]);
  const language = useMemo(() => Object.fromEntries(LANGS.map((l) => [l.code, l.name])), []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Skeleton h={320} r={20} />;
  const { totals, series } = data;
  const perVisitor = totals.visitors ? (totals.views / totals.visitors).toLocaleString(locale(), { maximumFractionDigits: 1 }) : "–";
  return (
    <section className="stack visitors" style={{ "--gap": "18px" }}>
      <div className="row between wrap gap-sm">
        <h2 className="h3"><BarChart3 size={18} /> {tr("Visitors")}</h2>
        <Segmented options={RANGES} value={days} onChange={setDays} layoutId="stats-range" />
      </div>
      {!data.enabled && <Alert kind="info">{tr("Counting is switched off (STATS_ENABLED=false on the server). Numbers from before are still shown.")}</Alert>}
      <div className={`stack ${loading ? "is-loading" : ""}`} style={{ "--gap": "18px" }}>
        <div className="visitor-tiles">
          <div className="stat"><div className="stat-label">{tr("Visitors")}</div><div className="stat-value">{num(totals.visitors)}</div><div className="stat-sub">{tr("counted once a day each")}</div></div>
          <div className="stat"><div className="stat-label">{tr("Page views")}</div><div className="stat-value">{num(totals.views)}</div><div className="stat-sub">{tr("{n} per visitor", { n: perVisitor })}</div></div>
          <div className="stat"><div className="stat-label">{tr("Bookings")}</div><div className="stat-value">{num(totals.bookings)}</div><div className="stat-sub">{tr("made on the site, your stays")}</div></div>
        </div>
        <div className="card pad chart-card">
          <h3>{tr("Visitors per day")}</h3>
          <p className="tiny muted">{fmtDate(data.from, { day: "numeric", month: "short", year: "numeric" })} – {fmtDate(data.to, { day: "numeric", month: "short", year: "numeric" })}</p>
          {totals.views === 0 && <p className="small muted">{tr("No visits counted in this period yet. Numbers appear here as people open the site.")}</p>}
          <VisitorsChart series={series} />
          <DayTable series={series} />
        </div>
        <div className="rank-grid">
          <Ranked title={tr("Most viewed pages")} rows={data.pages} total={totals.views} />
          <Ranked title={tr("Where visitors came from")} hint={tr("Only the other site's name is kept, never the full address.")} rows={data.referrers} total={totals.visitors}
            name={(key) => (key === "(direct)" ? tr("Direct: typed address, bookmark or app") : key)} />
          <Ranked title={tr("First page they opened")} rows={data.entries} total={totals.visitors} />
          <div className="rank-pair">
            <Ranked title={tr("Language")} rows={data.languages} total={totals.visitors} name={(key) => language[key] || key} />
            <Ranked title={tr("Device")} rows={data.devices} total={totals.visitors} name={(key) => tr(DEVICES[key] || key)} />
          </div>
        </div>
      </div>
      <p className="tiny muted"><ShieldCheck size={13} /> {tr("Counted without cookies: nothing is stored on a visitor's device and no record is kept per person, so no cookie banner is needed. Robots, your own visits and browsers that ask not to be tracked aren't counted.")}</p>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Link2, Lock, RefreshCw, Trash2 } from "lucide-react";
import { fresh, partnerDelete, partnerPost } from "../../lib/partners";
import { addDays, fmtDate, todayIso } from "../../lib/format";
import { Alert, Field, Sheet, Skeleton, toast } from "../ui";
import { locale, tr } from "../../i18n";

const SITES = ["Airbnb", "Booking.com", "Vrbo"];
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY = { day: "numeric", month: "short" };
const WHEN = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(tr("Link copied"));
  } catch {
    window.prompt(tr("Copy this link"), text);
  }
}

/** One month, each night coloured by why it is taken. Click two days to choose a range. */
function Month({ month, onMonth, nights, range, onPick }) {
  const [y, m] = month.split("-").map(Number);
  const today = todayIso();
  const cells = useMemo(() => {
    const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  }, [y, m, month]);
  const shift = (n) => onMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7));
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale(), { month: "long", year: "numeric", timeZone: "UTC" });
  const last = range.to || range.from;
  return (
    <div className="cal host-cal">
      <div className="cal-head">
        <button type="button" className="icon-btn sm" onClick={() => shift(-1)} aria-label={tr("Previous month")} disabled={month <= today.slice(0, 7)}><ChevronLeft size={18} /></button>
        <b>{label}</b>
        <button type="button" className="icon-btn sm" onClick={() => shift(1)} aria-label={tr("Next month")}><ChevronRight size={18} /></button>
      </div>
      <div className="cal-grid" role="grid">
        {WEEK.map((w) => <span key={w} className="cal-w">{tr(w)}</span>)}
        {cells.map((iso, i) => {
          if (!iso) return <span key={i} />;
          const why = nights.get(iso);
          const picked = range.from && iso >= range.from && iso <= last;
          const cls = ["cal-d", why, iso < today && "past", picked && "in", (iso === range.from || iso === last) && picked && "start"].filter(Boolean).join(" ");
          return <button type="button" key={iso} className={cls} disabled={iso < today} onClick={() => onPick(iso)} aria-label={`${iso}${why ? ` ${tr("taken")}` : ""}`}>{Number(iso.slice(8))}</button>;
        })}
      </div>
      <div className="cal-legend tiny muted">
        <span><i className="lg bk" /> {tr("Booked here")}</span>
        <span><i className="lg imp" /> {tr("Other sites")}</span>
        <span><i className="lg man" /> {tr("Blocked by you")}</span>
      </div>
    </div>
  );
}

/**
 * Calendar for one stay: see what is taken, block nights by hand, and keep it in
 * step with Airbnb, Booking.com and others so the same night is never sold twice.
 * `stay` is { id, name } or null when closed.
 */
export default function CalendarSheet({ stay, onClose }) {
  const id = stay?.id;
  const [view, setView] = useState(null);
  const [error, setError] = useState({ at: "", text: "" }); // shown next to the action that failed
  const [busy, setBusy] = useState("");
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [range, setRange] = useState({ from: "", to: "", note: "" });
  const [feed, setFeed] = useState({ site: SITES[0], other: "", url: "" });

  useEffect(() => {
    if (!id) return;
    setView(null);
    setError({ at: "", text: "" });
    setRange({ from: "", to: "", note: "" });
    setFeed({ site: SITES[0], other: "", url: "" });
    setMonth(todayIso().slice(0, 7));
    fresh(`/calendar/stays/${id}`).then(setView).catch((e) => setError({ at: "load", text: e.message }));
  }, [id]);

  const nights = useMemo(() => {
    const map = new Map();
    const fill = (start, end, why) => { for (let d = start; d < end; d = addDays(d, 1)) map.set(d, why); };
    for (const b of view?.blocks || []) if (b.manual) fill(b.start_date, b.end_date, "man");
    for (const b of view?.blocks || []) if (!b.manual) fill(b.start_date, b.end_date, "imp");
    for (const b of view?.bookings || []) fill(b.start_date, b.end_date, "bk");
    return map;
  }, [view]);

  const run = async (label, call, done) => {
    setBusy(label);
    setError({ at: "", text: "" });
    try {
      setView(await call());
      if (done) toast(done);
      return true;
    } catch (e) {
      setError({ at: label, text: e.message });
      return false;
    } finally {
      setBusy("");
    }
  };
  const pick = (iso) => setRange((r) => (!r.from || r.to || iso < r.from ? { ...r, from: iso, to: "" } : { ...r, to: iso }));
  const block = async (e) => {
    e.preventDefault();
    const last = range.to || range.from;
    const ok = await run("block", () => partnerPost(`/calendar/stays/${id}/blocks`, { start_date: range.from, end_date: addDays(last, 1), note: range.note || null }), tr("Nights blocked"));
    if (ok) setRange({ from: "", to: "", note: "" });
  };
  const connect = async (e) => {
    e.preventDefault();
    const name = feed.site === "other" ? feed.other.trim() : feed.site;
    const ok = await run("feed", () => partnerPost(`/calendar/stays/${id}/feeds`, { name, url: feed.url.trim() }), tr("Calendar connected"));
    if (ok) setFeed({ site: SITES[0], other: "", url: "" });
  };

  const manual = (view?.blocks || []).filter((b) => b.manual);
  const feeds = view?.feeds || [];
  const problem = (...at) => (at.includes(error.at) && error.text ? <Alert kind="error">{error.text}</Alert> : null);
  return (
    <Sheet open={Boolean(stay)} onClose={onClose} title={stay ? `${tr("Calendar")} · ${stay.name}` : ""}>
      {problem("load")}
      {!view ? error.at !== "load" && <Skeleton h={320} r={20} /> : (
        <div className="stack" style={{ "--gap": "22px" }}>
          <Month month={month} onMonth={setMonth} nights={nights} range={range} onPick={pick} />

          <form className="stack card pad" onSubmit={block}>
            <b><Lock size={15} /> {tr("Block nights")}</b>
            <span className="small muted">{tr("For nights you've sold elsewhere, repairs or your own use. Click the first and last night in the calendar, or type them.")}</span>
            <div className="biz-fields">
              <div className="half"><Field label={tr("First night")}><input className="input" type="date" required min={todayIso()} value={range.from} onChange={(e) => { const v = e.target.value; setRange((r) => ({ ...r, from: v, to: r.to && r.to < v ? "" : r.to })); }} /></Field></div>
              <div className="half"><Field label={tr("Last night")}><input className="input" type="date" min={range.from || todayIso()} value={range.to} onChange={(e) => { const v = e.target.value; setRange((r) => ({ ...r, to: v })); }} /></Field></div>
              <div className="full"><Field label={tr("{label} (optional)", { label: tr("Note for yourself") })}><input className="input" maxLength={200} value={range.note} onChange={(e) => { const v = e.target.value; setRange((r) => ({ ...r, note: v })); }} placeholder={tr("Family visiting")} /></Field></div>
            </div>
            {problem("block")}
            <button className="btn primary" disabled={!range.from || busy === "block"}>{busy === "block" ? <span className="spinner" /> : <Lock size={16} />} {tr("Block these nights")}</button>
          </form>
          {problem("unblock")}

          {manual.length > 0 && (
            <section className="stack">
              <b>{tr("Blocked by you")}</b>
              <ul className="host-list">
                {manual.map((b) => (
                  <li key={b.id} className="host-row">
                    <div className="host-row-main">
                      <span className="small"><b>{fmtDate(b.start_date, DAY)} → {fmtDate(addDays(b.end_date, -1), DAY)}</b>{b.note ? ` · ${b.note}` : ""}</span>
                    </div>
                    <button type="button" className="icon-btn sm" disabled={Boolean(busy)} onClick={() => run("unblock", () => partnerDelete(`/calendar/stays/${id}/blocks/${b.id}`), tr("Nights opened again"))} aria-label={tr("Open these nights again")} title={tr("Open these nights again")}><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {view.bookings.length > 0 && (
            <section className="stack">
              <b>{tr("Booked here")}</b>
              <ul className="host-list">
                {view.bookings.map((b) => (
                  <li key={b.reference} className="host-row">
                    <div className="host-row-main"><span className="small"><b>{fmtDate(b.start_date, DAY)} → {fmtDate(b.end_date, DAY)}</b> · {b.guest} · {b.reference}</span></div>
                    <span className={`badge ${b.status === "confirmed" ? "olive" : "sun"}`}>{tr(b.status)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="stack">
            <b><Link2 size={15} /> {tr("Keep in step with other booking sites")}</b>
            <span className="small muted">{tr("Two links make this work. The other site's link tells us which nights it has sold; our link tells that site which nights are taken here. Each site checks the other every few hours, so block by hand when a booking is very last-minute.")}</span>
            {feeds.length > 0 && (
              <ul className="host-list">
                {feeds.map((f) => (
                  <li key={f.id} className={`host-row ${f.last_error ? "needs" : ""}`}>
                    <div className="host-row-main">
                      <div className="row between"><b>{f.name}</b><span className={`badge ${f.last_error ? "terracotta" : "olive"}`}>{f.last_error ? tr("Not syncing") : tr("{n} reserved periods", { n: f.events })}</span></div>
                      {f.last_error
                        ? <span className="small host-why">{f.last_error}. {f.last_ok_at ? tr("Nights from the last good check ({when}) stay blocked.", { when: fmtDate(f.last_ok_at, WHEN) }) : ""}</span>
                        : <span className="tiny muted">{tr("Last checked {when}", { when: fmtDate(f.last_ok_at, WHEN) })}</span>}
                      <button type="button" className="link-btn small" onClick={() => copy(f.export_url)}><Copy size={13} /> {tr("Copy the link to paste into {name}", { name: f.name })}</button>
                    </div>
                    <button type="button" className="icon-btn sm" disabled={Boolean(busy)} onClick={() => window.confirm(tr("Disconnect {name}? Its nights will no longer be blocked here.", { name: f.name })) && run("drop", () => partnerDelete(`/calendar/stays/${id}/feeds/${f.id}`), tr("Calendar disconnected"))} aria-label={tr("Disconnect {name}", { name: f.name })} title={tr("Disconnect")}><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
            {problem("sync", "drop")}
            {feeds.length > 0 && <button type="button" className="btn sm" disabled={Boolean(busy)} onClick={() => run("sync", () => partnerPost(`/calendar/stays/${id}/sync`, {}), tr("Calendars checked"))}>{busy === "sync" ? <span className="spinner" /> : <RefreshCw size={15} />} {tr("Check them now")}</button>}

            {feeds.length < view.max_feeds && (
              <form className="stack card pad" onSubmit={connect}>
                <b>{tr("Connect a calendar")}</b>
                <div className="biz-fields">
                  <div className={feed.site === "other" ? "half" : "full"}>
                    <Field label={tr("Site")}>
                      <select className="select" value={feed.site} onChange={(e) => { const v = e.target.value; setFeed((f) => ({ ...f, site: v })); }}>
                        {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                        <option value="other">{tr("Another site")}</option>
                      </select>
                    </Field>
                  </div>
                  {feed.site === "other" && <div className="half"><Field label={tr("Its name")}><input className="input" required maxLength={60} value={feed.other} onChange={(e) => { const v = e.target.value; setFeed((f) => ({ ...f, other: v })); }} /></Field></div>}
                  <div className="full">
                    <Field label={tr("Calendar link from that site")} hint={tr("Airbnb: Calendar → Availability → Connect calendars → Export. Booking.com: Calendar → Sync calendars → Export. The link ends in .ics.")}>
                      <input className="input" type="url" required maxLength={600} placeholder="https://www.airbnb.com/calendar/ical/…" value={feed.url} onChange={(e) => { const v = e.target.value; setFeed((f) => ({ ...f, url: v })); }} autoComplete="off" />
                    </Field>
                  </div>
                </div>
                {problem("feed")}
                <button className="btn" disabled={busy === "feed"}>{busy === "feed" ? <span className="spinner" /> : <Link2 size={16} />} {tr("Connect")}</button>
              </form>
            )}

            <div className="card pad stack">
              <b>{tr("Our link for other sites")}</b>
              <span className="small muted">{tr("Paste it where the other site asks to import a calendar. It shows only which nights are taken, never names or prices. Once a site is connected above, use that site's own link instead.")}</span>
              <div className="copy-row">
                <input className="input" readOnly value={view.export_url} onFocus={(e) => e.target.select()} aria-label={tr("Our link for other sites")} />
                <button type="button" className="btn" onClick={() => copy(view.export_url)}><Copy size={16} /> {tr("Copy")}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </Sheet>
  );
}

import { useCallback, useEffect, useState } from "react";
import { BedDouble, Check, Mail, MessageSquare, RefreshCw, X } from "lucide-react";
import { fresh, partnerPatch } from "../../lib/partners";
import { euro, fmtDate } from "../../lib/format";
import { Alert, Skeleton, toast } from "../ui";

const LONG = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
const TONE = { requested: "sun", confirmed: "olive", cancelled: "terracotta", expired: "terracotta", new: "sun", answered: "olive", closed: "" };

function BookingRow({ b, onChange }) {
  const [busy, setBusy] = useState(false);
  const act = async (status, done) => {
    setBusy(true);
    try {
      onChange(await partnerPatch(`/partner/bookings/${b.reference}`, { status }));
      toast(done);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={`host-row ${b.status === "requested" ? "needs" : ""}`}>
      <div className="host-row-main">
        <div className="row between"><b>{b.hotel_name}</b><span className={`badge ${TONE[b.status] || ""}`}>{b.status}</span></div>
        <span className="small">{fmtDate(b.start_date)} → {fmtDate(b.end_date, LONG)} · {b.nights} nights · {b.guest_count} guests · <b>{euro(b.total_cost)}</b></span>
        <span className="small muted">{b.guest_name} · <a href={`mailto:${b.guest_email}`}>{b.guest_email}</a>{b.guest_phone ? <> · <a href={`tel:${b.guest_phone.replace(/[^\d+]/g, "")}`}>{b.guest_phone}</a></> : null}</span>
        {b.notes && <span className="small host-notes">“{b.notes}”</span>}
        <span className="tiny faint">Ref {b.reference} · the guest pays you directly</span>
      </div>
      <div className="host-actions">
        {b.status === "requested" && <button type="button" className="btn sm primary" disabled={busy} onClick={() => act("confirmed", "Confirmed — the guest has been emailed")}><Check size={15} /> Confirm</button>}
        {["requested", "confirmed"].includes(b.status) && <button type="button" className="btn sm" disabled={busy} onClick={() => window.confirm(`${b.status === "requested" ? "Decline" : "Cancel"} booking ${b.reference}? The guest will be emailed.`) && act("cancelled", "Cancelled — the guest has been emailed")}><X size={15} /> {b.status === "requested" ? "Decline" : "Cancel"}</button>}
      </div>
    </li>
  );
}

function EnquiryRow({ q, onChange }) {
  const [busy, setBusy] = useState(false);
  const mark = async (status) => {
    setBusy(true);
    try {
      onChange(await partnerPatch(`/partner/enquiries/${q.reference}`, { status }));
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const when = q.start_date ? fmtDate(q.start_date, LONG) + (q.end_date ? ` → ${fmtDate(q.end_date, LONG)}` : "") : null;
  const reply = `mailto:${q.email}?subject=${encodeURIComponent(`Re: ${q.subject}`)}`;
  return (
    <li className={`host-row ${q.status === "new" ? "needs" : ""}`}>
      <div className="host-row-main">
        <div className="row between"><b>{q.subject}</b><span className={`badge ${TONE[q.status] || ""}`}>{q.status}</span></div>
        {(when || q.people) && <span className="small">{[when, q.people ? `${q.people} people` : null].filter(Boolean).join(" · ")}</span>}
        <span className="small host-notes">{q.message}</span>
        <span className="small muted">{q.name} · <a href={`mailto:${q.email}`}>{q.email}</a>{q.phone ? <> · <a href={`tel:${q.phone.replace(/[^\d+]/g, "")}`}>{q.phone}</a></> : null} · {fmtDate(q.created_at, { day: "numeric", month: "short" })}</span>
      </div>
      <div className="host-actions">
        <a className="btn sm primary" href={reply} onClick={() => q.status === "new" && mark("answered")}><Mail size={15} /> Reply by email</a>
        {q.status === "new" && <button type="button" className="btn sm" disabled={busy} onClick={() => mark("answered")}><Check size={15} /> Mark answered</button>}
        {q.status === "answered" && <button type="button" className="btn sm" disabled={busy} onClick={() => mark("closed")}>Close</button>}
      </div>
    </li>
  );
}

/** Booking requests for the business's stays and questions about its rentals and activities. */
export default function Requests({ onCount }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fresh("/partner/requests"));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data) onCount?.(data.bookings.filter((b) => b.status === "requested").length + data.enquiries.filter((q) => q.status === "new").length);
  }, [data, onCount]);

  const replace = (key) => (row) => setData((d) => ({ ...d, [key]: d[key].map((x) => (x.reference === row.reference ? row : x)) }));
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Skeleton h={220} r={20} />;
  const empty = !data.bookings.length && !data.enquiries.length;
  return (
    <div className="stack" style={{ "--gap": "22px" }}>
      <div className="row between">
        <p className="small muted" style={{ margin: 0 }}>Guests contact you here. You reply and take payment yourself — nothing is charged through this site.</p>
        <button type="button" className="btn sm" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {empty && <div className="empty">No requests yet. They'll appear here, and we'll email you each time.</div>}
      {data.bookings.length > 0 && (
        <section className="stack">
          <h2 className="h3"><BedDouble size={18} /> Booking requests</h2>
          <ul className="host-list">{data.bookings.map((b) => <BookingRow key={b.reference} b={b} onChange={replace("bookings")} />)}</ul>
        </section>
      )}
      {data.enquiries.length > 0 && (
        <section className="stack">
          <h2 className="h3"><MessageSquare size={18} /> Questions</h2>
          <ul className="host-list">{data.enquiries.map((q) => <EnquiryRow key={q.reference} q={q} onChange={replace("enquiries")} />)}</ul>
        </section>
      )}
    </div>
  );
}

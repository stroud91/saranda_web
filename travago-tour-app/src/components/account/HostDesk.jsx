import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, BedDouble, Check, Inbox, Landmark, Mail, RefreshCw, Star, Users, X } from "lucide-react";
import { api } from "../../lib/api";
import { euro, fmtDate, money } from "../../lib/format";
import { Alert, Segmented, Skeleton, toast } from "../ui";
import { usePartnersOn } from "../../lib/useConfig";
import PartnerReview from "./PartnerReview";
import HostListings from "./HostListings";
import ReviewDesk from "./ReviewDesk";
import VisitorStats from "./VisitorStats";
import SiteHealth from "./SiteHealth";
import { plural, tr } from "../../i18n";

const STATUS = { requested: "requested", pending: "pending", confirmed: "confirmed", cancelled: "cancelled", expired: "expired", accepted: "accepted", declined: "declined" };

const patch = (path, body) => api(path, { method: "PATCH", body });
const fresh = (path) => api(path, { cacheable: false });

/** Why a booking needs the host, or null if it doesn't. */
function attention(b) {
  if (b.status === "requested") return tr("Guest is waiting for you to confirm");
  if (b.payment_status === "review") return tr("Payment amount didn't match — check it in PayPal");
  if (b.status === "pending" && b.payment_method === "bank") return b.transfer_claimed ? tr("Guest says the transfer was sent — check your bank") : tr("Waiting for a bank transfer");
  if (b.payment_status === "refunded" && b.status === "confirmed") return tr("Payment was refunded — decide what happens to the stay");
  if (b.refund_status === "due") return b.cancelled_by === "host" ? tr("Refund due: {amount} (you cancelled)", { amount: money(b.refund_amount) }) : tr("Refund due: {amount} (guest cancelled, per your terms)", { amount: money(b.refund_amount) });
  return null;
}

function BookingRow({ b, onChange }) {
  const [busy, setBusy] = useState(false);
  const act = async (body, done) => {
    setBusy(true);
    try {
      onChange(await patch(`/admin/bookings/${b.reference}`, body));
      toast(done);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const why = attention(b);
  const open = ["requested", "pending"].includes(b.status) || (b.status === "confirmed" && b.end_date > new Date().toISOString().slice(0, 10));
  const refund = async (method) => {
    const ask = method === "manual" ? tr("Mark the refund of {amount} as paid back? Do this only after you've sent the money.", { amount: money(b.refund_amount) })
      : tr("Send {amount} back to the guest now? This moves real money and can't be undone.", { amount: money(b.refund_amount) });
    if (!window.confirm(ask)) return;
    setBusy(true);
    try {
      onChange(await api(`/admin/bookings/${b.reference}/refund`, { method: "POST", body: { method } }));
      toast(tr("Refund recorded — the guest has been emailed"));
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const stayed = b.status === "confirmed" && b.end_date <= new Date().toISOString().slice(0, 10);
  // For guests you talk to on WhatsApp: a personal link that lets them review this stay once.
  const reviewLink = async () => {
    setBusy(true);
    try {
      const { url } = await api(`/admin/bookings/${b.reference}/review-link`, { method: "POST", body: {} });
      try {
        await navigator.clipboard.writeText(url);
        toast(tr("Review link copied — send it to the guest"));
      } catch {
        window.prompt(tr("Copy this link"), url);
      }
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={`host-row ${why ? "needs" : ""}`}>
      <div className="host-row-main">
        <div className="row between wrap gap-sm">
          <b>{b.hotel_name}</b>
          <span className={`badge ${b.status === "confirmed" ? "olive" : b.status === "cancelled" || b.status === "expired" ? "terracotta" : "sun"}`}>{tr(STATUS[b.status] || b.status)}{b.payment_status === "paid" ? ` · ${tr("paid")}` : ""}</span>
        </div>
        <span className="small">{fmtDate(b.start_date)} → {fmtDate(b.end_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {plural(b.nights, "{n} night", "{n} nights")} · {plural(b.guest_count, "{n} guest", "{n} guests")} · <b>{euro(b.total_cost)}</b></span>
        <span className="small muted">{b.guest_name} · <a href={`mailto:${b.guest_email}`}>{b.guest_email}</a>{b.guest_phone ? ` · ${b.guest_phone}` : ""}</span>
        <span className="tiny faint">{tr("Ref")} {b.reference} · {tr({ paypal: "PayPal", bank: "Bank transfer", card: "Card", request: "Pay on arrival" }[b.payment_method] || "—")}
          {b.amount_due != null && b.payment_method !== "request" ? ` · ${tr("due now {amount}", { amount: money(b.amount_due) })}` : ""}{b.balance_on_arrival > 0 ? ` · ${tr("{amount} on arrival", { amount: money(b.balance_on_arrival) })}` : ""}</span>
        {b.notes && <span className="small host-notes">“{b.notes}”</span>}
        {why && <span className="small host-why">{why}</span>}
      </div>
      {b.refund_status === "due" && (
        <div className="host-actions">
          {(b.refund_methods || []).map((m) => (
            <button key={m} type="button" className={`btn sm ${m === "manual" ? "" : "primary"}`} disabled={busy} onClick={() => refund(m)}>
              <Banknote size={15} /> {m === "paypal" ? tr("Refund {amount} via PayPal", { amount: money(b.refund_amount) }) : m === "card" ? tr("Refund {amount} to the card", { amount: money(b.refund_amount) }) : tr("I've paid it back")}
            </button>
          ))}
        </div>
      )}
      {stayed && <div className="host-actions"><button type="button" className="btn sm" disabled={busy} onClick={reviewLink}><Star size={15} /> {tr("Review link")}</button></div>}
      {open && (
        <div className="host-actions">
          {b.payment_method === "bank" && b.status === "pending"
            ? <button type="button" className="btn sm primary" disabled={busy} onClick={() => act({ paid: true }, tr("Marked as paid and confirmed"))}><Banknote size={15} /> {tr("Money received")}</button>
            : b.status === "requested" && <button type="button" className="btn sm primary" disabled={busy} onClick={() => act({ status: "confirmed" }, tr("Booking confirmed"))}><Check size={15} /> {tr("Confirm")}</button>}
          <button type="button" className="btn sm" disabled={busy} onClick={() => window.confirm(b.payment_status === "paid" ? tr("Cancel booking {ref}? The guest has paid: everything they paid will be owed back.", { ref: b.reference }) : tr("Cancel booking {ref}?", { ref: b.reference })) && act({ status: "cancelled" }, tr("Booking cancelled"))}><X size={15} /> {tr("Cancel")}</button>
        </div>
      )}
    </li>
  );
}

function GuideRow({ g, onChange }) {
  const [busy, setBusy] = useState(false);
  const act = async (status) => {
    setBusy(true);
    try {
      onChange(await patch(`/admin/guide-requests/${g.reference}`, { status }));
      toast(status === "accepted" ? tr("Request accepted") : tr("Request declined"));
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className={`host-row ${g.status === "requested" ? "needs" : ""}`}>
      <div className="host-row-main">
        <div className="row between wrap gap-sm"><b>{g.guide?.name}</b><span className={`badge ${g.status === "accepted" ? "olive" : g.status === "requested" ? "sun" : "terracotta"}`}>{tr(STATUS[g.status] || g.status)}</span></div>
        <span className="small">{fmtDate(g.tour_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {g.duration_label} · {plural(g.group_size, "{n} person", "{n} people")} · <b>{euro(g.quoted_price)}</b></span>
        <span className="small muted">{g.name} · <a href={`mailto:${g.email}`}>{g.email}</a>{g.phone ? ` · ${g.phone}` : ""}{g.pickup ? ` · ${tr("pickup: {place}", { place: g.pickup })}` : ""}</span>
        {g.message && <span className="small host-notes">“{g.message}”</span>}
        <span className="tiny faint">{tr("Ref")} {g.reference}</span>
      </div>
      {g.status === "requested" && (
        <div className="host-actions">
          <button type="button" className="btn sm primary" disabled={busy} onClick={() => act("accepted")}><Check size={15} /> {tr("Accept")}</button>
          <button type="button" className="btn sm" disabled={busy} onClick={() => act("declined")}><X size={15} /> {tr("Decline")}</button>
        </div>
      )}
    </li>
  );
}

/** The host's working view: what needs a decision, then everything else. */
export default function HostDesk() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("todo");
  const partnersOn = usePartnersOn();
  const load = useCallback(async () => {
    setError("");
    try {
      const [bookings, guides, messages, partners] = await Promise.all([
        fresh("/admin/bookings"), fresh("/admin/guide-requests"), fresh("/admin/messages"),
        partnersOn ? fresh("/admin/partners") : null,
      ]);
      setData({ bookings, guides, messages, partners });
    } catch (e) {
      setError(e.message);
    }
  }, [partnersOn]);
  useEffect(() => { load(); }, [load]);

  const replace = (key) => (row) => setData((d) => ({ ...d, [key]: d[key].map((x) => (x.reference === row.reference ? row : x)) }));
  const todo = useMemo(() => ({
    bookings: (data?.bookings || []).filter(attention),
    guides: (data?.guides || []).filter((g) => g.status === "requested"),
  }), [data]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Skeleton h={300} r={20} />;
  const count = todo.bookings.length + todo.guides.length;
  const bookings = view === "todo" ? todo.bookings : data.bookings;
  const guides = view === "todo" ? todo.guides : data.guides;
  return (
    <div className="stack host-desk" style={{ "--gap": "22px" }}>
      <div className="row between wrap gap-sm">
        <Segmented
          options={[{ value: "todo", label: tr("Needs you ({n})", { n: count }) }, { value: "all", label: "Everything" }, { value: "messages", label: tr("Messages ({n})", { n: data.messages.length }) },
            ...(data.partners ? [{ value: "partners", label: tr("Partners ({n})", { n: data.partners.queue.length }) }] : []),
            { value: "listings", label: "Your listings" }, { value: "reviews", label: "Reviews" }, { value: "visitors", label: "Visitors" }]}
          value={view} onChange={setView} layoutId="host-tabs"
        />
        <button type="button" className="btn sm" onClick={load}><RefreshCw size={15} /> {tr("Refresh")}</button>
      </div>
      {view === "listings" ? (
        <HostListings />
      ) : view === "reviews" ? (
        <ReviewDesk mode="host" />
      ) : view === "visitors" ? (
        <VisitorStats />
      ) : view === "partners" && data.partners ? (
        <PartnerReview data={data.partners} onReload={load} />
      ) : view === "messages" ? (
        <section className="stack">
          <h2 className="h3"><Inbox size={18} /> {tr("Messages from the contact form")}</h2>
          {!data.messages.length && <p className="muted">{tr("No messages yet.")}</p>}
          <ul className="host-list">
            {data.messages.map((m) => (
              <li key={m.id} className="host-row">
                <div className="host-row-main">
                  <div className="row between wrap gap-sm"><b>{m.name}</b><span className="badge">{m.topic}</span></div>
                  <span className="small host-notes">{m.message}</span>
                  <span className="small muted"><Mail size={13} /> <a href={`mailto:${m.email}`}>{m.email}</a> · {fmtDate(m.created_at, { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {view === "todo" && <SiteHealth />}
          {view === "todo" && count === 0 && <Alert kind="ok">{tr("You're all caught up. New requests and transfers will appear here.")}</Alert>}
          {bookings.length > 0 && (
            <section className="stack">
              <h2 className="h3"><BedDouble size={18} /> {tr("Stays")}</h2>
              <ul className="host-list">{bookings.map((b) => <BookingRow key={b.reference} b={b} onChange={replace("bookings")} />)}</ul>
            </section>
          )}
          {guides.length > 0 && (
            <section className="stack">
              <h2 className="h3"><Users size={18} /> {tr("Guide requests")}</h2>
              <ul className="host-list">{guides.map((g) => <GuideRow key={g.reference} g={g} onChange={replace("guides")} />)}</ul>
            </section>
          )}
          <p className="tiny muted"><Landmark size={13} /> {tr("Press “Money received” only after you see the transfer in your bank account with the booking reference.")}</p>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Ban, Check, ExternalLink, MessageSquareWarning, RotateCcw, Store } from "lucide-react";
import { KINDS, PROFILE_FIELDS, fieldLabel, partnerPatch, showValue } from "../../lib/partners";
import { fmtDate } from "../../lib/format";
import { Alert, toast } from "../ui";
import { tr } from "../../i18n";

const TYPE_LABEL = { business: "Business profile", stays: "Apartment", rentals: "Rental", experiences: "Activity" };
const STATUS_TONE = { approved: "olive", pending: "sun", rejected: "terracotta", suspended: "terracotta" };
const reviewPath = (q) => (q.type === "business" ? `/admin/partners/businesses/${q.id}` : `/admin/partners/listings/${q.type}/${q.id}`);

/** What was submitted: every field on a first review, or only what changed on an edit. */
function Submission({ q }) {
  if (!q.first_review) {
    return (
      <dl className="review-diff">
        {Object.entries(q.changes).map(([k, c]) => (
          <div key={k}><dt>{fieldLabel(k)}</dt><dd><del>{showValue(c.from)}</del><ins>{showValue(c.to)}</ins></dd></div>
        ))}
      </dl>
    );
  }
  const names = (q.type === "business" ? PROFILE_FIELDS : KINDS[q.type].fields).map((f) => f.name);
  return (
    <dl className="review-diff">
      {names.filter((k) => q.details[k] !== null && q.details[k] !== "" && !(Array.isArray(q.details[k]) && !q.details[k].length)).map((k) => (
        <div key={k}><dt>{fieldLabel(k)}</dt><dd>{showValue(q.details[k])}</dd></div>
      ))}
    </dl>
  );
}

function QueueRow({ q, onDone }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const decide = async (action) => {
    setBusy(true);
    try {
      await partnerPatch(reviewPath(q), { action, note: action === "reject" ? note : undefined });
      toast(action === "approve" ? tr("Approved — the business has been emailed") : tr("Sent back with your note"));
      onDone();
    } catch (e) {
      toast(e.message);
      setBusy(false);
    }
  };
  const waitsOnBusiness = q.type !== "business" && q.business_status !== "approved";
  return (
    <li className="host-row needs review-row">
      <div className="host-row-main">
        <div className="row between">
          <b>{q.name}</b>
          <span className="badge sun">{TYPE_LABEL[q.type]} · {q.first_review ? "new" : "edited"}</span>
        </div>
        {q.type !== "business" && <span className="small muted">from {q.business.name}{waitsOnBusiness ? ` (business is ${q.business_status}: guests won't see this until the business is approved)` : ""}</span>}
        <Submission q={q} />
        {asking && (
          <label className="field">
            <span className="label">{tr("What should they change? (emailed to the business)")}</span>
            <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} autoFocus />
          </label>
        )}
      </div>
      <div className="host-actions">
        {!asking ? (
          <>
            <button type="button" className="btn sm primary" disabled={busy} onClick={() => decide("approve")}><Check size={15} /> {tr("Approve")}</button>
            <button type="button" className="btn sm" disabled={busy} onClick={() => setAsking(true)}><MessageSquareWarning size={15} /> {q.first_review ? tr("Ask for changes") : tr("Don't accept")}</button>
          </>
        ) : (
          <>
            <button type="button" className="btn sm primary" disabled={busy || note.trim().length < 3} onClick={() => decide("reject")}>{tr("Send note")}</button>
            <button type="button" className="btn sm" disabled={busy} onClick={() => setAsking(false)}>{tr("Back")}</button>
          </>
        )}
      </div>
    </li>
  );
}

function BusinessRow({ b, onDone }) {
  const [busy, setBusy] = useState(false);
  const act = async (action) => {
    let note;
    if (action === "suspend") {
      note = window.prompt(`Take ${b.name} and all its listings offline? Add a short reason (emailed to the business):`);
      if (note === null) return;
    }
    setBusy(true);
    try {
      await partnerPatch(`/admin/partners/businesses/${b.id}`, { action, note: note || undefined });
      toast(action === "suspend" ? tr("Taken offline") : tr("Back online"));
      onDone();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="host-row">
      <div className="host-row-main">
        <div className="row between"><b>{b.name}</b><span className={`badge ${STATUS_TONE[b.status] || ""}`}>{b.status}</span></div>
        <span className="small muted">{b.city || "—"} · {b.listings} listing{b.listings === 1 ? "" : "s"} · {b.owner_email ? <a href={`mailto:${b.owner_email}`}>{b.owner_email}</a> : "no owner"} · joined {fmtDate(b.created_at, { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
      <div className="host-actions">
        {b.status === "approved" && <Link className="btn sm" to={`/partners/${b.slug}`}><ExternalLink size={14} /> {tr("Page")}</Link>}
        {b.status === "approved" && <button type="button" className="btn sm" disabled={busy} onClick={() => act("suspend")}><Ban size={14} /> {tr("Take offline")}</button>}
        {b.status === "suspended" && <button type="button" className="btn sm primary" disabled={busy} onClick={() => act("reinstate")}><RotateCcw size={14} /> {tr("Put back online")}</button>}
      </div>
    </li>
  );
}

/** The host's review of what partner businesses submit. Nothing is public until approved here. */
export default function PartnerReview({ data, onReload }) {
  return (
    <div className="stack" style={{ "--gap": "22px" }}>
      <section className="stack">
        <h2 className="h3"><Check size={18} /> {tr("Waiting for your review")}</h2>
        {!data.queue.length && <Alert kind="ok">{tr("Nothing to review. New businesses and listings will appear here, and you'll get an email.")}</Alert>}
        <ul className="host-list">{data.queue.map((q) => <QueueRow key={`${q.type}-${q.id}`} q={q} onDone={onReload} />)}</ul>
      </section>
      <section className="stack">
        <h2 className="h3"><Store size={18} /> {tr("Businesses")}</h2>
        {!data.businesses.length && <p className="muted">No businesses have signed up yet. They start at <Link to="/business">/business</Link>.</p>}
        <ul className="host-list">{data.businesses.map((b) => <BusinessRow key={b.id} b={b} onDone={onReload} />)}</ul>
      </section>
    </div>
  );
}

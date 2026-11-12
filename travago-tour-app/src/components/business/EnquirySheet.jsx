import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { post } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { useAuth } from "../../store/auth";
import { Alert, Field, Sheet } from "../ui";

const EMPTY = { name: "", email: "", phone: "", start_date: "", end_date: "", people: "", message: "", website: "" };

/**
 * A guest's question to a business. `target` is null when closed, otherwise
 * { business: {slug, name}, kind: "general" | "experience" | "rental", listing?: {id, name} }.
 */
export default function EnquirySheet({ target, onClose }) {
  const user = useAuth((s) => s.user);
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({ busy: false, error: "", fields: {}, sent: null });
  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!target) return;
    setState({ busy: false, error: "", fields: {}, sent: null });
    setForm((f) => ({ ...EMPTY, name: f.name || user?.name || "", email: f.email || user?.email || "", phone: f.phone || user?.phone || "" }));
  }, [target, user]);

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", fields: {}, sent: null });
    try {
      const sent = await post(`/businesses/${target.business.slug}/enquiries`, {
        ...form, kind: target.kind, listing_id: target.listing?.id, people: form.people === "" ? null : Number(form.people),
      });
      setState({ busy: false, error: "", fields: {}, sent });
    } catch (err) {
      setState({ busy: false, error: err.message, fields: err.fields || {}, sent: null });
    }
  };

  const rental = target?.kind === "rental";
  return (
    <Sheet open={Boolean(target)} onClose={onClose} title={target ? `Ask ${target.business.name}` : ""}>
      {target && (state.sent ? (
        <div className="stack">
          <Alert kind="ok"><b>Sent.</b> {target.business.name} will reply to you by email{form.phone ? " or phone" : ""}. Your reference is {state.sent.reference}.</Alert>
          <button type="button" className="btn" onClick={onClose}>Done</button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {target.listing && <p className="small muted" style={{ margin: 0 }}>About: <b>{target.listing.name}</b></p>}
          <div className="form-grid two">
            <Field label="Name" error={state.fields.name}><input className="input" value={form.name} onChange={up("name")} autoComplete="name" maxLength={120} required /></Field>
            <Field label="Email" error={state.fields.email}><input className="input" type="email" value={form.email} onChange={up("email")} autoComplete="email" maxLength={255} required /></Field>
          </div>
          <Field label="Phone or WhatsApp (optional)" error={state.fields.phone}><input className="input" type="tel" value={form.phone} onChange={up("phone")} autoComplete="tel" maxLength={40} /></Field>
          {target.kind !== "general" && (
            <div className="form-grid two">
              <Field label={rental ? "From (optional)" : "Date (optional)"} error={state.fields.start_date}><input className="input" type="date" min={todayIso()} value={form.start_date} onChange={up("start_date")} /></Field>
              {rental
                ? <Field label="Until (optional)" error={state.fields.end_date}><input className="input" type="date" min={form.start_date || todayIso()} value={form.end_date} onChange={up("end_date")} /></Field>
                : <Field label="People (optional)" error={state.fields.people}><input className="input" type="number" min={1} max={60} value={form.people} onChange={up("people")} /></Field>}
            </div>
          )}
          <Field label="Your question" error={state.fields.message}><textarea className="textarea" value={form.message} onChange={up("message")} maxLength={2000} required /></Field>
          <input className="hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={up("website")} aria-hidden="true" />
          {state.error && !Object.keys(state.fields).length && <Alert kind="error">{state.error}</Alert>}
          {state.fields.listing_id && <Alert kind="warn">{state.fields.listing_id}</Alert>}
          <button className="btn primary lg" disabled={state.busy}>{state.busy ? <span className="spinner" /> : <Send size={18} />} Send to {target.business.name}</button>
          <p className="tiny muted">Your details go to {target.business.name} so they can answer you, and nothing is charged. See our <Link to="/privacy">privacy policy</Link>.</p>
        </form>
      ))}
    </Sheet>
  );
}

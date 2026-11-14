import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Mail, MessageCircle, Send, MapPin } from "lucide-react";
import { post } from "../lib/api";
import { useConfig, whatsappUrl } from "../lib/useConfig";
import { Alert, Field, PageHeader } from "../components/ui";
import Handoff from "../components/ui/Handoff";
import { rich, tr } from "../i18n";

const TOPICS = ["stay", "guide", "trip", "general"];

export default function Contact() {
  const cfg = useConfig();
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => ({ name: "", email: "", topic: TOPICS.includes(params.get("topic")) ? params.get("topic") : "stay", message: "", website: "" }));
  const [state, setState] = useState({ busy: false, done: false, error: "", fields: {} });
  const up = (k) => (e) => { const v = e.target.value; setForm((f) => ({ ...f, [k]: v })); };
  useEffect(() => { document.title = "Contact · Meg'Rooms"; }, []);
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, done: false, error: "", fields: {} });
    try {
      const res = await post("/contact/", form);
      setState({ busy: false, done: true, error: "", fields: {}, handoff: res?.handoff || null });
    } catch (err) {
      setState({ busy: false, done: false, error: err.message, fields: err.fields || {} });
    }
  };
  const wa = whatsappUrl(cfg.whatsapp, "Hello Meg'Rooms!");
  return (
    <div className="page container narrow">
      <PageHeader eyebrow={tr("Contact")} icon={Mail} title={tr("Talk to a local")} lead={tr("Questions about our apartments, a guide or your route? We usually reply within a few hours.")} />
      <div className="row" style={{ marginBottom: 18 }}>
        {wa && <a className="btn whatsapp" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> {tr("WhatsApp")}</a>}
        {cfg.contact_email && <a className="btn" href={`mailto:${cfg.contact_email}`}><Mail size={18} /> {cfg.contact_email}</a>}
        <span className="small muted row" style={{ gap: 6 }}><MapPin size={15} /> {tr("Sarandë, Albania")}</span>
      </div>
      {state.done && state.handoff ? (
        <Handoff handoff={state.handoff} title={tr("Your message is ready to send")} />
      ) : state.done ? (
        <Alert kind="ok">{tr("Thanks — your message is on its way. We'll reply to {email}.", { email: form.email })}</Alert>
      ) : (
        <form className="card pad stack" onSubmit={submit} noValidate>
          <div className="form-grid two">
            <Field label={tr("Name")} error={state.fields.name}><input className="input" value={form.name} onChange={up("name")} autoComplete="name" maxLength={120} required /></Field>
            <Field label={tr("Email")} error={state.fields.email}><input className="input" type="email" value={form.email} onChange={up("email")} autoComplete="email" maxLength={255} required /></Field>
          </div>
          <Field label={tr("Topic")}><select className="select" value={form.topic} onChange={up("topic")}><option value="stay">{tr("Apartments")}</option><option value="guide">{tr("Guides")}</option><option value="trip">{tr("Trip planning")}</option><option value="general">{tr("Something else")}</option></select></Field>
          <Field label={tr("Message")} error={state.fields.message}><textarea className="textarea" value={form.message} onChange={up("message")} maxLength={3000} required /></Field>
          <input className="hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={up("website")} aria-hidden="true" />
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <button className="btn primary" disabled={state.busy}>{state.busy ? <span className="spinner" /> : <Send size={16} />} {tr("Send message")}</button>
          <p className="tiny muted">{rich("We use your details only to reply to you. See our <a>privacy policy</a>.", { a: (c) => <Link to="/privacy">{c}</Link> })}</p>
        </form>
      )}
    </div>
  );
}

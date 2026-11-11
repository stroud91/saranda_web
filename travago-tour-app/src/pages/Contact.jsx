import { useEffect, useState } from "react";
import { Mail, MessageCircle, Send, MapPin } from "lucide-react";
import { post } from "../lib/api";
import { useConfig, whatsappUrl } from "../lib/useConfig";
import { Alert, Field, PageHeader } from "../components/ui";
import Handoff from "../components/ui/Handoff";

export default function Contact() {
  const cfg = useConfig();
  const [form, setForm] = useState({ name: "", email: "", topic: "stay", message: "", website: "" });
  const [state, setState] = useState({ busy: false, done: false, error: "", fields: {} });
  const up = (k) => (e) => setForm({ ...form, [k]: e.target.value });
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
      <PageHeader eyebrow="Contact" icon={Mail} title="Talk to a local" lead="Questions about our apartments, a guide or your route? We usually reply within a few hours." />
      <div className="row" style={{ marginBottom: 18 }}>
        {wa && <a className="btn whatsapp" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> WhatsApp</a>}
        {cfg.contact_email && <a className="btn" href={`mailto:${cfg.contact_email}`}><Mail size={18} /> {cfg.contact_email}</a>}
        <span className="small muted row" style={{ gap: 6 }}><MapPin size={15} /> Sarandë, Albania</span>
      </div>
      {state.done && state.handoff ? (
        <Handoff handoff={state.handoff} title="Your message is ready to send" />
      ) : state.done ? (
        <Alert kind="ok">Thanks — your message is on its way. We'll reply to {form.email}.</Alert>
      ) : (
        <form className="card pad stack" onSubmit={submit} noValidate>
          <div className="form-grid two">
            <Field label="Name" error={state.fields.name}><input className="input" value={form.name} onChange={up("name")} autoComplete="name" maxLength={120} required /></Field>
            <Field label="Email" error={state.fields.email}><input className="input" type="email" value={form.email} onChange={up("email")} autoComplete="email" maxLength={255} required /></Field>
          </div>
          <Field label="Topic"><select className="select" value={form.topic} onChange={up("topic")}><option value="stay">Apartments</option><option value="guide">Guides</option><option value="trip">Trip planning</option><option value="general">Something else</option></select></Field>
          <Field label="Message" error={state.fields.message}><textarea className="textarea" value={form.message} onChange={up("message")} maxLength={3000} required /></Field>
          <input className="hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={up("website")} aria-hidden="true" />
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <button className="btn primary" disabled={state.busy}>{state.busy ? <span className="spinner" /> : <Send size={16} />} Send message</button>
        </form>
      )}
    </div>
  );
}

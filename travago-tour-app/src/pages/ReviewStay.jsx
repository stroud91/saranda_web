// The review form a guest reaches from the email we send after check-out
// (or from their account, when they are signed in with the address they booked with).
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Send, Star } from "lucide-react";
import { api, invalidate, post } from "../lib/api";
import { fmtDate } from "../lib/format";
import { Alert, Field, PageHeader, Skeleton } from "../components/ui";
import { currentLang, rich, tr } from "../i18n";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const lit = hover || value;
  return (
    <div className="star-input" role="radiogroup" aria-label={tr("Rating")} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} role="radio" aria-checked={value === n} aria-label={`${n} — ${tr(WORDS[n])}`} className={n <= lit ? "on" : ""}
          onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(0)} onClick={() => onChange(n)}>
          <Star size={34} fill={n <= lit ? "currentColor" : "none"} strokeWidth={1.6} />
        </button>
      ))}
      <span className="small muted">{lit ? tr(WORDS[lit]) : tr("Tap a star")}</span>
    </div>
  );
}

export default function ReviewStay() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const key = params.get("key") || "";
  const [invite, setInvite] = useState(null);
  const [problem, setProblem] = useState("");
  const [form, setForm] = useState({ rating: 0, title: "", text: "", website: "" });
  const [state, setState] = useState({ busy: false, error: "", fields: {}, done: false });

  useEffect(() => { document.title = `${tr("Write a review")} · Saranda Companion`; }, []);
  useEffect(() => {
    api(`/reviews/invite/${encodeURIComponent(reference)}${key ? `?key=${encodeURIComponent(key)}` : ""}`, { cacheable: false })
      .then(setInvite).catch((e) => setProblem(e.message));
  }, [reference, key]);

  const up = (k) => (e) => { const v = e.target.value; setForm((f) => ({ ...f, [k]: v })); };
  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) return setState((s) => ({ ...s, error: tr("Choose a rating from 1 to 5 stars.") }));
    setState({ busy: true, error: "", fields: {}, done: false });
    try {
      await post("/reviews/", { reference, key: key || null, rating: form.rating, title: form.title.trim() || null, text: form.text.trim(), lang: currentLang(), website: form.website });
      invalidate("/reviews");
      invalidate("/hotels");
      setState({ busy: false, error: "", fields: {}, done: true });
    } catch (err) {
      setState({ busy: false, error: err.message, fields: err.fields || {}, done: false });
    }
  };

  if (problem) return <div className="page container narrow"><PageHeader eyebrow={tr("Reviews")} icon={Star} title={tr("We couldn't open this review")} /><Alert kind="warn">{problem}</Alert><Link className="btn" to="/signin?next=/account">{tr("Sign in")}</Link></div>;
  if (!invite) return <div className="page container narrow"><Skeleton h={360} r={26} /></div>;
  if (state.done) {
    return (
      <div className="page container narrow">
        <PageHeader eyebrow={tr("Reviews")} icon={Star} title={tr("Thank you, {name}!", { name: invite.first_name || "" }).replace(", !", "!")} lead={tr("Your review is now on the page for future guests.")} />
        <Link className="btn primary" to={`/stays/${invite.stay.id}#reviews`}>{tr("See it on the page")}</Link>
      </div>
    );
  }
  return (
    <div className="page container narrow">
      <PageHeader eyebrow={tr("Reviews")} icon={Star} title={tr("How was your stay?")} lead={`${invite.stay.name} · ${fmtDate(invite.start_date)} → ${fmtDate(invite.end_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`} />
      {!invite.eligible ? <Alert kind="info">{invite.reason}</Alert> : (
        <form className="card pad stack" onSubmit={submit} noValidate>
          <StarInput value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} />
          <Field label={tr("{label} (optional)", { label: tr("A short headline") })}><input className="input" maxLength={120} value={form.title} onChange={up("title")} placeholder={tr("Quiet, clean and close to everything")} /></Field>
          <Field label={tr("Your review")} error={state.fields.text} hint={tr("What was good, what could be better, and anything future guests should know.")}>
            <textarea className="textarea" rows={6} required minLength={20} maxLength={2000} value={form.text} onChange={up("text")} />
          </Field>
          <input type="text" name="website" value={form.website} onChange={up("website")} tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <p className="tiny muted">{rich("Shown with your first name, the first letter of your surname and the month you stayed. See our <a>privacy policy</a>.", { a: (c) => <Link to="/privacy">{c}</Link> })}</p>
          <button className="btn primary lg" disabled={state.busy}>{state.busy ? <span className="spinner" /> : <Send size={18} />} {tr("Publish my review")}</button>
        </form>
      )}
    </div>
  );
}

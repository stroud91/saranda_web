import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BadgeCheck, Car, Languages, MapPin, UsersRound, CalendarCheck, Check, Award, Clock, ShieldCheck } from "lucide-react";
import { useApi } from "../lib/useApi";
import { post } from "../lib/api";
import { euro, todayIso, fmtDate } from "../lib/format";
import { useDestinations } from "../lib/useDestinations";
import GuideAvatar from "../components/art/GuideAvatar";
import SceneArt from "../components/art/SceneArt";
import Handoff from "../components/ui/Handoff";
import MonthCalendar from "../components/guides/MonthCalendar";
import { Alert, CategoryIcon, ErrorState, Field, Segmented, Skeleton, Stepper } from "../components/ui";
import { useTrip } from "../store/trip";
import { useAuth } from "../store/auth";

function RequestForm({ guide }) {
  const trip = useTrip();
  const { name } = useDestinations();
  const tomorrow = todayIso(1);
  const [month, setMonth] = useState(tomorrow.slice(0, 7));
  const { data: avail } = useApi(`/guides/${guide.slug}/availability?month=${month}`);
  const busy = useMemo(() => new Set(avail?.busy || []), [avail]);
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState("full");
  const [days, setDays] = useState(2);
  const [group, setGroup] = useState(Math.min(trip.travelers, guide.max_group));
  const [language, setLanguage] = useState(guide.languages[0]);
  const [useTripStops, setUseTripStops] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", pickup: "", message: "", website: "" });
  const user = useAuth((s) => s.user);
  useEffect(() => {  // signed-in guests don't retype their details
    if (user) setForm((f) => ({ ...f, name: f.name || user.name || "", email: f.email || user.email || "", phone: f.phone || user.phone || "" }));
  }, [user]);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ busy: false, error: "", done: null });

  const tripDayIdx = Math.min(trip.activeDay, trip.days.length - 1);
  const tripStops = trip.days[tripDayIdx]?.stops || [];
  const price = duration === "half" ? guide.price_half_day : duration === "full" ? guide.price_full_day : guide.price_full_day * days;
  const up = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!date) errs.tour_date = "Pick a date on the calendar";
    if (!form.name.trim()) errs.name = "Your name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus({ busy: true, error: "", done: null });
    try {
      const res = await post(`/guides/${guide.slug}/requests`, {
        tour_date: date, duration, days: duration === "multi" ? days : 1, group_size: group, language,
        stops: useTripStops ? tripStops : guide.signature_stops, ...form,
      });
      setStatus({ busy: false, error: "", done: res });
    } catch (err) {
      setErrors(err.fields || {});
      setStatus({ busy: false, error: err.message, done: null });
    }
  };

  if (status.done?.handoff) {
    const r = status.done;
    return (
      <motion.div className="success-card" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <p className="muted">{fmtDate(r.tour_date, { weekday: "long", day: "numeric", month: "long" })} · {r.duration_label} · {r.group_size} people · estimate <b>{euro(r.quoted_price)}</b></p>
        <Handoff handoff={r.handoff} title={`Send your request to ${guide.name}`} />
        <button type="button" className="btn ghost sm" onClick={() => setStatus({ busy: false, error: "", done: null })}>Change details</button>
      </motion.div>
    );
  }

  if (status.done) {
    const r = status.done;
    return (
      <motion.div className="success-card" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="success-icon"><Check size={30} /></div>
        <h3>Request sent to {guide.name}</h3>
        <p className="muted">{fmtDate(r.tour_date, { weekday: "long", day: "numeric", month: "long" })} · {r.duration_label} · {r.group_size} people</p>
        <div className="ref-code">{r.reference}</div>
        <p className="small">Quoted price <b>{euro(r.quoted_price)}</b> for your group. {guide.name} will reply to {r.email_masked} to confirm — nothing is charged until then.</p>
        <p className="tiny muted">Keep your reference: <Link to={`/guide-request/${r.reference}`}>track this request</Link>.</p>
      </motion.div>
    );
  }

  return (
    <form className="stack request-form" onSubmit={submit} noValidate>
      <div>
        <span className="label">1 · Choose a date</span>
        <MonthCalendar month={month} onMonth={setMonth} busy={busy} selected={date} onPick={setDate} minDate={tomorrow} />
        {errors.tour_date && <span className="field-error">{errors.tour_date}</span>}
      </div>
      <div className="field">
        <span className="label">2 · How long?</span>
        <Segmented layoutId={`dur-${guide.slug}`} value={duration} onChange={setDuration} options={[{ value: "half", label: `Half day · ${euro(guide.price_half_day)}` }, { value: "full", label: `Full day · ${euro(guide.price_full_day)}` }, { value: "multi", label: "Multi-day" }]} />
        {duration === "multi" && <div className="row" style={{ marginTop: 8 }}><span className="small">Days</span><Stepper label="days" value={days} min={2} max={14} onChange={setDays} /></div>}
      </div>
      <div className="form-grid two">
        <div className="field"><span className="label">Group size (max {guide.max_group})</span><Stepper label="group size" value={group} min={1} max={guide.max_group} onChange={setGroup} /></div>
        <Field label="Language"><select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>{guide.languages.map((l) => <option key={l}>{l}</option>)}</select></Field>
      </div>
      {tripStops.length > 1 && (
        <label className="check-row">
          <input type="checkbox" checked={useTripStops} onChange={(e) => setUseTripStops(e.target.checked)} />
          <span>Use Day {tripDayIdx + 1} of my trip: <b>{tripStops.map(name).join(" → ")}</b></span>
        </label>
      )}
      <span className="label">3 · Your details</span>
      <div className="form-grid two">
        <Field label="Name" error={errors.name}><input className="input" value={form.name} onChange={up("name")} autoComplete="name" maxLength={120} required /></Field>
        <Field label="Email" error={errors.email}><input className="input" type="email" value={form.email} onChange={up("email")} autoComplete="email" maxLength={255} required /></Field>
        <Field label="Phone / WhatsApp (optional)" error={errors.phone}><input className="input" type="tel" value={form.phone} onChange={up("phone")} autoComplete="tel" maxLength={40} /></Field>
        <Field label="Pickup point (optional)" error={errors.pickup}><input className="input" value={form.pickup} onChange={up("pickup")} placeholder="e.g. Meg'Rooms, Sarandë" maxLength={200} /></Field>
      </div>
      <Field label="Anything the guide should know?" error={errors.message}><textarea className="textarea" value={form.message} onChange={up("message")} maxLength={2000} placeholder="Kids, mobility, interests…" /></Field>
      <input className="hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={up("website")} aria-hidden="true" />
      {status.error && <Alert kind="error">{status.error}</Alert>}
      <div className="quote-bar">
        <div><span className="tiny muted">Estimated for your group</span><div className="quote-amount">{euro(price)}</div></div>
        <button className="btn primary lg" disabled={status.busy}>{status.busy ? <span className="spinner" /> : <CalendarCheck size={18} />} Request {guide.name.split(" ")[0]}</button>
      </div>
      <p className="tiny muted"><ShieldCheck size={12} /> No payment now. Your contact details are shared only with this guide.</p>
    </form>
  );
}

export default function GuideDetail() {
  const { slug } = useParams();
  const { data: g, error } = useApi(`/guides/${slug}`);
  useEffect(() => { if (g) document.title = `${g.name} · Local guide`; }, [g]);
  if (error) return <div className="page container"><ErrorState error={error} /></div>;
  if (!g) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  return (
    <div className="page container">
      <div className={`guide-hero p-${g.palette}`}>
        <div className="guide-hero-art"><SceneArt scene={g.signature_stop_details?.[0]?.category === "boat" ? "cove" : "harbor"} seed={g.slug} variant="golden" /></div>
        <div className="guide-hero-body">
          <GuideAvatar name={g.name} palette={g.palette} size={110} className="guide-hero-avatar" />
          <div>
            <div className="row" style={{ gap: 6 }}>
              {g.licensed && <span className="badge sea"><BadgeCheck size={12} /> Licensed guide</span>}
              {g.has_vehicle && <span className="badge olive"><Car size={12} /> Provides transport</span>}
              {g.is_sample && <span className="badge">Sample profile</span>}
            </div>
            <h1>{g.name}</h1>
            <p className="lead">{g.headline}</p>
          </div>
        </div>
      </div>
      <div className="split wide-left" style={{ marginTop: 24 }}>
        <div className="stack" style={{ "--gap": "18px" }}>
          <div className="stats">
            <div className="stat"><div className="stat-label"><MapPin size={14} /> Based in</div><div className="stat-value">{g.base_city}</div></div>
            <div className="stat"><div className="stat-label"><Clock size={14} /> Experience</div><div className="stat-value">{g.years_experience} yrs</div></div>
            <div className="stat"><div className="stat-label"><UsersRound size={14} /> Group</div><div className="stat-value">up to {g.max_group}</div></div>
          </div>
          <div className="card pad">
            <h3>About</h3>
            <p>{g.bio}</p>
            <div className="row" style={{ gap: 8 }}><Languages size={16} /> {g.languages.map((l) => <span key={l} className="chip sm">{l}</span>)}</div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}><Award size={16} /> {g.specialties.map((s) => <span key={s} className="chip sm">{s}</span>)}</div>
          </div>
          <div className="card pad">
            <h3>Signature stops</h3>
            <div className="sig-stops">
              {g.signature_stop_details.map((s) => (
                <Link key={s.slug} to={`/explore/${s.slug}`} className="sig-stop"><CategoryIcon category={s.category} size={16} /> {s.name}</Link>
              ))}
            </div>
          </div>
          <div className="card pad pricing">
            <div><span className="tiny muted">Half day (≈4h)</span><b>{euro(g.price_half_day)}</b></div>
            <div><span className="tiny muted">Full day (≈8h)</span><b>{euro(g.price_full_day)}</b></div>
            <p className="tiny muted" style={{ gridColumn: "1 / -1", margin: 0 }}>Prices are per group. Entry tickets, boat fuel and meals are usually extra — confirm with your guide.</p>
          </div>
        </div>
        <aside className="card pad sticky-col" id="request">
          <h3>Request {g.name.split(" ")[0]}</h3>
          <RequestForm guide={g} />
        </aside>
      </div>
    </div>
  );
}

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { BedDouble, Bath, Users, Star, Check, CalendarDays, MessageCircle, ShieldCheck, Compass, CreditCard, Landmark, Wallet, Clock, Store, Images } from "lucide-react";
import { useApi, useLivePost } from "../lib/useApi";
import { post } from "../lib/api";
import { euro, todayIso, addDays, fmtDate, goToPayPal, money } from "../lib/format";
import { useAuth } from "../store/auth";
import { useConfig, whatsappUrl } from "../lib/useConfig";
import SceneArt from "../components/art/SceneArt";
import Handoff from "../components/ui/Handoff";
import PhotoViewer from "../components/media/PhotoViewer";
import Reviews from "../components/stays/Reviews";
import MonthCalendar from "../components/guides/MonthCalendar";
import { Alert, ErrorState, Field, Sheet, Skeleton, Stepper } from "../components/ui";
import { WeatherCard } from "../components/live/Weather";
import { loc, plural, rich, stayName, tr } from "../i18n";

const PaymentStep = lazy(() => import("../components/stays/PaymentStep"));

export default function StayDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cfg = useConfig();
  const { data: h, error } = useApi(`/hotels/${id}`);
  const { data: avail } = useApi(`/hotels/${id}/availability?from=${todayIso()}&to=${todayIso(400)}`);
  const booked = useMemo(() => new Set(avail?.booked_nights || []), [avail]);
  const [checkIn, setCheckIn] = useState(todayIso(14));
  const [checkOut, setCheckOut] = useState(todayIso(17));
  const [guests, setGuests] = useState(2);
  const [month, setMonth] = useState(todayIso(14).slice(0, 7));
  const [picking, setPicking] = useState("in");
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [form, setForm] = useState({ guest_name: "", guest_email: "", guest_phone: "", notes: "", website: "" });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ busy: false, error: "", pay: null });
  const user = useAuth((s) => s.user);
  // Ways to pay come from the server; older configs only say whether cards are on.
  // A partner business's stay is always request-to-book: the guest pays that business directly.
  const partner = h?.business || null;
  const methods = useMemo(() => partner ? [{ id: "request", label: "Request to book" }]
    : cfg.payments?.methods?.length ? cfg.payments.methods
      : [cfg.payments?.enabled ? { id: "card", label: "Card" } : { id: "request", label: "Request to book" }], [cfg, partner]);
  const [method, setMethod] = useState(null);
  const chosen = methods.find((m) => m.id === method) || methods[0];
  const payable = chosen.id !== "request";
  const deposit = cfg.payments?.deposit_percent || 100;

  // Signed-in guests don't retype their details.
  useEffect(() => {
    if (!user || !open) return;
    setForm((f) => ({ ...f, guest_name: f.guest_name || user.name || "", guest_email: f.guest_email || user.email || "", guest_phone: f.guest_phone || user.phone || "" }));
  }, [user, open]);

  // Until the guest picks dates, default to the first free window of the minimum stay (3+ nights).
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || !avail || !h) return;
    const len = Math.max(h.min_nights || 1, 3);
    for (let i = 14; i < 380; i++) {
      const start = todayIso(i);
      const nights = Array.from({ length: len }, (_, k) => addDays(start, k));
      if (!nights.some((n) => booked.has(n))) {
        setCheckIn(start);
        setCheckOut(addDays(start, len));
        setMonth(start.slice(0, 7));
        break;
      }
    }
  }, [avail, h, booked, touched]);

  const quoteBody = useMemo(() => (h && checkOut > checkIn ? { hotel_id: h.id, start_date: checkIn, end_date: checkOut, guest_count: guests } : null), [h, checkIn, checkOut, guests]);
  const { data: quote, error: quoteError } = useLivePost("/bookings/quote", quoteBody, 250);

  useEffect(() => { if (h) document.title = `${stayName(h)} · ${h.business?.name || "Meg'Rooms"}`; }, [h]);

  const pick = (iso) => {
    setTouched(true);
    if (picking === "in" || iso <= checkIn) {
      setCheckIn(iso);
      if (checkOut <= iso) setCheckOut(addDays(iso, Math.max(h?.min_nights || 1, 2)));
      setPicking("out");
    } else {
      setCheckOut(iso);
      setPicking("in");
    }
  };

  const up = (k) => (e) => { const v = e.target.value; setForm((f) => ({ ...f, [k]: v })); };
  const book = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", pay: null });
    setErrors({});
    try {
      const res = await post("/bookings/", { ...quoteBody, ...form, ...(cfg.payments?.methods ? { payment_method: chosen.id } : {}) });
      if (res.handoff) {
        setState({ busy: false, error: "", pay: null, handoff: res.handoff });
      } else if (res.payment?.approve_url) {
        goToPayPal(res.payment.approve_url); // pay on PayPal's page, then come back to /booking/<reference>
      } else if (res.payment_required && cfg.payments?.publishable_key) {
        setState({ busy: false, error: "", pay: { secret: res.clientSecret, ref: res.booking.reference, amount: res.booking.amount_due ?? res.booking.total_cost } });
      } else {
        navigate(`/booking/${res.booking.reference}`);
      }
    } catch (err) {
      setErrors(err.fields || {});
      setState({ busy: false, error: err.message, pay: null });
    }
  };

  if (error) return <div className="page container"><ErrorState error={error} /></div>;
  if (!h) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  const wa = partner ? null : whatsappUrl(cfg.whatsapp, `Hello! I'm interested in ${h.hotel_name} from ${checkIn} to ${checkOut} for ${guests} guests.`);
  const nights = quote?.nights;

  return (
    <div className="page container">
      <div className={`stay-gallery ${h.image_urls?.length ? `photos n${Math.min(h.image_urls.length, 3)}` : ""}`}>
        {h.image_urls?.length ? (
          <>
            {h.image_urls.slice(0, 3).map((u, i) => (
              <button type="button" key={u} className={i === 0 ? "main" : ""} onClick={() => setPhoto(i)} aria-label={tr("Open photo {n}", { n: i + 1 })}>
                <img src={u} alt={`${loc(h, "hotel_name")} — ${tr("Photo {n}", { n: i + 1 })}`} loading={i === 0 ? "eager" : "lazy"} />
              </button>
            ))}
            {h.image_urls.length > 1 && <button type="button" className="btn sm glass gallery-all" onClick={() => setPhoto(0)}><Images size={15} /> {tr("All {n} photos", { n: h.image_urls.length })}</button>}
          </>
        ) : (
          <>
            <div className="main"><SceneArt scene="harbor" seed={`apt-${h.id}`} variant="golden" /></div>
            <div><SceneArt scene="beach" seed={`apt-b-${h.id}`} variant="day" /></div>
            <div><SceneArt scene="castle" seed="lekures-castle" variant="sunset" /></div>
          </>
        )}
      </div>
      <PhotoViewer photos={h.image_urls || []} index={photo} onIndex={setPhoto} alt={loc(h, "hotel_name")} />
      <div className="split wide-left" style={{ marginTop: 24 }}>
        <div className="stack" style={{ "--gap": "18px" }}>
          <div>
            <div className="eyebrow">{partner ? <><Store size={14} /> {tr("Hosted by")} <Link to={`/partners/${partner.slug}`}>{partner.name}</Link></> : "Meg'Rooms"} · {h.city}</div>
            <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)" }}>{loc(h, "hotel_name")}</h1>
            <div className="stay-facts">
              <span><BedDouble size={16} /> {plural(h.bedrooms, "{n} bedroom", "{n} bedrooms")} · {plural(h.beds, "{n} bed", "{n} beds")}</span>
              <span><Bath size={16} /> {h.bathrooms} bath</span>
              <span><Users size={16} /> {tr("up to {n} guests", { n: h.max_guests })}</span>
              {h.reviews?.count > 0 && <a href="#reviews"><Star size={16} fill="currentColor" /> {h.reviews.average.toFixed(1)} · {plural(h.reviews.count, "{n} review", "{n} reviews")}</a>}
              {h.airbnb_rating && <span><Star size={16} fill="currentColor" /> {h.airbnb_rating} on {h.rating_source}</span>}
            </div>
          </div>
          <p className="lead">{loc(h, "description")}</p>
          <div className="card pad">
            <h3>{tr("Amenities")}</h3>
            <ul className="amenities">{h.amenities.map((a) => <li key={a}><Check size={16} /> {tr(a)}</li>)}</ul>
          </div>
          <div className="card pad">
            <h3>{tr("Where you'll be")}</h3>
            <p className="small muted">{h.address}</p>
            {partner ? (
              <Link to="/routes" className="btn sm"><Compass size={16} /> {tr("Check drive times from here")}</Link>
            ) : (
              <>
                <p className="small">{tr("Butrint 30–45 min · Ksamil 25–40 min · Blue Eye 45–60 min · Himarë 1¼–1¾ h · Corfu by ferry.")}</p>
                <Link to="/itineraries/sarande-3-day-base" className="btn sm"><Compass size={16} /> {tr("3-day Sarandë base plan")}</Link>
              </>
            )}
          </div>
          {partner ? (
            <div className="card pad">
              <h3><Store size={18} /> {tr("Your host")}</h3>
              <p className="small muted">{rich("This stay is offered by <b>{name}</b>, an independent local business we've checked. They confirm your dates and you pay them directly.", { b: (c) => <b>{c}</b> }, { name: partner.name })}</p>
              <Link to={`/partners/${partner.slug}`} className="btn sm">{tr("About {name}", { name: partner.name })}</Link>
            </div>
          ) : (
            <div className="card pad"><h3>{tr("Sarandë weather")}</h3><WeatherCard compact /></div>
          )}
          <Reviews stayId={h.id} />
        </div>
        <aside className="card pad sticky-col booking-widget">
          <div className="row between">
            <span><b className="stay-price">{euro(h.price_per_night)}</b> <span className="muted">{tr("/ night")}</span></span>
            {h.min_nights > 1 && <span className="badge">{tr("min {n} nights", { n: h.min_nights })}</span>}
          </div>
          <div className="date-pair">
            <button className={picking === "in" ? "on" : ""} onClick={() => setPicking("in")}><span className="tiny muted">{tr("Check-in")}</span><b>{fmtDate(checkIn)}</b></button>
            <button className={picking === "out" ? "on" : ""} onClick={() => setPicking("out")}><span className="tiny muted">{tr("Check-out")}</span><b>{fmtDate(checkOut)}</b></button>
          </div>
          <MonthCalendar month={month} onMonth={setMonth} busy={booked} range={[checkIn, checkOut]} selected={picking === "in" ? checkIn : checkOut} onPick={pick} minDate={todayIso()} />
          <div className="row between"><span className="small"><Users size={15} /> {tr("Guests")}</span><Stepper label={tr("guests")} value={guests} min={1} max={h.max_guests} onChange={setGuests} /></div>
          {quoteError && <Alert kind="warn">{quoteError.message}</Alert>}
          {quote && (
            <div className="quote">
              <div className="row between small"><span>{euro(quote.nightly)} × {plural(nights, "{n} night", "{n} nights")}</span><span>{euro(quote.nightly * nights)}</span></div>
              {quote.cleaning_fee > 0 && <div className="row between small"><span>{tr("Cleaning")}</span><span>{euro(quote.cleaning_fee)}</span></div>}
              <div className="row between quote-total"><span>{tr("Total")}</span><b>{euro(quote.total)}</b></div>
              {!quote.available && <Alert kind="warn">{tr("Some of these nights are already booked — try other dates.")}</Alert>}
            </div>
          )}
          <button className="btn primary lg block" disabled={!quote || !quote.available} onClick={() => setOpen(true)}><CalendarDays size={18} /> {methods.some((m) => m.id !== "request") ? tr("Reserve") : tr("Request to book")}</button>
          {wa && <a className="btn whatsapp block" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> {tr("Ask on WhatsApp")}</a>}
          <p className="tiny muted center"><ShieldCheck size={12} /> {tr("Price calculated by our server — no hidden fees.")}</p>
        </aside>
      </div>

      <Sheet open={open} onClose={() => { setOpen(false); if (state.handoff) setState({ busy: false, error: "", pay: null }); }} title={state.pay ? tr("Secure payment") : state.handoff ? tr("Send your request") : tr("Your details")} variant="center">
        {state.handoff ? (
          <Handoff handoff={state.handoff} title={`${loc(h, "hotel_name")} · ${fmtDate(checkIn)} → ${fmtDate(checkOut)}`} />
        ) : state.pay ? (
          <Suspense fallback={<Skeleton h={220} />}>
            <PaymentStep publishableKey={cfg.payments.publishable_key} clientSecret={state.pay.secret} reference={state.pay.ref} amount={state.pay.amount} />
          </Suspense>
        ) : (
          <form className="stack" onSubmit={book} noValidate>
            <div className="quote-mini small">{loc(h, "hotel_name")} · {fmtDate(checkIn)} → {fmtDate(checkOut)} · {plural(guests, "{n} guest", "{n} guests")} · <b>{quote && euro(quote.total)}</b></div>
            <div className="form-grid two">
              <Field label={tr("Full name")} error={errors.guest_name}><input className="input" value={form.guest_name} onChange={up("guest_name")} autoComplete="name" maxLength={120} required /></Field>
              <Field label={tr("Email")} error={errors.guest_email}><input className="input" type="email" value={form.guest_email} onChange={up("guest_email")} autoComplete="email" maxLength={255} required /></Field>
            </div>
            <Field label={tr("Phone / WhatsApp (optional)")} error={errors.guest_phone}><input className="input" type="tel" value={form.guest_phone} onChange={up("guest_phone")} autoComplete="tel" maxLength={40} /></Field>
            <Field label={tr("Arrival time, requests… (optional)")} error={errors.notes}><textarea className="textarea" value={form.notes} onChange={up("notes")} maxLength={1500} /></Field>
            <input className="hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={up("website")} aria-hidden="true" />
            {payable && (
              <fieldset className="pay-methods">
                <legend className="label">{tr("How would you like to pay?")}</legend>
                {methods.map((m) => {
                  const Icon = { paypal: Wallet, card: CreditCard, bank: Landmark, request: Clock }[m.id] || CreditCard;
                  return (
                    <label key={m.id} className={`pay-method ${chosen.id === m.id ? "on" : ""}`}>
                      <input type="radio" name="payment_method" value={m.id} checked={chosen.id === m.id} onChange={() => setMethod(m.id)} />
                      <Icon size={20} aria-hidden="true" />
                      <span><b>{tr(m.label)}</b><span className="tiny muted">{tr(m.note)}</span></span>
                    </label>
                  );
                })}
                {quote && (
                  <p className="tiny muted pay-due">
                    {deposit < 100
                      ? rich("Pay a {percent}% deposit now (<b>{now}</b>); the rest ({later}) on arrival.", { b: (c) => <b>{c}</b> }, { percent: deposit, now: money(quote.total * deposit / 100), later: money(quote.total * (100 - deposit) / 100) })
                      : rich("You pay <b>{amount}</b> now.", { b: (c) => <b>{c}</b> }, { amount: money(quote.total) })}
                    {chosen.id === "paypal" && chosen.currency === "USD" && " PayPal charges the US-dollar equivalent at today's rate."}
                  </p>
                )}
              </fieldset>
            )}
            {errors.payment_method && <Alert kind="warn">{errors.payment_method}</Alert>}
            {state.error && !errors.payment_method && <Alert kind="error">{state.error}</Alert>}
            <button className="btn primary lg" disabled={state.busy}>{state.busy ? <span className="spinner" /> : null} {tr({ paypal: "Continue to PayPal", card: "Continue to payment", bank: "Get bank details", request: "Send booking request" }[chosen.id])}</button>
            {!payable && <p className="tiny muted">{partner ? `${partner.name} will confirm your dates by email. You pay them directly; nothing is charged now.` : "We'll confirm availability by email within a few hours. Payment is arranged directly with the host."}</p>}
            <p className="tiny muted">{rich("By booking you accept our <terms>booking and cancellation terms</terms>. See how we use your details in the <privacy>privacy policy</privacy>.", { terms: (c) => <Link to="/terms#cancel">{c}</Link>, privacy: (c) => <Link to="/privacy">{c}</Link> })}</p>
          </form>
        )}
      </Sheet>
    </div>
  );
}

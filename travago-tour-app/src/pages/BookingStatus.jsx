import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Clock, XCircle, Compass, CreditCard, UserRound } from "lucide-react";
import { api, post } from "../lib/api";
import { goToPayPal, money } from "../lib/format";
import { Alert, ErrorState, Skeleton } from "../components/ui";
import TicketCard from "../components/account/TicketCard";
import BankTransferPanel from "../components/account/BankTransferPanel";
import CancelPanel, { RefundNote } from "../components/stays/CancelPanel";
import { useAuth } from "../store/auth";
import Confetti from "../components/fx/Confetti";
import { rich, tr } from "../i18n";

const LABEL = {
  confirmed: { icon: Check, title: "You're booked!", tone: "ok", text: "Your stay is confirmed. We look forward to welcoming you in Sarandë." },
  requested: { icon: Clock, title: "Request received", tone: "sea", text: "The host will confirm availability by email shortly." },
  pending: { icon: Clock, title: "Awaiting payment", tone: "sun", text: "We're holding these dates for 30 minutes while payment completes." },
  transfer: { icon: Clock, title: "Almost there — send the transfer", tone: "sun", text: "Your dates are held while the bank transfer is on its way." },
  processing: { icon: Clock, title: "Payment in review", tone: "sun", text: "PayPal is checking the payment. We're holding your dates and will confirm by email." },
  expired: { icon: XCircle, title: "Hold expired", tone: "danger", text: "The payment wasn't completed in time, so the dates were released." },
  cancelled: { icon: XCircle, title: "Cancelled", tone: "danger", text: "This booking was cancelled." },
};

const labelFor = (b) => {
  if (b.status === "pending" && b.payment_status === "processing") return LABEL.processing;
  if (b.status === "pending" && b.payment_method === "bank") return LABEL.transfer;
  return LABEL[b.status] || LABEL.requested;
};

export function StatusCard({ status, label, children, reference }) {
  const s = label || LABEL[status] || LABEL.requested;
  return (
    <motion.div className={`status-card tone-${s.tone}`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <div className="success-icon"><s.icon size={30} /></div>
      <h1>{tr(s.title)}</h1>
      <p className="muted">{tr(s.text)}</p>
      {reference && <div className="ref-code">{reference}</div>}
      {children}
    </motion.div>
  );
}

export default function BookingStatus() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const user = useAuth((s) => s.user);
  const authAvailable = useAuth((s) => s.available);
  const [b, setB] = useState(null);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // Celebrate a confirmed stay once per browser session, not on every revisit.
  useEffect(() => {
    if (b?.status !== "confirmed") return;
    const key = `celebrated:${b.reference}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode: celebrate anyway */
    }
    setCelebrate(true);
  }, [b?.status, b?.reference]);

  const loadPayment = useCallback(async (booking) => {
    if (booking.status !== "pending" || booking.payment_method !== "bank") return setPayment(null);
    try {
      setPayment(await api(`/bookings/${reference}/payment`, { cacheable: false }));
    } catch {
      setPayment(null);
    }
  }, [reference]);

  useEffect(() => {
    let alive = true;
    let tries = 0;
    const fromStripe = params.has("payment_intent");
    const paypal = params.get("paypal");
    // Clear payment parameters from the address bar so a refresh or shared link doesn't repeat them.
    if (fromStripe || paypal) window.history.replaceState(null, "", `/booking/${reference}`);
    const load = async () => {
      try {
        let res = await api(`/bookings/${reference}`, { cacheable: false });
        if (paypal === "return" && res.payment_method === "paypal" && ["pending", "expired"].includes(res.status) && tries === 0) {
          // Back from PayPal: our server captures the payment and confirms — never the browser.
          res = await post(`/bookings/${reference}/paypal/capture`, {});
          if (res.payment_message) setNotice({ kind: "warn", text: res.payment_message });
        } else if (res.status === "pending" && res.payment_method === "card" && (fromStripe || tries > 0)) {
          res = await post(`/bookings/${reference}/sync`, {});
        }
        if (!alive) return;
        if (paypal === "cancel" && res.status === "pending") setNotice({ kind: "info", text: "You left PayPal before paying — nothing was charged. Your dates are still held for a little while." });
        setB(res);
        loadPayment(res);
        if (res.status === "pending" && fromStripe && tries++ < 5) setTimeout(load, 2500);
        else tries++;
      } catch (e) {
        if (!alive) return;
        // A failed capture still leaves a booking to show.
        if (paypal === "return" && e.status && e.status !== 404) {
          setNotice({ kind: "error", text: e.message });
          api(`/bookings/${reference}`, { cacheable: false }).then((res) => alive && setB(res)).catch(() => alive && setError(e));
        } else setError(e);
      }
    };
    load();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const payWithPayPal = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await post(`/bookings/${reference}/paypal/start`, {});
      goToPayPal(res.approve_url);
    } catch (e) {
      setNotice({ kind: "error", text: e.message });
      setBusy(false);
    }
  };

  if (error) return <div className="page container"><ErrorState error={error} /></div>;
  if (!b) return <div className="page container"><Skeleton h={360} r={26} /></div>;
  const host = b.hosted_by;
  const base = labelFor(b);
  // A partner business hosts this stay: say who confirms and who is paid.
  const label = host && b.status === "requested" ? { ...base, text: tr("{name} will confirm your dates by email. You pay them directly; nothing has been charged.", { name: host.name }) }
    : host && b.status === "confirmed" ? { ...base, text: tr("Your stay is confirmed by {name}. You pay them directly.", { name: host.name }) } : base;
  const canPayPal = b.status === "pending" && b.payment_method === "paypal" && b.payment_status !== "processing";
  const chargedOther = b.charge_currency && b.charge_currency !== "EUR" && b.charge_amount;
  return (
    <div className="page container narrow booking-status">
      <Confetti fire={celebrate} />
      <StatusCard label={label}>
        {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
      </StatusCard>
      <TicketCard booking={b}>
        <div className="row between wrap gap-sm small">
          <span>
            {b.payment_status === "paid" ? <><Check size={14} /> {tr("Paid {amount}", { amount: money(b.amount_due) })}</> : b.status === "pending" ? rich("To pay now: <b>{amount}</b>", { b: (c) => <b>{c}</b> }, { amount: money(b.amount_due) }) : b.status === "requested" ? tr("Pay on arrival") : null}
            {chargedOther && b.status !== "cancelled" && <span className="muted"> · charged as {money(b.charge_amount, b.charge_currency)}</span>}
          </span>
          {b.guest_email_masked && <span className="tiny muted">{tr("Confirmation to {email}", { email: b.guest_email_masked })}</span>}
        </div>
        {host && <p className="tiny muted" style={{ margin: "8px 0 0" }}>{rich("Hosted by <a>{name}</a>, an independent local business.", { a: (c) => <Link to={`/partners/${host.slug}`}>{c}</Link> }, { name: host.name })}</p>}
      </TicketCard>

      {canPayPal && (
        <div className="card pad stack">
          <h3 className="mb-0"><CreditCard size={18} /> {tr("Finish paying")}</h3>
          <p className="small muted">{tr("You'll pay on PayPal's own page — with your PayPal balance, or by card without an account — and come straight back here.")}</p>
          <button type="button" className="btn primary lg" onClick={payWithPayPal} disabled={busy}>{busy ? <span className="spinner" /> : null} {tr("Continue to PayPal")} · {money(b.charge_amount || b.amount_due, b.charge_currency || "EUR")}</button>
        </div>
      )}
      {payment?.open && payment.bank && <BankTransferPanel reference={reference} payment={payment} onUpdate={setB} />}
      <RefundNote booking={b} />
      <CancelPanel booking={b} signedIn={Boolean(user)} onCancelled={(done) => { setB(done); setPayment(null); setNotice({ kind: "info", text: tr("Your booking is cancelled. We've emailed you a confirmation.") }); }} />

      <p className="tiny muted center">{rich("Save your reference <b>{ref}</b> — you'll need it if you contact us.", { b: (c) => <b>{c}</b> }, { ref: b.reference })}</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link to="/plan" className="btn primary"><Compass size={16} /> {tr("Plan your days")}</Link>
        {authAvailable && (user
          ? <Link to="/account" className="btn"><UserRound size={16} /> {tr("My bookings")}</Link>
          : <Link to={`/signup?next=${encodeURIComponent(`/booking/${reference}`)}`} className="btn"><UserRound size={16} /> {tr("Create an account to keep it")}</Link>)}
        <Link to="/stays" className="btn">{tr("Back to stays")}</Link>
      </div>
    </div>
  );
}

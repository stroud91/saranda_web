import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Clock, XCircle, CalendarDays, Users, Compass } from "lucide-react";
import { api, post } from "../lib/api";
import { euro, fmtDate } from "../lib/format";
import { ErrorState, Skeleton } from "../components/ui";

const LABEL = {
  confirmed: { icon: Check, title: "You're booked!", tone: "ok", text: "Your stay is confirmed. A receipt is on its way to your inbox." },
  requested: { icon: Clock, title: "Request received", tone: "sea", text: "The host will confirm availability by email shortly." },
  pending: { icon: Clock, title: "Awaiting payment", tone: "sun", text: "We're holding these dates for 30 minutes while payment completes." },
  expired: { icon: XCircle, title: "Hold expired", tone: "danger", text: "The payment wasn't completed in time, so the dates were released." },
  cancelled: { icon: XCircle, title: "Cancelled", tone: "danger", text: "This booking was cancelled." },
};

export function StatusCard({ status, children, reference }) {
  const s = LABEL[status] || LABEL.requested;
  return (
    <motion.div className={`status-card tone-${s.tone}`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <div className="success-icon"><s.icon size={30} /></div>
      <h1>{s.title}</h1>
      <p className="muted">{s.text}</p>
      {reference && <div className="ref-code">{reference}</div>}
      {children}
    </motion.div>
  );
}

export default function BookingStatus() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const [b, setB] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    let tries = 0;
    const fromStripe = params.has("payment_intent");
    const load = async () => {
      try {
        let res = await api(`/bookings/${reference}`, { cacheable: false });
        if (res.status === "pending" && (fromStripe || tries > 0)) res = await post(`/bookings/${reference}/sync`, {});
        if (!alive) return;
        setB(res);
        if (res.status === "pending" && fromStripe && tries++ < 5) setTimeout(load, 2500);
      } catch (e) {
        if (alive) setError(e);
      }
    };
    load();
    return () => { alive = false; };
  }, [reference, params]);

  if (error) return <div className="page container"><ErrorState error={error} /></div>;
  if (!b) return <div className="page container"><Skeleton h={360} r={26} /></div>;
  return (
    <div className="page container narrow">
      <StatusCard status={b.status} reference={b.reference}>
        <div className="status-facts">
          <span><b>{b.hotel_name}</b></span>
          <span><CalendarDays size={15} /> {fmtDate(b.start_date)} → {fmtDate(b.end_date)} · {b.nights} night{b.nights === 1 ? "" : "s"}</span>
          <span><Users size={15} /> {b.guest_count} guest{b.guest_count === 1 ? "" : "s"}</span>
          <span>Total <b>{euro(b.total_cost)}</b> · {b.payment_status === "paid" ? "Paid" : "Not yet paid"}</span>
          {b.guest_email_masked && <span className="tiny muted">Confirmation to {b.guest_email_masked}</span>}
        </div>
        <p className="tiny muted">Save this reference — you'll need it if you contact us.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link to="/plan" className="btn primary"><Compass size={16} /> Plan your days</Link>
          <Link to="/stays" className="btn">Back to stays</Link>
        </div>
      </StatusCard>
    </div>
  );
}

import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Clock, XCircle } from "lucide-react";
import { useApi } from "../lib/useApi";
import { euro, fmtDate } from "../lib/format";
import { ErrorState, Skeleton } from "../components/ui";

const S = {
  requested: { icon: Clock, title: "Waiting for the guide", text: "Your guide will reply by email to confirm." },
  accepted: { icon: Check, title: "Confirmed by your guide", text: "See you on the day! Your guide will share meeting details." },
  declined: { icon: XCircle, title: "Not available", text: "The guide can't make this date — try another guide or day." },
  cancelled: { icon: XCircle, title: "Cancelled", text: "This request was cancelled." },
};

export default function GuideRequestStatus() {
  const { reference } = useParams();
  const { data: r, error } = useApi(`/guides/requests/${reference}`);
  if (error) return <div className="page container"><ErrorState error={error} /></div>;
  if (!r) return <div className="page container"><Skeleton h={320} r={26} /></div>;
  const s = S[r.status] || S.requested;
  return (
    <div className="page container narrow">
      <motion.div className="status-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="success-icon"><s.icon size={30} /></div>
        <h1>{s.title}</h1>
        <p className="muted">{s.text}</p>
        <div className="ref-code">{r.reference}</div>
        <div className="status-facts">
          <span>Guide: <Link to={`/guides/${r.guide.slug}`}><b>{r.guide.name}</b></Link></span>
          <span>{fmtDate(r.tour_date, { weekday: "long", day: "numeric", month: "long" })} · {r.duration_label}</span>
          <span>{r.group_size} people{r.language ? ` · ${r.language}` : ""} · quoted <b>{euro(r.quoted_price)}</b></span>
        </div>
      </motion.div>
    </div>
  );
}

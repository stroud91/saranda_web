import { Link } from "react-router-dom";
import { BedDouble, Moon, Users } from "lucide-react";
import { hash, money } from "../../lib/format";

const STATUS = {
  confirmed: ["Confirmed", "ok"],
  requested: ["Awaiting host", "sea"],
  pending: ["Awaiting payment", "sun"],
  expired: ["Hold expired", "danger"],
  cancelled: ["Cancelled", "danger"],
};

const day = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit" });
const mon = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
const dow = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" });

/** Decorative barcode drawn from the reference (not machine-readable; the reference itself is what matters). */
function Barcode({ seed }) {
  let h = hash(seed);
  const bars = Array.from({ length: 34 }, () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return 1 + (h >>> 29) % 3;
  });
  let x = 0;
  return (
    <svg className="ticket-barcode" viewBox="0 0 120 26" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w} height="26" /> : null;
        x += w + 0.6;
        return rect;
      })}
    </svg>
  );
}

/** A stay shown as a boarding pass: dates on the left, reference and status on the tear-off stub. */
export default function TicketCard({ booking: b, to, children }) {
  const paying = b.status === "pending" && b.payment_method === "bank" ? ["Awaiting transfer", "sun"] : null;
  const [label, tone] = paying || (b.payment_status === "processing" ? ["Payment in review", "sun"] : STATUS[b.status]) || STATUS.requested;
  const body = (
    <>
      <div className="ticket-main">
        <div className="ticket-eyebrow"><BedDouble size={13} /> Meg'Rooms · Sarandë, Albania</div>
        <div className="ticket-title">{b.hotel_name}</div>
        <div className="ticket-dates">
          <div><span className="tiny">Check-in · {dow(b.start_date)}</span><b>{day(b.start_date)}</b><span>{mon(b.start_date)}</span></div>
          <div className="ticket-line" aria-hidden="true"><i /><Moon size={14} /><span>{b.nights}</span><i /></div>
          <div><span className="tiny">Check-out · {dow(b.end_date)}</span><b>{day(b.end_date)}</b><span>{mon(b.end_date)}</span></div>
        </div>
        <div className="ticket-meta small">
          <span><Users size={14} /> {b.guest_count} guest{b.guest_count === 1 ? "" : "s"}</span>
          <span>Total <b>{money(b.total_cost)}</b></span>
          {b.balance_on_arrival > 0 && <span>{money(b.balance_on_arrival)} on arrival</span>}
        </div>
      </div>
      <div className="ticket-stub">
        <span className={`badge ${tone === "ok" ? "olive" : tone === "danger" ? "terracotta" : tone}`}>{label}</span>
        <div className="ticket-ref"><span className="tiny">Reference</span><b>{b.reference}</b></div>
        <Barcode seed={b.reference} />
      </div>
    </>
  );
  return (
    <div className={`ticket tone-${tone} ${to ? "tilt" : ""}`}>
      {to ? <Link to={to} className="ticket-body" aria-label={`Booking ${b.reference}, ${label}`}>{body}</Link> : <div className="ticket-body">{body}</div>}
      {children && <div className="ticket-extra">{children}</div>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Ban, Undo2 } from "lucide-react";
import { api, invalidate, post } from "../../lib/api";
import { money } from "../../lib/format";
import { Alert, Field } from "../ui";
import { plural, tr } from "../../i18n";

/** What the guest gets back if they cancel now, in one sentence. */
function outcome(q, host) {
  if (q.partner) return tr("Nothing was paid through this website. If you paid {name} directly, ask them about a refund.", { name: host?.name || "" });
  if (!q.paid) return tr("Nothing has been charged, so cancelling is free.");
  if (q.refund_percent === 100) return tr("You get back everything you paid: {amount}.", { amount: money(q.refund_amount) });
  if (q.refund_percent > 0) return tr("You get back {percent}% of what you paid: {amount}.", { percent: q.refund_percent, amount: money(q.refund_amount) });
  return tr("It is too close to check-in for a refund under the booking terms: nothing of the {amount} you paid comes back.", { amount: money(q.paid) });
}

/**
 * Lets a guest cancel their own booking up to the day before check-in. The amount
 * shown comes from the server, which applies the same rules when the button is pressed.
 * Guests who aren't signed in confirm with the booking's email address.
 */
export default function CancelPanel({ booking, signedIn, onCancelled }) {
  const [quote, setQuote] = useState(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ busy: false, error: "", field: "" });

  useEffect(() => {
    if (!booking.can_cancel) return;
    api(`/bookings/${booking.reference}/cancellation`, { cacheable: false }).then(setQuote).catch(() => setQuote(null));
  }, [booking.reference, booking.can_cancel]);

  if (!booking.can_cancel || !quote || !quote.can_cancel) return null;
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", field: "" });
    try {
      const done = await post(`/bookings/${booking.reference}/cancel`, signedIn && !email ? {} : { email: email.trim() });
      invalidate("/hotels");
      onCancelled(done);
    } catch (err) {
      // A signed-in account that isn't the booking's guest is asked for the address too.
      setState({ busy: false, error: err.message, field: err.fields?.email || "" });
    }
  };
  const askEmail = !signedIn || Boolean(state.field);
  return (
    <div className="card pad stack cancel-panel">
      {!open ? (
        <div className="row between wrap gap-sm">
          <span className="small muted"><Undo2 size={14} /> {tr("Plans changed? You can cancel online until the day before check-in.")}</span>
          <button type="button" className="btn sm" onClick={() => setOpen(true)}><Ban size={14} /> {tr("Cancel booking")}</button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <h3 className="mb-0"><Ban size={18} /> {tr("Cancel this booking?")}</h3>
          <Alert kind={quote.paid && quote.refund_percent < 100 && !quote.partner ? "warn" : "info"}>
            <b>{outcome(quote, booking.hosted_by)}</b>{" "}
            {quote.refund_amount > 0 && tr("We send it back the way you paid, within 14 days.")}{" "}
            <span className="muted">{plural(quote.days_before, "Check-in is in {n} day.", "Check-in is in {n} days.")}</span>
          </Alert>
          {askEmail && (
            <Field label={tr("Email address used for the booking")} error={state.field && tr("That doesn't match this booking.")} hint={tr("So that only you can cancel it.")}>
              <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          )}
          {state.error && !state.field && <Alert kind="error">{state.error}</Alert>}
          <div className="row gap-sm wrap">
            <button className="btn danger" disabled={state.busy || (askEmail && !email.trim())}>{state.busy ? <span className="spinner" /> : <Ban size={16} />} {tr("Yes, cancel my booking")}</button>
            <button type="button" className="btn" disabled={state.busy} onClick={() => setOpen(false)}>{tr("Keep my booking")}</button>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>{tr("This can't be undone. The dates become available to other guests straight away.")}</p>
        </form>
      )}
    </div>
  );
}

/** After a cancellation: what happens with the money. */
export function RefundNote({ booking: b }) {
  if (b.status !== "cancelled" || !b.refund_status) return null;
  if (b.refund_status === "due") return <Alert kind="info">{tr("A refund of {amount} is on its way back to you. We send it the way you paid, within 14 days, and email you when it's sent.", { amount: money(b.refund_amount) })}</Alert>;
  if (b.refund_status === "refunded") return <Alert kind="ok">{tr("Your refund of {amount} has been sent. It can take a few working days to reach your account.", { amount: money(b.refund_amount) })}</Alert>;
  return null;
}

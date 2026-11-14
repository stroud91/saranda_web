import { useState } from "react";
import { Check, Copy, Landmark, Send } from "lucide-react";
import { post } from "../../lib/api";
import { money } from "../../lib/format";
import { Alert } from "../ui";
import { tr } from "../../i18n";

function Row({ label, value, copyValue }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue || value);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* the value stays selectable */
    }
  };
  return (
    <div className="bank-row">
      <span className="tiny muted">{label}</span>
      <b>{value}</b>
      <button type="button" className="icon-btn sm" onClick={copy} aria-label={`Copy ${label}`}>{done ? <Check size={15} /> : <Copy size={15} />}</button>
    </div>
  );
}

/** Bank details for a booking that is waiting for a transfer, with a SEPA QR code. */
export default function BankTransferPanel({ reference, payment, onUpdate }) {
  const { bank } = payment;
  const [state, setState] = useState({ busy: false, error: "", claimed: payment.claimed });
  const sent = async () => {
    setState((s) => ({ ...s, busy: true, error: "" }));
    try {
      const b = await post(`/bookings/${reference}/transfer-sent`, {});
      setState({ busy: false, error: "", claimed: true });
      onUpdate?.(b);
    } catch (e) {
      setState((s) => ({ ...s, busy: false, error: e.message }));
    }
  };
  return (
    <div className="bank-panel">
      <div className="row gap-sm"><Landmark size={18} /><h3 className="mb-0">{tr("Pay by bank transfer")}</h3></div>
      <p className="small muted">
        Send exactly <b>{money(bank.amount)}</b> and put the reference in the payment description so we can match it.
        From a European bank this is a normal SEPA transfer, usually there the next working day.
      </p>
      <div className="bank-grid">
        <div className="bank-rows">
          <Row label={tr("Beneficiary")} value={bank.beneficiary} />
          <Row label={tr("IBAN")} value={bank.iban} copyValue={bank.iban.replace(/\s/g, "")} />
          {bank.bic && <Row label={tr("BIC / SWIFT")} value={bank.bic} />}
          {bank.bank && <Row label={tr("Bank")} value={bank.bank} />}
          <Row label={tr("Amount")} value={money(bank.amount)} copyValue={bank.amount.toFixed(2)} />
          <Row label={tr("Payment reference")} value={bank.reference} />
        </div>
        {bank.qr && (
          <figure className="bank-qr">
            <img src={bank.qr} alt={tr("SEPA payment QR code with the account, amount and reference")} width="170" height="170" />
            <figcaption className="tiny muted">Scan with your banking app<br />(SEPA QR)</figcaption>
          </figure>
        )}
      </div>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.claimed ? (
        <Alert kind="ok">{tr("Thanks — we're keeping your dates while the transfer arrives, and we'll confirm by email as soon as it lands.")}</Alert>
      ) : (
        <>
          <button type="button" className="btn primary" onClick={sent} disabled={state.busy}>{state.busy ? <span className="spinner" /> : <Send size={16} />} {tr("I've sent the transfer")}</button>
          <p className="tiny muted">Your dates are held for {bank.hold_hours} hours. Tell us once you've paid and we'll keep them until the money arrives.</p>
        </>
      )}
    </div>
  );
}

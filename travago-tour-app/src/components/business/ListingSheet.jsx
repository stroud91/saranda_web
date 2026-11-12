import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { KINDS, blank, partnerPost, partnerPut, toBody, toForm } from "../../lib/partners";
import { Alert, Sheet, toast } from "../ui";
import FormFields from "./FormFields";

/** Add or edit one apartment, rental or activity. `target` is { kind, item? } or null when closed. */
export default function ListingSheet({ target, options, onClose, onSaved }) {
  const kind = target ? KINDS[target.kind] : null;
  const item = target?.item;
  const [form, setForm] = useState({});
  const [state, setState] = useState({ busy: false, error: "", fields: {} });

  useEffect(() => {
    if (!target) return;
    const fields = KINDS[target.kind].fields;
    setForm(target.item ? toForm(fields, target.item) : blank(fields));
    setState({ busy: false, error: "", fields: {} });
  }, [target]);

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", fields: {} });
    try {
      const body = toBody(kind.fields, form);
      const saved = item
        ? await partnerPut(`/partner/listings/${target.kind}/${item.id}`, body)
        : await partnerPost(`/partner/listings/${target.kind}`, body);
      toast(!item ? "Sent for review" : saved.has_pending_changes ? "Saved — text changes sent for review" : "Saved");
      onSaved(target.kind, saved);
      onClose();
    } catch (err) {
      setState({ busy: false, error: err.message, fields: err.fields || {} });
    }
  };

  return (
    <Sheet open={Boolean(target)} onClose={onClose} title={kind ? (item ? `Edit ${kind.label.toLowerCase()}` : kind.add) : ""}>
      {kind && (
        <form className="stack" onSubmit={submit} noValidate>
          <FormFields fields={kind.fields} form={form} errors={state.fields} onChange={setForm} options={options} />
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <p className="tiny muted">
            {item && item.review_status === "approved"
              ? "Prices and numbers change straight away. Changes to names and descriptions are reviewed first; the current version stays live meanwhile."
              : "We review every listing before guests can see it. Photos aren't supported yet, so describe it well."}
          </p>
          <button className="btn primary lg" disabled={state.busy}>{state.busy ? <span className="spinner" /> : <Save size={18} />} {item ? "Save" : "Send for review"}</button>
        </form>
      )}
    </Sheet>
  );
}

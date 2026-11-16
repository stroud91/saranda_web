import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { KINDS, blank, partnerPost, partnerPut, toBody, toForm } from "../../lib/partners";
import { Alert, Sheet, toast } from "../ui";
import FormFields from "./FormFields";
import { tr } from "../../i18n";

/**
 * Add or edit one listing. `target` is { kind, item? } or null when closed.
 * A business owner's changes go through review; the host's own (`host`) are live at once.
 */
export default function ListingSheet({ target, options, onClose, onSaved, kinds = KINDS, base = "/partner/listings", host = false }) {
  const kind = target ? kinds[target.kind] : null;
  const item = target?.item;
  const [form, setForm] = useState({});
  const [state, setState] = useState({ busy: false, error: "", fields: {} });

  useEffect(() => {
    if (!target) return;
    const fields = kinds[target.kind].fields;
    setForm(target.item ? toForm(fields, target.item) : blank(fields));
    setState({ busy: false, error: "", fields: {} });
  }, [target, kinds]);

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", fields: {} });
    try {
      const body = toBody(kind.fields, form);
      const saved = item ? await partnerPut(`${base}/${target.kind}/${item.id}`, body) : await partnerPost(`${base}/${target.kind}`, body);
      toast(host ? tr("Saved") : !item ? tr("Sent for review") : saved.has_pending_changes ? tr("Saved — changes to text and new photos sent for review") : tr("Saved"));
      onSaved(target.kind, saved);
      onClose();
    } catch (err) {
      setState({ busy: false, error: err.message, fields: err.fields || {} });
    }
  };

  return (
    <Sheet open={Boolean(target)} onClose={onClose} title={kind ? (item ? `${tr("Edit")} · ${item[kind.nameField]}` : tr(kind.add)) : ""}>
      {kind && (
        <form className="stack" onSubmit={submit} noValidate>
          <FormFields fields={kind.fields} form={form} errors={state.fields} onChange={setForm} options={options} scope={host ? "house" : "business"} />
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <p className="tiny muted">
            {host ? tr("Guests see your changes as soon as you save.")
              : item && item.review_status === "approved"
                ? tr("Prices and numbers change straight away, and so does removing or reordering photos. New photos and changes to names and descriptions are reviewed first; the current version stays live meanwhile.")
                : tr("We review every listing before guests can see it. Good photos and a clear description get it approved faster.")}
          </p>
          <button className="btn primary lg" disabled={state.busy}>{state.busy ? <span className="spinner" /> : <Save size={18} />} {item || host ? tr("Save") : tr("Send for review")}</button>
        </form>
      )}
    </Sheet>
  );
}

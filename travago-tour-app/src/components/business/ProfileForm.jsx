import { useState } from "react";
import { Save, Send } from "lucide-react";
import { PROFILE_FIELDS, blank, partnerPost, partnerPut, toBody, toForm } from "../../lib/partners";
import { Alert, toast } from "../ui";
import FormFields from "./FormFields";
import { tr } from "../../i18n";

/** Create the business profile, or edit it. Text changes on a live profile are reviewed before guests see them. */
export default function ProfileForm({ business, onSaved }) {
  const [form, setForm] = useState(() => (business ? toForm(PROFILE_FIELDS, business) : blank(PROFILE_FIELDS)));
  const [state, setState] = useState({ busy: false, error: "", fields: {} });
  const live = business?.status === "approved";
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", fields: {} });
    try {
      const body = toBody(PROFILE_FIELDS, form);
      const saved = business ? await partnerPut("/partner/business", body) : await partnerPost("/partner/business", body);
      setState({ busy: false, error: "", fields: {} });
      toast(!business ? tr("Sent for review") : saved.has_pending_changes ? tr("Saved — changes sent for review") : tr("Saved"));
      onSaved(saved);
    } catch (err) {
      setState({ busy: false, error: err.message, fields: err.fields || {} });
    }
  };
  return (
    <form className="card pad stack" onSubmit={submit} noValidate>
      <FormFields fields={PROFILE_FIELDS} form={form} errors={state.fields} onChange={setForm} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <div className="row between">
        <span className="tiny muted biz-form-note">
          {live ? tr("Your current page stays live while we review changes.") : tr("We review every business before it appears on the site, usually within a day or two.")}
        </span>
        <button className="btn primary" disabled={state.busy}>{state.busy ? <span className="spinner" /> : business ? <Save size={16} /> : <Send size={16} />} {business ? tr("Save changes") : tr("Send for review")}</button>
      </div>
    </form>
  );
}

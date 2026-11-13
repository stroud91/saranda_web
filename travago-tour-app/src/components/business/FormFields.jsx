import { Field } from "../ui";
import { useDestinations } from "../../lib/useDestinations";
import { tr } from "../../i18n";

/** Renders the inputs for a list of field definitions (see lib/partners.js). */
export default function FormFields({ fields, form, errors = {}, onChange, options = {} }) {
  const { list } = useDestinations();
  // `onChange` is a state setter; the functional form keeps every field when autofill sets several at once.
  const set = (name) => (e) => { const v = e.target.value; onChange((f) => ({ ...f, [name]: v })); };
  return (
    <div className="biz-fields">
      {fields.map((f) => {
        const common = { value: form[f.name] ?? "", onChange: set(f.name), required: f.required, maxLength: f.max };
        let input;
        if (f.type === "textarea") input = <textarea className="textarea" {...common} />;
        else if (f.type === "select") {
          const choices = Array.isArray(f.options) ? f.options : options[f.options] || [];
          input = (
            <select className="select" value={common.value} onChange={common.onChange} required={f.required}>
              <option value="">{f.required ? tr("Choose…") : f.optional ? tr(f.optional) : "—"}</option>
              {choices.map((o) => <option key={o} value={o}>{tr(o[0].toUpperCase() + o.slice(1))}</option>)}
            </select>
          );
        } else if (f.type === "destination") {
          input = (
            <select className="select" value={common.value} onChange={common.onChange}>
              <option value="">{tr("Not near a listed place")}</option>
              {list.filter((d) => d.category !== "hub").map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
            </select>
          );
        } else if (f.type === "number") {
          input = <input className="input" type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step || "any"} value={common.value} onChange={common.onChange} required={f.required} />;
        } else {
          input = <input className="input" type={f.type === "tags" ? "text" : f.type || "text"} placeholder={tr(f.placeholder)} autoComplete="off" {...common} maxLength={f.type === "tags" ? 2000 : f.max} />;
        }
        return (
          <div key={f.name} className={f.half ? "half" : f.third ? "third" : "full"}>
            <Field label={f.required ? tr(f.label) : tr("{label} (optional)", { label: tr(f.label) })} error={errors[f.name]} hint={tr(f.hint)}>{input}</Field>
          </div>
        );
      })}
    </div>
  );
}

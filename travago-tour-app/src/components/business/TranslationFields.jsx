import { useState } from "react";
import { Languages } from "lucide-react";
import { LANGS, tr } from "../../i18n";

/**
 * The same text in other languages. `of` lists which fields can be translated
 * (name, description…). Guests see a translation only when one was written;
 * otherwise they see the original. `value` is { sq: { description: "…" }, … }.
 */
export default function TranslationFields({ value = {}, of, onChange, error }) {
  const [lang, setLang] = useState(LANGS[0].code);
  const filled = (code) => of.some((f) => (value[code]?.[f.name] || "").trim());
  const set = (name) => (e) => { const v = e.target.value; onChange((all) => ({ ...all, [lang]: { ...(all[lang] || {}), [name]: v } })); };
  return (
    <div className={`field translations ${error ? "error" : ""}`}>
      <span className="label"><Languages size={15} /> {tr("Other languages (optional)")}</span>
      <span className="tiny muted">{tr("Write your text again in any language you like. Guests using that language see it; everyone else sees the text above.")}</span>
      <div className="chips" role="tablist" aria-label={tr("Language")}>
        {LANGS.map((l) => (
          <button type="button" key={l.code} role="tab" aria-selected={lang === l.code} className={`chip sm ${lang === l.code ? "on" : ""}`} onClick={() => setLang(l.code)}>
            {l.name}{filled(l.code) ? " ✓" : ""}
          </button>
        ))}
      </div>
      {of.map((f) => {
        const common = { value: value[lang]?.[f.name] || "", onChange: set(f.name), maxLength: f.max, lang, "aria-label": `${tr(f.label)} (${LANGS.find((l) => l.code === lang).name})` };
        return (
          <div key={f.name} className="stack" style={{ "--gap": "4px" }}>
            <span className="tiny muted">{tr(f.label)}</span>
            {f.type === "textarea" ? <textarea className="textarea" {...common} /> : <input className="input" autoComplete="off" {...common} />}
          </div>
        );
      })}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Rough strength estimate: length matters most, then variety. Not a security control —
 *  the server enforces the real rules (length, common and breached passwords). */
export function strength(pw) {
  if (!pw) return { score: 0, label: "" };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const unique = new Set(pw).size;
  let bits = pw.length * (classes >= 3 ? 4.6 : classes === 2 ? 3.6 : 2.6);
  if (unique < pw.length / 2) bits *= 0.6;
  const score = pw.length < 10 ? Math.min(1, Math.floor(bits / 20)) : bits < 45 ? 2 : bits < 65 ? 3 : 4;
  return { score, label: ["", "Too short", "Okay", "Good", "Strong"][Math.max(1, score)] };
}

export default function PasswordField({ label = "Password", value, onChange, error, autoComplete = "current-password", meter = false, hint }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const s = meter ? strength(value) : null;
  const onKey = (e) => setCaps(Boolean(e.getModifierState?.("CapsLock")));
  return (
    <div className={`field ${error ? "error" : ""}`}>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id} className="input" type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete} maxLength={128} required onKeyUp={onKey} onKeyDown={onKey} onBlur={() => setCaps(false)}
          aria-invalid={Boolean(error)} aria-describedby={`${id}-help`} spellCheck={false} autoCapitalize="none"
        />
        <button type="button" className="icon-btn sm pw-toggle" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {meter && value && (
        <div className={`pw-meter s${s.score}`} aria-hidden="true"><i /><i /><i /><i /><span>{s.label}</span></div>
      )}
      <div id={`${id}-help`}>
        {caps && <span className="tiny pw-caps">Caps Lock is on</span>}
        {error ? <span className="field-error">{error}</span> : hint && <span className="tiny muted">{hint}</span>}
      </div>
    </div>
  );
}

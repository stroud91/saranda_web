import { useState } from "react";
import { Copy, Download, KeyRound, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { post } from "../../lib/api";
import { Alert, Field, toast } from "../ui";
import { rich, tr } from "../../i18n";

/** The 6-digit code field (also accepts a recovery code where `recovery` is allowed). */
export function CodeInput({ value, onChange, recovery = false, autoFocus = false, error }) {
  return (
    <Field label={recovery ? tr("Code from your app, or a recovery code") : tr("6-digit code from your app")} error={error}>
      <input className="input code-input" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="one-time-code"
        inputMode={recovery ? "text" : "numeric"} maxLength={recovery ? 20 : 7} placeholder={recovery ? "123456" : "123 456"} autoFocus={autoFocus} required />
    </Field>
  );
}

function Codes({ codes }) {
  const text = codes.join("\n");
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast(tr("Copied")); } catch { window.prompt(tr("Copy these codes"), codes.join(" ")); } };
  const save = () => {
    const url = URL.createObjectURL(new Blob([`Saranda Companion — recovery codes\n${tr("Each code works once.")}\n\n${text}\n`], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "saranda-recovery-codes.txt" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <div className="stack">
      <Alert kind="warn"><b>{tr("Save these recovery codes now.")}</b> {tr("If you lose your phone, each one lets you sign in once. We can't show them again.")}</Alert>
      <ul className="recovery-codes">{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
      <div className="row gap-sm wrap">
        <button type="button" className="btn sm" onClick={copy}><Copy size={14} /> {tr("Copy")}</button>
        <button type="button" className="btn sm" onClick={save}><Download size={14} /> {tr("Download")}</button>
      </div>
    </div>
  );
}

/**
 * Two-step sign-in in the account's Security tab: switch it on (scan, confirm a
 * code, save the recovery codes), make new recovery codes, or switch it off.
 */
export default function TwoStep({ user, onUser }) {
  const [step, setStep] = useState("idle"); // idle | password | scan | codes | off | renew
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState(null);
  const [state, setState] = useState({ busy: false, error: "", fields: {} });
  const reset = () => { setStep("idle"); setPassword(""); setCode(""); setSetup(null); setState({ busy: false, error: "", fields: {} }); };
  const run = async (fn) => {
    setState({ busy: true, error: "", fields: {} });
    try {
      await fn();
      setState({ busy: false, error: "", fields: {} });
    } catch (e) {
      setState({ busy: false, error: e.fields && Object.keys(e.fields).length ? "" : e.message, fields: e.fields || {} });
    }
  };
  const start = (e) => { e.preventDefault(); run(async () => { setSetup(await post("/auth/two-step/setup", { password })); setPassword(""); setStep("scan"); }); };
  const confirm = (e) => { e.preventDefault(); run(async () => { const res = await post("/auth/two-step/enable", { code }); onUser(res.user); setCodes(res.recovery_codes); setCode(""); setSetup(null); setStep("codes"); }); };
  const renew = (e) => { e.preventDefault(); run(async () => { const res = await post("/auth/two-step/recovery-codes", { password }); setCodes(res.recovery_codes); setPassword(""); setStep("codes"); }); };
  const turnOff = (e) => { e.preventDefault(); run(async () => { const res = await post("/auth/two-step/disable", { password, code }); onUser(res.user); toast(tr("Two-step sign-in is off")); reset(); }); };

  const passwordField = (
    <Field label={tr("Your password")} error={state.fields.password && tr("Password is incorrect")}>
      <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
    </Field>
  );
  return (
    <div className="card pad stack two-step">
      <div className="row between wrap gap-sm">
        <h2 className="h3"><Smartphone size={18} /> {tr("Two-step sign-in")}</h2>
        <span className={`badge ${user.two_step ? "olive" : ""}`}>{user.two_step ? tr("On") : tr("Off")}</span>
      </div>
      {step === "idle" && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {user.two_step
              ? tr("Signing in needs your password and a code from your authenticator app.")
              : tr("Add a second step: after your password, sign-in asks for a 6-digit code from an authenticator app on your phone. A stolen password is then not enough.")}
            {user.is_admin && !user.two_step ? ` ${tr("Recommended for host accounts.")}` : ""}
          </p>
          <div className="row gap-sm wrap">
            {user.two_step ? (
              <>
                <button type="button" className="btn sm" onClick={() => setStep("renew")}><KeyRound size={14} /> {tr("New recovery codes")}</button>
                <button type="button" className="btn sm danger-outline" onClick={() => setStep("off")}><ShieldOff size={14} /> {tr("Switch off")}</button>
              </>
            ) : <button type="button" className="btn sm primary" onClick={() => setStep("password")}><ShieldCheck size={14} /> {tr("Set it up")}</button>}
          </div>
        </>
      )}
      {step === "password" && (
        <form className="stack" onSubmit={start} noValidate>
          <p className="small muted" style={{ margin: 0 }}>{tr("You need an authenticator app such as Google Authenticator, Microsoft Authenticator, 1Password or Aegis. Confirm your password to begin.")}</p>
          {passwordField}
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <div className="row gap-sm"><button className="btn primary sm" disabled={state.busy || !password}>{tr("Continue")}</button><button type="button" className="btn sm" onClick={reset}>{tr("Cancel")}</button></div>
        </form>
      )}
      {step === "scan" && setup && (
        <form className="stack" onSubmit={confirm} noValidate>
          <p className="small" style={{ margin: 0 }}>{rich("<b>1.</b> Open your authenticator app and scan this code.", { b: (c) => <b>{c}</b> })}</p>
          {setup.qr && <img className="two-step-qr" src={setup.qr} alt={tr("QR code for your authenticator app")} width="200" height="200" />}
          <p className="tiny muted" style={{ margin: 0 }}>{tr("Can't scan? Type this key into the app instead:")} <code className="two-step-key">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code></p>
          <p className="small" style={{ margin: 0 }}>{rich("<b>2.</b> Type the 6-digit code the app shows.", { b: (c) => <b>{c}</b> })}</p>
          <CodeInput value={code} onChange={setCode} autoFocus error={state.fields.code && tr("That code isn't right. Check the app and try again.")} />
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <div className="row gap-sm"><button className="btn primary sm" disabled={state.busy || code.replace(/\D/g, "").length !== 6}>{tr("Switch on")}</button><button type="button" className="btn sm" onClick={reset}>{tr("Cancel")}</button></div>
        </form>
      )}
      {step === "codes" && codes && (
        <>
          <Codes codes={codes} />
          <button type="button" className="btn primary sm" style={{ justifySelf: "start" }} onClick={() => { setCodes(null); reset(); }}>{tr("I've saved them")}</button>
        </>
      )}
      {step === "renew" && (
        <form className="stack" onSubmit={renew} noValidate>
          <p className="small muted" style={{ margin: 0 }}>{tr("This makes ten new recovery codes. The old ones stop working.")}</p>
          {passwordField}
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <div className="row gap-sm"><button className="btn primary sm" disabled={state.busy || !password}>{tr("Make new codes")}</button><button type="button" className="btn sm" onClick={reset}>{tr("Cancel")}</button></div>
        </form>
      )}
      {step === "off" && (
        <form className="stack" onSubmit={turnOff} noValidate>
          <p className="small muted" style={{ margin: 0 }}>{tr("Signing in will then need only your password.")}</p>
          {passwordField}
          <CodeInput value={code} onChange={setCode} recovery error={state.fields.code && tr("That code isn't right.")} />
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <div className="row gap-sm"><button className="btn danger sm" disabled={state.busy || !password || !code}>{tr("Switch off two-step sign-in")}</button><button type="button" className="btn sm" onClick={reset}>{tr("Cancel")}</button></div>
        </form>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, KeyRound, LogIn, MailCheck, UserPlus } from "lucide-react";
import { post } from "../lib/api";
import { safeNext, useAuth } from "../store/auth";
import AuthShell from "../components/auth/AuthShell";
import PasswordField from "../components/auth/PasswordField";
import { CodeInput } from "../components/account/TwoStep";
import { Alert, Field, Skeleton } from "../components/ui";
import { rich, tr } from "../i18n";

// Only focus the first field on desktop: on phones it would open the keyboard and scroll the page.
const FINE_POINTER = typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const PW_HINT = "At least 10 characters. A short sentence is easy to remember and hard to guess.";

/** Shared behaviour: wait for the session check, send signed-in guests onwards, hide on static hosting. */
function useAuthPage(title) {
  const auth = useAuth();
  const [params] = useSearchParams();
  useEffect(() => { document.title = `${title} · Saranda Companion`; }, [title]);
  return { ...auth, next: safeNext(params.get("next")), params };
}

function Unavailable() {
  return (
    <AuthShell title={tr("Accounts aren't available here")} lead={tr("This copy of the site runs without a server, so there is nothing to sign in to. You can still plan trips and send booking requests.")}>
      <Link className="btn primary" to="/plan">{tr("Plan a trip")} <ArrowRight size={16} /></Link>
    </AuthShell>
  );
}

export function SignIn() {
  const { user, ready, available, setUser, next } = useAuthPage("Sign in");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [state, setState] = useState({ busy: false, error: "" });
  const [ticket, setTicket] = useState(""); // set once the password is accepted and a code is needed
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);

  if (!ready) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  if (!available) return <Unavailable />;
  if (user) return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "" });
    try {
      const res = await post("/auth/login", { email, password, remember });
      if (res.two_step) {
        setTicket(res.ticket);
        setPassword("");
        return setState({ busy: false, error: "" });
      }
      setUser(res.user);
      navigate(next, { replace: true });
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  };
  const submitCode = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "" });
    try {
      const res = await post("/auth/login/code", { ticket, code, remember });
      setUser(res.user);
      navigate(next, { replace: true });
    } catch (err) {
      setCode("");
      if (err.status === 401 && !err.fields?.code) setTicket(""); // the five minutes ran out: back to the password
      setState({ busy: false, error: err.message });
    }
  };
  if (ticket) {
    return (
      <AuthShell hour={19.2} eyebrow={tr("One more step")} title={tr("Enter your code")} lead={tr("Open your authenticator app and type the 6-digit code for Saranda Companion.")}
        footer={<button type="button" className="link-btn" onClick={() => { setTicket(""); setCode(""); setState({ busy: false, error: "" }); }}>{tr("Start again")}</button>}>
        <form className="stack" onSubmit={submitCode} noValidate>
          <CodeInput value={code} onChange={setCode} recovery={recovery} autoFocus />
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <button className="btn primary lg" disabled={state.busy || code.trim().length < 6}>{state.busy ? <span className="spinner" /> : <LogIn size={18} />} {tr("Sign in")}</button>
          <button type="button" className="link-btn small" onClick={() => { setRecovery((r) => !r); setCode(""); }}>{recovery ? tr("Use a code from my app") : tr("Lost your phone? Use a recovery code")}</button>
        </form>
      </AuthShell>
    );
  }
  return (
    <AuthShell hour={19.2} eyebrow={tr("Welcome back")} title={tr("Sign in")} lead={tr("See your bookings, guide requests and saved trips.")}
      footer={rich("New here? <a>Create an account</a>", { a: (c) => <Link to={`/signup?next=${encodeURIComponent(next)}`}>{c}</Link> })}>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={tr("Email")}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" maxLength={255} required autoFocus={FINE_POINTER} /></Field>
        <PasswordField value={password} onChange={setPassword} />
        <div className="row between small">
          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {tr("Keep me signed in")}</label>
          <Link to="/forgot-password">{tr("Forgot password?")}</Link>
        </div>
        {state.error && <Alert kind="error">{state.error}</Alert>}
        <button className="btn primary lg" disabled={state.busy || !email || !password}>{state.busy ? <span className="spinner" /> : <LogIn size={18} />} {tr("Sign in")}</button>
      </form>
    </AuthShell>
  );
}

export function SignUp() {
  const { user, ready, available, setUser, next } = useAuthPage("Create account");
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", website: "" });
  const [state, setState] = useState({ busy: false, error: "", fields: {} });
  // Functional update: autofill sets several fields in the same tick and all must be kept.
  const up = (k) => (e) => { const v = e?.target ? e.target.value : e; setForm((f) => ({ ...f, [k]: v })); };

  if (!ready) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  if (!available) return <Unavailable />;
  if (user) return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", fields: {} });
    try {
      const res = await post("/auth/register", form);
      setUser(res.user);
      navigate(next === "/account" ? "/account?welcome=1" : next, { replace: true });
    } catch (err) {
      setState({ busy: false, error: err.message, fields: err.fields || {} });
    }
  };
  return (
    <AuthShell hour={6.9} eyebrow={tr("A new day on the riviera")} title={tr("Create your account")} lead={tr("Free, and takes a minute. Your bookings and trips follow you to any device.")}
      footer={rich("Already have an account? <a>Sign in</a>", { a: (c) => <Link to={`/signin?next=${encodeURIComponent(next)}`}>{c}</Link> })}>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={tr("Name")} error={state.fields.name}><input className="input" value={form.name} onChange={up("name")} autoComplete="name" maxLength={120} required autoFocus={FINE_POINTER} /></Field>
        <Field label={tr("Email")} error={state.fields.email}><input className="input" type="email" value={form.email} onChange={up("email")} autoComplete="username" maxLength={255} required /></Field>
        <PasswordField value={form.password} onChange={up("password")} error={state.fields.password} autoComplete="new-password" meter hint={tr(PW_HINT)} />
        <input className="hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={up("website")} aria-hidden="true" />
        {state.error && !Object.keys(state.fields).length && <Alert kind="error">{state.error}</Alert>}
        {state.fields.email === "Already registered" && <Alert kind="info">That email already has an account. <Link to="/signin">Sign in</Link> or <Link to="/forgot-password">reset the password</Link>.</Alert>}
        <button className="btn primary lg" disabled={state.busy}>{state.busy ? <span className="spinner" /> : <UserPlus size={18} />} {tr("Create account")}</button>
        <p className="tiny muted">{rich("By creating an account you accept our <terms>booking terms</terms>. We only use your details for your bookings and account — see the <privacy>privacy policy</privacy>. You can export or delete your data at any time.", { terms: (c) => <Link to="/terms">{c}</Link>, privacy: (c) => <Link to="/privacy">{c}</Link> })}</p>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const { ready, available, emailDelivery } = useAuthPage("Reset password");
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ busy: false, sent: false, error: "", delivery: true });
  if (!ready) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  if (!available) return <Unavailable />;
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, sent: false, error: "", delivery: true });
    try {
      const res = await post("/auth/password/forgot", { email });
      setState({ busy: false, sent: true, error: "", delivery: res.email_delivery !== false });
    } catch (err) {
      setState({ busy: false, sent: false, error: err.message, delivery: true });
    }
  };
  return (
    <AuthShell hour={21.4} eyebrow={tr("It happens")} title={tr("Forgot your password?")} lead={tr("Enter your email and we'll send a link to choose a new one.")}
      footer={<Link to="/signin">{tr("Back to sign in")}</Link>}>
      {state.sent ? (
        state.delivery
          ? <Alert kind="ok">{tr("If that address has an account, a reset link is on its way. It works for one hour. Check your spam folder too.")}</Alert>
          : <Alert kind="warn">Email isn't set up on this site yet, so we can't send reset links. Please <Link to="/contact">contact us</Link> and we'll help you back in.</Alert>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {!emailDelivery && <Alert kind="warn">Reset emails aren't switched on yet. <Link to="/contact">Contact us</Link> if you're locked out.</Alert>}
          <Field label={tr("Email")}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" maxLength={255} required autoFocus={FINE_POINTER} /></Field>
          {state.error && <Alert kind="error">{state.error}</Alert>}
          <button className="btn primary lg" disabled={state.busy || !email}>{state.busy ? <span className="spinner" /> : <KeyRound size={18} />} {tr("Send reset link")}</button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const { ready, available, setUser, params } = useAuthPage("Choose a new password");
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [state, setState] = useState({ busy: false, error: "", fields: {} });
  // Take the token out of the address bar (and so out of history and referrers) straight away.
  useEffect(() => { if (token) window.history.replaceState(null, "", "/reset-password"); }, [token]);
  if (!ready) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  if (!available) return <Unavailable />;
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "", fields: {} });
    try {
      const res = await post("/auth/password/reset", { token, password });
      setUser(res.user);
      navigate("/account?reset=1", { replace: true });
    } catch (err) {
      setState({ busy: false, error: err.message, fields: err.fields || {} });
    }
  };
  return (
    <AuthShell hour={5.6} eyebrow={tr("Almost there")} title={tr("Choose a new password")} lead={tr("You'll be signed in, and every other device will be signed out.")}
      footer={<Link to="/forgot-password">{tr("Ask for a new link")}</Link>}>
      {!token ? <Alert kind="warn">{tr("This page needs the link from your reset email.")}</Alert> : (
        <form className="stack" onSubmit={submit} noValidate>
          <PasswordField label={tr("New password")} value={password} onChange={setPassword} error={state.fields.password} autoComplete="new-password" meter hint={tr(PW_HINT)} />
          {state.error && !state.fields.password && <Alert kind="error">{state.error}</Alert>}
          <button className="btn primary lg" disabled={state.busy || !password}>{state.busy ? <span className="spinner" /> : <KeyRound size={18} />} {tr("Save password")}</button>
        </form>
      )}
    </AuthShell>
  );
}

export function VerifyEmail() {
  const { ready, available, user, setUser, params } = useAuthPage("Confirm email");
  const token = params.get("token") || "";
  const [state, setState] = useState({ status: "working", message: "" });
  useEffect(() => {
    if (!ready || !available) return;
    if (!token) return setState({ status: "error", message: "This page needs the link from your confirmation email." });
    window.history.replaceState(null, "", "/verify-email");
    post("/auth/verify", { token })
      .then(() => {
        setState({ status: "ok", message: "" });
        if (user) setUser({ ...user, email_verified: true });
      })
      .catch((err) => setState({ status: "error", message: err.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, available]);
  if (!ready) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  if (!available) return <Unavailable />;
  return (
    <AuthShell hour={8.2} eyebrow={tr("Email")} title={state.status === "ok" ? tr("Email confirmed") : tr("Confirming your email")}>
      {state.status === "working" && <Skeleton h={60} r={14} />}
      {state.status === "ok" && <Alert kind="ok"><MailCheck size={16} /> {tr("Thank you — bookings made with this address now appear in your account.")}</Alert>}
      {state.status === "error" && <Alert kind="error">{state.message}</Alert>}
      <Link className="btn primary" to={user ? "/account" : "/signin"}>{user ? tr("Go to my account") : tr("Sign in")} <ArrowRight size={16} /></Link>
    </AuthShell>
  );
}

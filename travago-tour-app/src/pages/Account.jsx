import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BedDouble, CalendarRange, Compass, Download, KeyRound, LogOut, MailWarning, MonitorSmartphone, ShieldCheck, Trash2, UserRound, Users, Store,
} from "lucide-react";
import { api, post } from "../lib/api";
import { useAuth } from "../store/auth";
import { useGuidesOn } from "../lib/useConfig";
import { euro, fmtDate } from "../lib/format";
import { Alert, Field, Segmented, Skeleton, toast } from "../components/ui";
import TicketCard from "../components/account/TicketCard";
import PasswordField from "../components/auth/PasswordField";

const HostDesk = lazy(() => import("../components/account/HostDesk"));

const GUIDE_STATUS = { requested: ["Awaiting guide", "sea"], accepted: ["Accepted", "olive"], declined: ["Declined", "terracotta"], cancelled: ["Cancelled", "terracotta"] };
const ago = (iso) => {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} days ago`;
};

function VerifyBanner({ user, emailDelivery }) {
  const [state, setState] = useState("idle");
  if (user.email_verified) return null;
  const resend = async () => {
    setState("busy");
    try {
      await post("/auth/verify/resend", {});
      setState("sent");
    } catch (e) {
      toast(e.message);
      setState("idle");
    }
  };
  return (
    <Alert kind="warn">
      <b><MailWarning size={15} /> Confirm your email.</b> Until you do, bookings made earlier with {user.email} stay hidden from this account.{" "}
      {!emailDelivery ? <>Email isn't switched on yet — <Link to="/contact">contact us</Link> to confirm by hand.</>
        : state === "sent" ? "A new link is on its way."
          : <button type="button" className="link-btn" onClick={resend} disabled={state === "busy"}>Send the link again</button>}
    </Alert>
  );
}

function Stays({ data }) {
  if (!data.bookings.length && !data.trips.length) {
    return (
      <div className="empty card pad">
        <Compass size={28} style={{ margin: "0 auto 10px" }} />
        <p>Nothing here yet. Plan a trip or book a sea-view apartment and it will show up here.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn primary" to="/plan"><CalendarRange size={16} /> Plan a trip</Link>
          <Link className="btn" to="/stays"><BedDouble size={16} /> See the apartments</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="stack" style={{ "--gap": "26px" }}>
      {data.bookings.length > 0 && (
        <section className="stack">
          <h2 className="h3"><BedDouble size={18} /> Your stays</h2>
          {data.bookings.map((b, i) => (
            <motion.div key={b.reference} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <TicketCard booking={b} to={`/booking/${b.reference}`} />
            </motion.div>
          ))}
        </section>
      )}
      {data.trips.length > 0 && (
        <section className="stack">
          <h2 className="h3"><CalendarRange size={18} /> Saved trips</h2>
          <div className="grid" style={{ "--min": "240px" }}>
            {data.trips.map((t) => (
              <Link key={t.share_id} to={`/trip/${t.share_id}`} className="card pad hover trip-mini">
                <b>{t.title}</b>
                <span className="small muted">{t.days} day{t.days === 1 ? "" : "s"} · {t.stops} place{t.stops === 1 ? "" : "s"}{t.start_date ? ` · from ${fmtDate(t.start_date, { day: "numeric", month: "short", year: "numeric" })}` : ""}</span>
                <span className="tiny faint">Saved {ago(t.updated_at)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GuideRequests({ rows }) {
  if (!rows.length) {
    return <div className="empty card pad"><Users size={28} style={{ margin: "0 auto 10px" }} /><p>No guide requests yet.</p><Link className="btn primary" to="/guides">Meet the guides</Link></div>;
  }
  return (
    <div className="stack">
      {rows.map((g) => {
        const [label, tone] = GUIDE_STATUS[g.status] || GUIDE_STATUS.requested;
        return (
          <Link key={g.reference} to={`/guide-request/${g.reference}`} className="card pad hover guide-req">
            <div className="row between wrap gap-sm">
              <b>{g.guide?.name || "Guide"}</b>
              <span className={`badge ${tone}`}>{label}</span>
            </div>
            <span className="small muted">{fmtDate(g.tour_date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })} · {g.duration_label} · {g.group_size} people · {euro(g.quoted_price)}</span>
            <span className="tiny faint">Reference {g.reference}</span>
          </Link>
        );
      })}
    </div>
  );
}

function Security({ user, onUser }) {
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone });
  const [pErr, setPErr] = useState({});
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [pwState, setPwState] = useState({ busy: false, fields: {}, error: "" });
  const [sessions, setSessions] = useState(null);
  const [del, setDel] = useState({ open: false, password: "", error: "", busy: false });

  const loadSessions = useCallback(() => api("/account/sessions", { cacheable: false }).then((r) => setSessions(r.sessions)).catch(() => setSessions([])), []);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setPErr({});
    try {
      const res = await api("/auth/me", { method: "PATCH", body: profile });
      onUser(res.user);
      toast("Profile saved");
    } catch (err) {
      setPErr(err.fields || { name: err.message });
    }
  };
  const changePassword = async (e) => {
    e.preventDefault();
    setPwState({ busy: true, fields: {}, error: "" });
    try {
      await post("/auth/password", pw);
      setPw({ current_password: "", new_password: "" });
      setPwState({ busy: false, fields: {}, error: "" });
      toast("Password changed — other devices were signed out");
      loadSessions();
    } catch (err) {
      setPwState({ busy: false, fields: err.fields || {}, error: err.message });
    }
  };
  const revoke = async (id) => {
    await api(`/account/sessions/${id}`, { method: "DELETE" }).catch((e) => toast(e.message));
    loadSessions();
  };
  const revokeOthers = async () => {
    await post("/account/sessions/revoke-others", {}).catch((e) => toast(e.message));
    toast("Signed out everywhere else");
    loadSessions();
  };
  const remove = async (e) => {
    e.preventDefault();
    setDel((d) => ({ ...d, busy: true, error: "" }));
    try {
      await post("/account/delete", { password: del.password });
      onUser(null);
      navigate("/", { replace: true });
      toast("Your account was deleted");
    } catch (err) {
      setDel((d) => ({ ...d, busy: false, error: err.message }));
    }
  };

  return (
    <div className="grid account-security" style={{ "--min": "320px" }}>
      <form className="card pad stack" onSubmit={saveProfile} noValidate>
        <h2 className="h3"><UserRound size={18} /> Profile</h2>
        <Field label="Name" error={pErr.name}><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} autoComplete="name" maxLength={120} required /></Field>
        <Field label="Phone / WhatsApp (optional)" error={pErr.phone}><input className="input" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} autoComplete="tel" maxLength={20} /></Field>
        <Field label="Email" hint={user.email_verified ? "Confirmed" : "Not confirmed yet"}><input className="input" value={user.email} readOnly disabled /></Field>
        <button className="btn primary">Save profile</button>
      </form>

      <form className="card pad stack" onSubmit={changePassword} noValidate>
        <h2 className="h3"><KeyRound size={18} /> Password</h2>
        <PasswordField label="Current password" value={pw.current_password} onChange={(v) => setPw({ ...pw, current_password: v })} error={pwState.fields.current_password} />
        <PasswordField label="New password" value={pw.new_password} onChange={(v) => setPw({ ...pw, new_password: v })} error={pwState.fields.new_password} autoComplete="new-password" meter hint="At least 10 characters." />
        {pwState.error && !Object.keys(pwState.fields).length && <Alert kind="error">{pwState.error}</Alert>}
        <button className="btn primary" disabled={pwState.busy || !pw.current_password || !pw.new_password}>Change password</button>
        <p className="tiny muted">Changing it signs out every other device.</p>
      </form>

      <div className="card pad stack">
        <h2 className="h3"><MonitorSmartphone size={18} /> Signed-in devices</h2>
        {!sessions ? <Skeleton h={80} r={12} /> : (
          <ul className="device-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <span><b>{s.device}</b>{s.current && <span className="badge olive">This device</span>}<span className="tiny muted">Active {ago(s.last_seen_at)} · signed in {ago(s.created_at)}</span></span>
                {!s.current && <button type="button" className="btn sm" onClick={() => revoke(s.id)}>Sign out</button>}
              </li>
            ))}
          </ul>
        )}
        {sessions?.length > 1 && <button type="button" className="btn sm" onClick={revokeOthers}>Sign out everywhere else</button>}
        <button type="button" className="btn" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={16} /> Sign out of this device</button>
      </div>

      <div className="card pad stack">
        <h2 className="h3"><ShieldCheck size={18} /> Your data</h2>
        <p className="small muted">Download everything this account holds, or delete the account. Bookings stay with the host as business records but are unlinked from you; saved trips are erased.</p>
        <a className="btn" href="/api/account/export"><Download size={16} /> Download my data (JSON)</a>
        {!del.open ? (
          <button type="button" className="btn danger-outline" onClick={() => setDel({ ...del, open: true })}><Trash2 size={16} /> Delete my account…</button>
        ) : (
          <form className="stack" onSubmit={remove} noValidate>
            <PasswordField label="Enter your password to confirm" value={del.password} onChange={(v) => setDel({ ...del, password: v })} error={del.error} />
            <div className="row gap-sm">
              <button className="btn danger" disabled={del.busy || !del.password}><Trash2 size={16} /> Delete forever</button>
              <button type="button" className="btn" onClick={() => setDel({ open: false, password: "", error: "", busy: false })}>Keep my account</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Account() {
  const { user, ready, available, emailDelivery, setUser } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const tab = params.get("tab") || "stays";
  const guidesOn = useGuidesOn();

  useEffect(() => { document.title = "My account · Saranda Companion"; }, []);
  useEffect(() => {
    if (!user) return;
    api("/account/overview", { cacheable: false }).then(setData).catch((e) => setError(e.message));
  }, [user?.id, user?.email_verified]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (params.get("welcome")) toast("Welcome! Your account is ready.");
    if (params.get("reset")) toast("Password changed. You're signed in.");
    if (params.get("welcome") || params.get("reset")) setParams(tab === "stays" ? {} : { tab }, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  if (!available) return <Navigate to="/" replace />;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const options = [
    { value: "stays", label: "Trips & stays" },
    // Without listed guides the tab only appears for people who already sent a request.
    ...(guidesOn || data?.guide_requests?.length || tab === "guides" ? [{ value: "guides", label: "Guides" }] : []),
    { value: "security", label: "Security" },
    ...(user.is_admin ? [{ value: "host", label: "Host desk" }] : []),
  ];
  const first = (user.name || "").split(" ")[0];
  return (
    <div className="page container account">
      <header className="account-head">
        <div className="account-avatar" aria-hidden="true">{(first[0] || user.email[0]).toUpperCase()}</div>
        <div>
          <div className="eyebrow">{user.is_admin ? <><Store size={14} /> Host account</> : "My account"}</div>
          <h1>Mirë se erdhe{first ? `, ${first}` : ""}</h1>
          <p className="muted small">{user.email}</p>
        </div>
      </header>
      <VerifyBanner user={user} emailDelivery={emailDelivery} />
      <Segmented options={options} value={tab} onChange={(v) => setParams(v === "stays" ? {} : { tab: v }, { replace: true })} layoutId="account-tabs" />
      {error && <Alert kind="error">{error}</Alert>}
      <div className="account-body">
        {tab === "host" && user.is_admin ? (
          <Suspense fallback={<Skeleton h={300} r={20} />}><HostDesk /></Suspense>
        ) : tab === "security" ? (
          <Security user={user} onUser={setUser} />
        ) : !data ? (
          <Skeleton h={260} r={20} />
        ) : tab === "guides" ? (
          <GuideRequests rows={data.guide_requests} />
        ) : (
          <Stays data={data} />
        )}
      </div>
    </div>
  );
}

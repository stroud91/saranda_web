// The business dashboard: one place where a local business manages its profile,
// its apartments, rentals and activities, and the requests guests send.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ExternalLink, Inbox, LogIn, MailWarning, Pause, Pencil, Play, Plus, ShieldCheck, Store, Trash2, UserPlus } from "lucide-react";
import { post } from "../lib/api";
import { useAuth } from "../store/auth";
import { useConfig } from "../lib/useConfig";
import { KINDS, fresh, partnerDelete, partnerPut, reviewBadge } from "../lib/partners";
import { euro } from "../lib/format";
import { Alert, PageHeader, Segmented, Skeleton, toast } from "../components/ui";
import GuideAvatar from "../components/art/GuideAvatar";
import ProfileForm from "../components/business/ProfileForm";
import ListingSheet from "../components/business/ListingSheet";
import Requests from "../components/business/Requests";
import LookEditor from "../components/business/LookEditor";

function Welcome({ unavailable }) {
  return (
    <div className="page container narrow">
      <PageHeader eyebrow="For local businesses" icon={Store} title="Put your business in front of travellers" lead="Rent out apartments, cars, scooters or boats? Run tours or activities? Add your business once and manage everything you offer from one place. It's free." />
      <div className="biz-steps">
        <div className="card pad"><b>1 · Your profile</b><span className="small muted">Who you are, where you are and how guests reach you.</span></div>
        <div className="card pad"><b>2 · What you offer</b><span className="small muted">Apartments, rentals and activities, each with its own price.</span></div>
        <div className="card pad"><b>3 · Guests contact you</b><span className="small muted">Requests arrive by email and in your dashboard. Guests pay you directly.</span></div>
      </div>
      {unavailable ? (
        <Alert kind="info">Business sign-up isn't available on this copy of the site. <Link to="/contact">Contact us</Link> and we'll add you.</Alert>
      ) : (
        <div className="row">
          <Link className="btn primary lg" to="/signup?next=/business"><UserPlus size={18} /> Create a free account</Link>
          <Link className="btn lg" to="/signin?next=/business"><LogIn size={18} /> I already have one</Link>
        </div>
      )}
      <p className="small muted"><ShieldCheck size={14} /> We check every business and listing before it appears, so guests can trust what they see.</p>
    </div>
  );
}

function VerifyFirst({ email, emailDelivery }) {
  const [state, setState] = useState("idle");
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
      <b><MailWarning size={15} /> Confirm your email first.</b> We sent a link to {email}. Open it, then come back here to add your business.{" "}
      {!emailDelivery ? <>Email isn't switched on yet — <Link to="/contact">contact us</Link> and we'll confirm you by hand.</>
        : state === "sent" ? "A new link is on its way."
          : <button type="button" className="link-btn" onClick={resend} disabled={state === "busy"}>Send the link again</button>}
    </Alert>
  );
}

function StatusNote({ business }) {
  const { status, review_note: note, has_pending_changes: changes } = business;
  if (status === "pending") return <Alert kind="info"><b>Waiting for review.</b> We're checking your business and will email you. You can add what you offer in the meantime; nothing is public until it's approved.</Alert>;
  if (status === "rejected") return <Alert kind="warn"><b>Your profile needs changes before it can go live.</b>{note ? <> Our note: “{note}”</> : null} Edit it under Profile and save to send it again.</Alert>;
  if (status === "suspended") return <Alert kind="error"><b>Your business page is offline.</b>{note ? <> Our note: “{note}”</> : null} <Link to="/contact">Contact us</Link> to sort it out.</Alert>;
  if (changes) return <Alert kind="info">Your profile changes are waiting for review. Guests see the current version until then.</Alert>;
  if (note) return <Alert kind="warn"><b>Your last profile changes weren't approved.</b> Our note: “{note}”</Alert>;
  return null;
}

function ListingRow({ kindKey, item, onEdit, onChange, onRemove }) {
  const kind = KINDS[kindKey];
  const [busy, setBusy] = useState(false);
  const badge = reviewBadge(item);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = () => run(async () => {
    onChange(await partnerPut(`/partner/listings/${kindKey}/${item.id}`, item.on ? kind.pause : kind.resume));
    toast(item.on ? "Paused — hidden from guests" : "Switched back on");
  });
  const remove = () => window.confirm(`Remove “${item[kind.nameField]}”? This can't be undone.`) && run(async () => {
    await partnerDelete(`/partner/listings/${kindKey}/${item.id}`);
    onRemove(item.id);
    toast("Removed");
  });
  return (
    <li className={`host-row ${item.review_status === "rejected" ? "needs" : ""}`}>
      <div className="host-row-main">
        <div className="row between"><b>{item[kind.nameField]}</b><span className={`badge ${badge.tone}`}>{badge.text}</span></div>
        <span className="small"><b>{euro(item[kind.priceField])}</b> {kind.unit} · <span className="muted">{kind.facts(item).filter(Boolean).join(" · ")}</span></span>
        {item.review_note && <span className="small host-why">Our note: “{item.review_note}”{item.review_status === "rejected" ? " — edit and save to send it again." : ""}</span>}
      </div>
      <div className="host-actions">
        <button type="button" className="btn sm" disabled={busy} onClick={onEdit}><Pencil size={14} /> Edit</button>
        <button type="button" className="btn sm" disabled={busy} onClick={toggle}>{item.on ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}</button>
        <button type="button" className="icon-btn sm" disabled={busy} onClick={remove} aria-label={`Remove ${item[kind.nameField]}`} title="Remove"><Trash2 size={16} /></button>
      </div>
    </li>
  );
}

function Listings({ data, setData }) {
  const [sheet, setSheet] = useState(null);
  const total = Object.values(data.listings).reduce((n, rows) => n + rows.length, 0);
  const full = total >= data.max_listings;
  const put = (kindKey, row) => setData((d) => {
    const rows = d.listings[kindKey];
    const next = rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row];
    return { ...d, listings: { ...d.listings, [kindKey]: next } };
  });
  const drop = (kindKey) => (id) => setData((d) => ({ ...d, listings: { ...d.listings, [kindKey]: d.listings[kindKey].filter((r) => r.id !== id) } }));
  return (
    <div className="stack" style={{ "--gap": "26px" }}>
      {total === 0 && <Alert kind="info">Start by adding what you offer. Each one gets its own page for guests once we've approved it.</Alert>}
      {Object.entries(KINDS).map(([key, kind]) => (
        <section key={key} className="stack">
          <div className="row between">
            <h2 className="h3"><kind.icon size={18} /> {kind.plural} <span className="muted small">({data.listings[key].length})</span></h2>
            <button type="button" className="btn sm primary" disabled={full} onClick={() => setSheet({ kind: key })}><Plus size={15} /> {kind.add}</button>
          </div>
          {data.listings[key].length > 0 && (
            <ul className="host-list">
              {data.listings[key].map((item) => (
                <ListingRow key={item.id} kindKey={key} item={item} onEdit={() => setSheet({ kind: key, item })} onChange={(row) => put(key, row)} onRemove={drop(key)} />
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="tiny muted">{total} of {data.max_listings} listings used.{full ? " Remove one to add another, or contact us if you need more." : ""}</p>
      <ListingSheet target={sheet} options={data.options} onClose={() => setSheet(null)} onSaved={put} />
    </div>
  );
}

export default function Business() {
  const { user, ready, available, emailDelivery } = useAuth();
  const cfg = useConfig();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const tab = params.get("tab") || "listings";
  const on = cfg.partners === true;

  useEffect(() => { document.title = "Business dashboard · Saranda Companion"; }, []);
  useEffect(() => {
    if (!user || !on) return;
    fresh("/partner/").then(setData).catch((e) => setError(e.message));
  }, [user?.id, on]); // eslint-disable-line react-hooks/exhaustive-deps
  const setCount = useCallback((n) => setData((d) => (d && d.new_requests !== n ? { ...d, new_requests: n } : d)), []);

  if (!ready) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  if (!available || cfg.partners === false) return <Welcome unavailable />;
  if (!user) return <Welcome />;
  if (error) return <div className="page container narrow"><Alert kind="error">{error}</Alert></div>;
  if (!data || !on) return <div className="page container"><Skeleton h={420} r={26} /></div>;

  const { business } = data;
  if (!business) {
    return (
      <div className="page container narrow">
        <PageHeader eyebrow="For local businesses" icon={Store} title="Tell guests about your business" lead="Start with your profile. After that you can add your apartments, rentals and activities." />
        {data.email_verified
          ? <ProfileForm onSaved={(saved) => setData({ ...data, business: saved })} />
          : <VerifyFirst email={user.email} emailDelivery={emailDelivery} />}
      </div>
    );
  }

  const badge = reviewBadge(business);
  return (
    <div className="page container account biz">
      <header className="account-head">
        <GuideAvatar name={business.name} palette={business.palette} size={72} />
        <div>
          <div className="eyebrow"><Store size={14} /> Business dashboard</div>
          <h1>{business.name}</h1>
          <p className="small row" style={{ gap: 10 }}>
            <span className={`badge ${badge.tone}`}>{badge.text}</span>
            {business.status === "approved" && <Link to={`/partners/${business.slug}`}>View your public page <ExternalLink size={12} /></Link>}
          </p>
        </div>
      </header>
      <StatusNote business={business} />
      {!data.email_verified && <VerifyFirst email={user.email} emailDelivery={emailDelivery} />}
      <Segmented
        layoutId="biz-tabs" value={tab} onChange={(v) => setParams(v === "listings" ? {} : { tab: v }, { replace: true })}
        options={[{ value: "listings", label: "What you offer" }, { value: "requests", label: `Requests${data.new_requests ? ` (${data.new_requests})` : ""}` }, { value: "look", label: "Page style" }, { value: "profile", label: "Profile" }]}
      />
      <div className="account-body">
        {tab === "requests" ? <Requests onCount={setCount} />
          : tab === "look" ? <LookEditor business={business} listings={data.listings} onSaved={(saved) => setData((d) => ({ ...d, business: saved }))} />
          : tab === "profile" ? <ProfileForm business={business} onSaved={(saved) => setData((d) => ({ ...d, business: saved }))} />
            : <Listings data={data} setData={setData} />}
      </div>
      <p className="small muted biz-foot"><Inbox size={14} /> Guests' requests are emailed to {user.email}. <Link to="/terms#partners">Rules for businesses <ArrowRight size={12} /></Link></p>
    </div>
  );
}

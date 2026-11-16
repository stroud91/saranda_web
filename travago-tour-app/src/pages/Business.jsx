// The business dashboard: one place where a local business manages its profile,
// its apartments, rentals and activities, and the requests guests send.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ExternalLink, Inbox, LogIn, MailWarning, ShieldCheck, Store, UserPlus } from "lucide-react";
import { post } from "../lib/api";
import { useAuth } from "../store/auth";
import { useConfig } from "../lib/useConfig";
import { fresh, reviewBadge } from "../lib/partners";
import { Alert, PageHeader, Segmented, Skeleton, toast } from "../components/ui";
import GuideAvatar from "../components/art/GuideAvatar";
import ProfileForm from "../components/business/ProfileForm";
import ListingManager from "../components/business/ListingManager";
import Requests from "../components/business/Requests";
import LookEditor from "../components/business/LookEditor";
import ReviewDesk from "../components/account/ReviewDesk";
import { rich, tr } from "../i18n";

function Welcome({ unavailable }) {
  return (
    <div className="page container narrow">
      <PageHeader eyebrow={tr("For local businesses")} icon={Store} title={tr("Put your business in front of travellers")} lead={tr("Rent out apartments, cars, scooters or boats? Run tours or activities? Add your business once and manage everything you offer from one place. It's free.")} />
      <div className="biz-steps">
        <div className="card pad"><b>{tr("1 · Your profile")}</b><span className="small muted">{tr("Who you are, where you are and how guests reach you.")}</span></div>
        <div className="card pad"><b>{tr("2 · What you offer")}</b><span className="small muted">{tr("Apartments, rentals and activities, each with its own price.")}</span></div>
        <div className="card pad"><b>{tr("3 · Guests contact you")}</b><span className="small muted">{tr("Requests arrive by email and in your dashboard. Guests pay you directly.")}</span></div>
      </div>
      {unavailable ? (
        <Alert kind="info">{rich("Business sign-up isn't available on this copy of the site. <a>Contact us</a> and we'll add you.", { a: (c) => <Link to="/contact">{c}</Link> })}</Alert>
      ) : (
        <div className="row">
          <Link className="btn primary lg" to="/signup?next=/business"><UserPlus size={18} /> {tr("Create a free account")}</Link>
          <Link className="btn lg" to="/signin?next=/business"><LogIn size={18} /> {tr("I already have one")}</Link>
        </div>
      )}
      <p className="small muted"><ShieldCheck size={14} /> {tr("We check every business and listing before it appears, so guests can trust what they see.")}</p>
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
      <b><MailWarning size={15} /> {tr("Confirm your email first.")}</b> {tr("We sent a link to {email}. Open it, then come back here to add your business.", { email })}{" "}
      {!emailDelivery ? <>Email isn't switched on yet — <Link to="/contact">contact us</Link> and we'll confirm you by hand.</>
        : state === "sent" ? "A new link is on its way."
          : <button type="button" className="link-btn" onClick={resend} disabled={state === "busy"}>Send the link again</button>}
    </Alert>
  );
}

function StatusNote({ business }) {
  const { status, review_note: note, has_pending_changes: changes } = business;
  if (status === "pending") return <Alert kind="info"><b>{tr("Waiting for review.")}</b> {tr("We're checking your business and will email you. You can add what you offer in the meantime; nothing is public until it's approved.")}</Alert>;
  if (status === "rejected") return <Alert kind="warn"><b>{tr("Your profile needs changes before it can go live.")}</b>{note ? ` ${tr("Our note: “{note}”", { note })}` : null} {tr("Edit it under Profile and save to send it again.")}</Alert>;
  if (status === "suspended") return <Alert kind="error"><b>{tr("Your business page is offline.")}</b>{note ? ` ${tr("Our note: “{note}”", { note })}` : null} {rich("<a>Contact us</a> to sort it out.", { a: (c) => <Link to="/contact">{c}</Link> })}</Alert>;
  if (changes) return <Alert kind="info">{tr("Your profile changes are waiting for review. Guests see the current version until then.")}</Alert>;
  if (note) return <Alert kind="warn"><b>{tr("Your last profile changes weren't approved.")}</b> {tr("Our note: “{note}”", { note })}</Alert>;
  return null;
}

function Listings({ data, setData }) {
  const total = Object.values(data.listings).reduce((n, rows) => n + rows.length, 0);
  const full = total >= data.max_listings;
  const put = (kindKey, row) => setData((d) => {
    const rows = d.listings[kindKey];
    const next = rows.some((r) => r.id === row.id) ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row];
    return { ...d, listings: { ...d.listings, [kindKey]: next } };
  });
  const drop = (kindKey, id) => setData((d) => ({ ...d, listings: { ...d.listings, [kindKey]: d.listings[kindKey].filter((r) => r.id !== id) } }));
  return (
    <div className="stack" style={{ "--gap": "26px" }}>
      {total === 0 && <Alert kind="info">{tr("Start by adding what you offer. Each one gets its own page for guests once we've approved it.")}</Alert>}
      <ListingManager listings={data.listings} options={data.options} full={full} onPut={put} onDrop={drop} />
      <p className="tiny muted">{tr("{used} of {max} listings used.", { used: total, max: data.max_listings })}{full ? ` ${tr("Remove one to add another, or contact us if you need more.")}` : ""}</p>
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
        <PageHeader eyebrow={tr("For local businesses")} icon={Store} title={tr("Tell guests about your business")} lead={tr("Start with your profile. After that you can add your apartments, rentals and activities.")} />
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
          <div className="eyebrow"><Store size={14} /> {tr("Business dashboard")}</div>
          <h1>{business.name}</h1>
          <p className="small row" style={{ gap: 10 }}>
            <span className={`badge ${badge.tone}`}>{tr(badge.text)}</span>
            {business.status === "approved" && <Link to={`/partners/${business.slug}`}>{tr("View your public page")} <ExternalLink size={12} /></Link>}
          </p>
        </div>
      </header>
      <StatusNote business={business} />
      {!data.email_verified && <VerifyFirst email={user.email} emailDelivery={emailDelivery} />}
      <Segmented
        layoutId="biz-tabs" value={tab} onChange={(v) => setParams(v === "listings" ? {} : { tab: v }, { replace: true })}
        options={[{ value: "listings", label: "What you offer" }, { value: "requests", label: `${tr("Requests")}${data.new_requests ? ` (${data.new_requests})` : ""}` }, { value: "reviews", label: "Reviews" }, { value: "look", label: "Page style" }, { value: "profile", label: "Profile" }]}
      />
      <div className="account-body">
        {tab === "requests" ? <Requests onCount={setCount} />
          : tab === "reviews" ? <ReviewDesk mode="partner" />
          : tab === "look" ? <LookEditor business={business} listings={data.listings} onSaved={(saved) => setData((d) => ({ ...d, business: saved }))} />
          : tab === "profile" ? <ProfileForm business={business} onSaved={(saved) => setData((d) => ({ ...d, business: saved }))} />
            : <Listings data={data} setData={setData} />}
      </div>
      <p className="small muted biz-foot"><Inbox size={14} /> {tr("Guests' requests are emailed to {email}.", { email: user.email })} <Link to="/terms#partners">{tr("Rules for businesses")} <ArrowRight size={12} /></Link></p>
    </div>
  );
}

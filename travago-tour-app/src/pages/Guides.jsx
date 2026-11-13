import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Languages, Car, BadgeCheck, Award, UsersRound, Mail, MessageCircle, CalendarRange } from "lucide-react";
import { useApi } from "../lib/useApi";
import { useConfig, whatsappUrl } from "../lib/useConfig";
import { euro } from "../lib/format";
import GuideAvatar from "../components/art/GuideAvatar";
import { PageHeader, Skeleton, Alert } from "../components/ui";
import { tr } from "../i18n";

export default function Guides() {
  const [params, setParams] = useSearchParams();
  const qs = params.toString();
  const { data, loading } = useApi(`/guides/${qs ? `?${qs}` : ""}`);
  const { data: all } = useApi("/guides/");
  const cfg = useConfig();
  const facets = all?.facets || { languages: [], specialties: [] };
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (!v || next.get(k) === String(v)) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };
  useEffect(() => { document.title = "Local guides · Saranda Companion"; }, []);
  const hasSample = data?.guides?.some((g) => g.is_sample);
  if (all && !all.guides.length) return <ComingSoon whatsapp={cfg.whatsapp} />;
  return (
    <div className="page container">
      <PageHeader eyebrow={tr("Local guides")} icon={Users} title={tr("Travel with someone who's from here")} lead={tr("Archaeologists for Butrint, skippers for the hidden bays, chefs, hikers and driver-guides. Request a date — the guide confirms before anything is paid.")} />
      <div className="filters card pad">
        <div className="filter-row"><span className="label"><Languages size={14} /> {tr("Language")}</span>
          <div className="chips">{facets.languages.map((l) => <button key={l} className={`chip sm ${params.get("language") === l ? "on" : ""}`} onClick={() => set("language", l)}>{l}</button>)}</div>
        </div>
        <div className="filter-row"><span className="label"><Award size={14} /> {tr("Speciality")}</span>
          <div className="chips">{facets.specialties.map((s) => <button key={s} className={`chip sm ${params.get("specialty") === s ? "on" : ""}`} onClick={() => set("specialty", s)}>{s}</button>)}</div>
        </div>
        <div className="filter-row"><span className="label"><Car size={14} /> {tr("Transport")}</span>
          <div className="chips">
            <button className={`chip sm ${params.get("vehicle") ? "on" : ""}`} onClick={() => set("vehicle", "true")}>{tr("Has a vehicle")}</button>
            {[4, 8, 12].map((n) => <button key={n} className={`chip sm ${params.get("group") === String(n) ? "on" : ""}`} onClick={() => set("group", String(n))}><UsersRound size={13} /> {n}+ people</button>)}
          </div>
        </div>
      </div>
      {hasSample && <Alert kind="info">{tr("These are sample guide profiles that show how the marketplace works. Meg'Rooms will replace them with vetted local guides before launch.")}</Alert>}
      <div className="grid" style={{ "--min": "300px", marginTop: 18 }}>
        {loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={300} r={26} />)}
        {data?.guides.map((g, i) => (
          <motion.div key={g.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`/guides/${g.slug}`} className={`guide-card card hover p-${g.palette}`}>
              <div className="guide-card-top">
                <GuideAvatar name={g.name} palette={g.palette} size={76} />
                <div>
                  <h3>{g.name}</h3>
                  <div className="tiny muted">{g.base_city} · {g.years_experience} yrs</div>
                  <div className="row" style={{ gap: 6, marginTop: 6 }}>
                    {g.licensed && <span className="badge sea"><BadgeCheck size={12} /> {tr("Licensed")}</span>}
                    {g.has_vehicle && <span className="badge olive"><Car size={12} /> {tr("Vehicle")}</span>}
                    {g.is_sample && <span className="badge">{tr("Sample profile")}</span>}
                  </div>
                </div>
              </div>
              <p className="guide-headline">{g.headline}</p>
              <div className="chips">{g.specialties.map((s) => <span key={s} className="chip sm">{s}</span>)}</div>
              <div className="guide-foot">
                <span className="small muted"><Languages size={14} /> {g.languages.join(", ")}</span>
                <span className="guide-price">from <b>{euro(g.price_half_day)}</b></span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      {data && !data.guides.length && <div className="empty">{tr("No guides match those filters yet.")}</div>}
    </div>
  );
}

/** Shown until the host lists real guides (sample profiles are hidden from guests). */
function ComingSoon({ whatsapp }) {
  const wa = whatsappUrl(whatsapp, "Hello Meg'Rooms! I'd like a local guide for my trip.");
  return (
    <div className="page container narrow">
      <PageHeader eyebrow={tr("Local guides")} icon={Users} title={tr("Local guides are on their way")} lead={tr("We're choosing licensed guides, skippers and driver-guides we'd send our own family with. Until their profiles are here, tell us what you'd like to do and we'll put you in touch.")} />
      <div className="card pad stack coming-soon">
        <div className="row">
          <Link className="btn primary" to="/contact?topic=guide"><Mail size={16} /> {tr("Ask us for a guide")}</Link>
          {wa && <a className="btn whatsapp" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> {tr("WhatsApp")}</a>}
        </div>
        <p className="small muted">{tr("Meanwhile, plan the days yourself: every road time, ferry and boat trip is in the planner.")}</p>
        <div className="row">
          <Link className="btn sm" to="/itineraries"><CalendarRange size={15} /> {tr("Ready-made itineraries")}</Link>
          <Link className="btn sm" to="/experiences">{tr("Day tours & car hire")}</Link>
        </div>
      </div>
    </div>
  );
}

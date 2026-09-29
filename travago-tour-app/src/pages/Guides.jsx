import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Languages, Car, BadgeCheck, Award, UsersRound } from "lucide-react";
import { useApi } from "../lib/useApi";
import { euro } from "../lib/format";
import GuideAvatar from "../components/art/GuideAvatar";
import { PageHeader, Skeleton, Alert } from "../components/ui";

export default function Guides() {
  const [params, setParams] = useSearchParams();
  const qs = params.toString();
  const { data, loading } = useApi(`/guides/${qs ? `?${qs}` : ""}`);
  const { data: all } = useApi("/guides/");
  const facets = all?.facets || { languages: [], specialties: [] };
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (!v || next.get(k) === String(v)) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };
  useEffect(() => { document.title = "Local guides · Saranda Companion"; }, []);
  const hasSample = data?.guides?.some((g) => g.is_sample);
  return (
    <div className="page container">
      <PageHeader eyebrow="Local guides" icon={Users} title="Travel with someone who's from here" lead="Archaeologists for Butrint, skippers for the hidden bays, chefs, hikers and driver-guides. Request a date — the guide confirms before anything is paid." />
      <div className="filters card pad">
        <div className="filter-row"><span className="label"><Languages size={14} /> Language</span>
          <div className="chips">{facets.languages.map((l) => <button key={l} className={`chip sm ${params.get("language") === l ? "on" : ""}`} onClick={() => set("language", l)}>{l}</button>)}</div>
        </div>
        <div className="filter-row"><span className="label"><Award size={14} /> Speciality</span>
          <div className="chips">{facets.specialties.map((s) => <button key={s} className={`chip sm ${params.get("specialty") === s ? "on" : ""}`} onClick={() => set("specialty", s)}>{s}</button>)}</div>
        </div>
        <div className="filter-row"><span className="label"><Car size={14} /> Transport</span>
          <div className="chips">
            <button className={`chip sm ${params.get("vehicle") ? "on" : ""}`} onClick={() => set("vehicle", "true")}>Has a vehicle</button>
            {[4, 8, 12].map((n) => <button key={n} className={`chip sm ${params.get("group") === String(n) ? "on" : ""}`} onClick={() => set("group", String(n))}><UsersRound size={13} /> {n}+ people</button>)}
          </div>
        </div>
      </div>
      {hasSample && <Alert kind="info">These are sample guide profiles that show how the marketplace works. Meg'Rooms will replace them with vetted local guides before launch.</Alert>}
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
                    {g.licensed && <span className="badge sea"><BadgeCheck size={12} /> Licensed</span>}
                    {g.has_vehicle && <span className="badge olive"><Car size={12} /> Vehicle</span>}
                    {g.is_sample && <span className="badge">Sample profile</span>}
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
      {data && !data.guides.length && <div className="empty">No guides match those filters yet.</div>}
    </div>
  );
}

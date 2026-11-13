import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Ticket, Car, Clock, MapPin, Users, Settings2, MessageSquare, Store } from "lucide-react";
import { useApi } from "../lib/useApi";
import { useGuidesOn, usePartnersOn } from "../lib/useConfig";
import { useDestinations } from "../lib/useDestinations";
import { euro } from "../lib/format";
import SceneArt from "../components/art/SceneArt";
import { PageHeader, Segmented, Skeleton, Alert } from "../components/ui";
import EnquirySheet from "../components/business/EnquirySheet";
import { tr } from "../i18n";

const CATS = { all: "All", history: "History", nature: "Nature", boat: "Boat", food: "Food", active: "Active", culture: "Culture" };

export default function Experiences() {
  const [tab, setTab] = useState("tours");
  const [cat, setCat] = useState("all");
  const [type, setType] = useState("all");
  const [ask, setAsk] = useState(null);
  const guides = useGuidesOn();
  const partnersOn = usePartnersOn();
  const { data: tours } = useApi("/tours/");
  const { data: cars } = useApi("/car_rentals/");
  const { bySlug } = useDestinations();
  useEffect(() => { document.title = "Experiences & cars · Saranda Companion"; }, []);
  const shownTours = useMemo(() => (tours || []).filter((t) => cat === "all" || t.category === cat), [tours, cat]);
  const shownCars = useMemo(() => (cars || []).filter((c) => type === "all" || c.car_type === type), [cars, type]);
  const carTypes = useMemo(() => ["all", ...new Set(["Hatchback", "Sedan", "SUV", ...(cars || []).map((c) => c.car_type)])], [cars]);
  return (
    <div className="page container">
      <PageHeader eyebrow={tr("Experiences & transport")} icon={Ticket} title={tr("Things to do, ways to get there")} lead={`Day tours around Sarandë and rental cars for the Riviera road.${guides ? " For a private day, pair any of these with a local guide." : ""}`} />
      <Segmented layoutId="exp" value={tab} onChange={setTab} options={[{ value: "tours", label: "Experiences" }, { value: "cars", label: "Rentals" }]} />
      {tab === "tours" ? (
        <>
          <div className="chips" style={{ margin: "18px 0" }}>{Object.entries(CATS).map(([k, v]) => <button key={k} className={`chip sm ${cat === k ? "on" : ""}`} onClick={() => setCat(k)}>{tr(v)}</button>)}</div>
          <div className="grid" style={{ "--min": "280px" }}>
            {!tours && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={320} r={26} />)}
            {shownTours.map((t, i) => {
              const d = bySlug[t.destination_slug];
              return (
                <motion.article key={t.id} className="exp-card card" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.05 }}>
                  <div className="exp-art"><SceneArt scene={d?.scene || "harbor"} seed={`tour-${t.id}`} /><span className="badge glass">{tr(CATS[t.category] || t.category)}</span></div>
                  <div className="exp-body">
                    <h3>{t.tour_name}</h3>
                    {t.business && <Link className="tiny by-biz" to={`/partners/${t.business.slug}`}><Store size={12} /> {t.business.name}</Link>}
                    <p className="small muted clamp-3">{t.description}</p>
                    <div className="row small muted" style={{ gap: 12 }}>
                      {t.duration_hours && <span><Clock size={14} /> {t.duration_hours}h</span>}
                      {d && <Link to={`/explore/${d.slug}`}><MapPin size={14} /> {d.name}</Link>}
                    </div>
                    <div className="row between" style={{ marginTop: 10 }}>
                      <span><b>{euro(t.price)}</b> <span className="small muted">{tr("pp")}</span></span>
                      {t.business
                        ? <button type="button" className="btn sm" onClick={() => setAsk({ business: t.business, kind: "experience", listing: { id: t.id, name: t.tour_name } })}><MessageSquare size={14} /> {tr("Ask to book")}</button>
                        : guides && <Link className="btn sm" to={`/guides${t.category === "boat" ? "?specialty=Boat" : t.category === "history" ? "?specialty=History" : t.category === "food" ? "?specialty=Food" : ""}`}><Users size={14} /> {tr("Find a guide")}</Link>}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="chips" style={{ margin: "18px 0" }}>{carTypes.map((k) => <button key={k} className={`chip sm ${type === k ? "on" : ""}`} onClick={() => setType(k)}>{tr(k === "all" ? "All" : k)}</button>)}</div>
          <Alert kind="info">{tr("Rental cars typically cost €30–€70+ per day depending on season, car and insurance. Choose accommodation with parking if you're driving.")}</Alert>
          <div className="car-list">
            {!cars && <Skeleton h={300} r={26} />}
            {shownCars.map((c) => (
              <div key={c.id} className="car-row card">
                <span className="car-icon"><Car size={22} /></span>
                <div className="car-main"><b>{c.car_model}</b><span className="tiny muted">{c.business ? <Link to={`/partners/${c.business.slug}`}>{c.business.name}</Link> : c.rental_company} · {c.location}</span></div>
                <span className="small muted hide-mobile"><Users size={14} /> {c.seats || 5}</span>
                <span className="small muted hide-mobile"><Settings2 size={14} /> {c.transmission || tr("manual")}</span>
                <span className="badge">{c.car_type}</span>
                <span className="car-price"><b>{euro(c.price_per_day)}</b><span className="tiny muted">{tr("/day")}</span></span>
                {c.business && <button type="button" className="btn sm" onClick={() => setAsk({ business: c.business, kind: "rental", listing: { id: c.id, name: c.car_model } })}><MessageSquare size={14} /> {tr("Ask")}</button>}
              </div>
            ))}
          </div>
        </>
      )}
      {partnersOn && (
        <div className="card pad biz-cta">
          <div>
            <b>{tr("Offer tours or rentals around here?")}</b>
            <p className="small muted" style={{ margin: "4px 0 0" }}>{tr("Add your business and list them here for free. Guests contact you directly.")}</p>
          </div>
          <Link className="btn" to="/business"><Store size={16} /> {tr("List your business")}</Link>
        </div>
      )}
      <EnquirySheet target={ask} onClose={() => setAsk(null)} />
    </div>
  );
}

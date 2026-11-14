// Guest-facing pages for partner businesses: the directory and one business's profile.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BedDouble, Car, Clock, Globe, Mail, MapPin, MessageCircle, MessageSquare, Phone, ShieldCheck, Store, Ticket, Users } from "lucide-react";
import { useApi } from "../lib/useApi";
import { usePartnersOn, whatsappUrl } from "../lib/useConfig";
import { euro } from "../lib/format";
import { thumb } from "../lib/photos";
import GuideAvatar from "../components/art/GuideAvatar";
import SceneArt from "../components/art/SceneArt";
import EnquirySheet from "../components/business/EnquirySheet";
import { BusinessHero, BusinessLook } from "../components/business/BusinessLook";
import { ErrorState, PageHeader, Skeleton } from "../components/ui";
import { loc, rich, tr } from "../i18n";

const COUNT_LABEL = { stays: ["stay", BedDouble], rentals: ["rental", Car], experiences: ["activity", Ticket] };

function ListYours() {
  return (
    <div className="card pad biz-cta">
      <div>
        <b>{tr("Run a business here?")}</b>
        <p className="small muted" style={{ margin: "4px 0 0" }}>{tr("Add your apartments, rentals or activities in one place. It's free, and guests contact you directly.")}</p>
      </div>
      <Link className="btn primary" to="/business"><Store size={16} /> {tr("List your business")}</Link>
    </div>
  );
}

export function PartnerDirectory() {
  const on = usePartnersOn();
  const { data, error } = useApi(on ? "/businesses/" : null);
  useEffect(() => { document.title = "Local businesses · Saranda Companion"; }, []);
  const rows = data?.businesses || [];
  return (
    <div className="page container">
      <PageHeader eyebrow={tr("Local businesses")} icon={Store} title={tr("Book with people who live here")} lead={tr("Hosts, rental shops and tour operators from Sarandë and the Riviera. We check every business before it appears; you deal with them directly.")} />
      {error && <ErrorState error={error} />}
      <div className="grid" style={{ "--min": "300px" }}>
        {on && !data && !error && [0, 1, 2].map((i) => <Skeleton key={i} h={190} r={26} />)}
        {rows.map((b, i) => (
          <motion.div key={b.slug} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`/partners/${b.slug}`} className="card pad hover biz-card">
              <div className="row nowrap" style={{ gap: 14 }}>
                <GuideAvatar name={b.name} palette={b.palette} size={56} />
                <div style={{ minWidth: 0 }}>
                  <h3>{b.name}</h3>
                  <span className="tiny muted"><MapPin size={12} /> {b.city}</span>
                </div>
              </div>
              {loc(b, "tagline") && <p className="small muted clamp-2">{loc(b, "tagline")}</p>}
              <div className="chips">
                {Object.entries(b.counts).filter(([, n]) => n > 0).map(([k, n]) => {
                  const [word, Icon] = COUNT_LABEL[k];
                  return <span key={k} className="chip sm"><Icon size={13} /> {n} {n === 1 ? word : k === "experiences" ? "activities" : `${word}s`}</span>;
                })}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      {data && !rows.length && <div className="empty">{tr("No businesses are listed yet — the first ones are being checked.")}</div>}
      {!on && <div className="empty">{tr("The business directory isn't available on this copy of the site.")}</div>}
      {on && <ListYours />}
    </div>
  );
}

export function PartnerProfile() {
  const { slug } = useParams();
  const { data, error } = useApi(`/businesses/${slug}`);
  const [ask, setAsk] = useState(null);
  const b = data?.business;
  useEffect(() => { if (b) document.title = `${b.name} · Saranda Companion`; }, [b]);
  if (error) return <div className="page container"><ErrorState error={error} /></div>;
  if (!b) return <div className="page container"><Skeleton h={420} r={26} /></div>;
  const { stays, rentals, experiences } = data.listings;
  const brief = { slug: b.slug, name: b.name };
  const wa = whatsappUrl(b.whatsapp, `Hello ${b.name}! I found you on Saranda Companion.`);
  return (
    <BusinessLook palette={b.palette} look={b.style} className="page biz-page">
      <div className="container biz-profile">
      <BusinessHero business={b}>
        <button type="button" className="btn primary" onClick={() => setAsk({ business: brief, kind: "general" })}><MessageSquare size={16} /> {tr("Ask a question")}</button>
        {wa && <a className="btn whatsapp" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> {tr("WhatsApp")}</a>}
        {b.phone && <a className="btn" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`}><Phone size={16} /> {b.phone}</a>}
        {b.email && <a className="btn" href={`mailto:${b.email}`}><Mail size={16} /> {tr("Email")}</a>}
        {b.website && <a className="btn" href={b.website} target="_blank" rel="noopener noreferrer nofollow ugc"><Globe size={16} /> {tr("Website")}</a>}
      </BusinessHero>
      {loc(b, "description") && <p className="biz-about">{loc(b, "description")}</p>}

      {stays.length > 0 && (
        <section className="stack">
          <h2 className="h3"><BedDouble size={20} /> {tr("Places to stay")}</h2>
          <div className="grid" style={{ "--min": "280px" }}>
            {stays.map((h) => (
              <Link key={h.id} to={`/stays/${h.id}`} className="stay-card card hover">
                <div className="stay-art">{h.image_urls?.[0] ? <img src={thumb(h.image_urls[0])} alt={loc(h, "hotel_name")} loading="lazy" /> : <SceneArt scene="harbor" seed={`apt-${h.id}`} variant="golden" />}</div>
                <div className="stay-body">
                  <h3>{loc(h, "hotel_name")}</h3>
                  <p className="small muted clamp-2">{loc(h, "description")}</p>
                  <div className="row between">
                    <span><b className="stay-price">{euro(h.price_per_night)}</b> <span className="small muted">{tr("/ night")}</span></span>
                    <span className="btn sm">{tr("View")} <ArrowRight size={14} /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {experiences.length > 0 && (
        <section className="stack">
          <h2 className="h3"><Ticket size={20} /> {tr("Activities & tours")}</h2>
          <div className="grid" style={{ "--min": "280px" }}>
            {experiences.map((t) => (
              <article key={t.id} className="card pad stack" style={{ "--gap": "8px" }}>
                {t.image_urls?.[0] && <img className="card-photo" src={thumb(t.image_urls[0])} alt={loc(t, "tour_name")} loading="lazy" />}
                <div className="row between"><h3 style={{ margin: 0 }}>{loc(t, "tour_name")}</h3><span className="badge">{t.category}</span></div>
                <p className="small muted clamp-3" style={{ margin: 0 }}>{loc(t, "description")}</p>
                <span className="small muted">{t.duration_hours ? <><Clock size={14} /> {t.duration_hours}h · </> : null}<MapPin size={14} /> {t.location}</span>
                <div className="row between">
                  <span><b>{euro(t.price)}</b> <span className="small muted">{tr("per person")}</span></span>
                  <button type="button" className="btn sm" onClick={() => setAsk({ business: brief, kind: "experience", listing: { id: t.id, name: t.tour_name } })}><MessageSquare size={14} /> {tr("Ask to book")}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {rentals.length > 0 && (
        <section className="stack">
          <h2 className="h3"><Car size={20} /> {tr("Rentals")}</h2>
          <div className="car-list">
            {rentals.map((c) => (
              <div key={c.id} className="car-row card">
                {c.image_urls?.[0] ? <img className="car-icon photo" src={thumb(c.image_urls[0])} alt={loc(c, "car_model")} loading="lazy" /> : <span className="car-icon"><Car size={22} /></span>}
                <div className="car-main"><b>{loc(c, "car_model")}</b><span className="tiny muted">{c.location}{loc(c, "description") ? ` · ${loc(c, "description")}` : ""}</span></div>
                {c.seats && <span className="small muted hide-mobile"><Users size={14} /> {c.seats}</span>}
                <span className="badge">{c.car_type}</span>
                <span className="car-price"><b>{euro(c.price_per_day)}</b><span className="tiny muted">{tr("/day")}</span></span>
                <button type="button" className="btn sm" onClick={() => setAsk({ business: brief, kind: "rental", listing: { id: c.id, name: c.car_model } })}><MessageSquare size={14} /> {tr("Ask")}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!stays.length && !rentals.length && !experiences.length && <div className="empty">{tr("This business hasn't listed anything yet. You can still ask them a question.")}</div>}
      <p className="small muted"><ShieldCheck size={14} /> {rich("{name} is an independent business. You arrange and pay with them directly; see our <a>booking terms</a>.", { a: (c) => <Link to="/terms#partners">{c}</Link> }, { name: b.name })}</p>
      </div>
      <EnquirySheet target={ask} onClose={() => setAsk(null)} />
    </BusinessLook>
  );
}

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BedDouble, Bath, Users, Star, ArrowRight, MapPin, Waves, Store } from "lucide-react";
import { useApi } from "../lib/useApi";
import { euro } from "../lib/format";
import { thumb } from "../lib/photos";
import SceneArt from "../components/art/SceneArt";
import { PageHeader, Skeleton } from "../components/ui";
import { rich, tr } from "../i18n";

const VARIANTS = ["day", "golden", "sunset", "dusk", "day"];

function StayCard({ h, i }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
      <Link to={`/stays/${h.id}`} className="stay-card card hover">
        <div className="stay-art">
          {h.image_urls?.[0] ? <img src={thumb(h.image_urls[0])} alt={h.hotel_name} loading="lazy" /> : <SceneArt scene="harbor" seed={`apt-${h.id}`} variant={VARIANTS[i % VARIANTS.length]} />}
          {h.business ? <span className="badge glass stay-tag"><Store size={12} /> {h.business.name}</span> : h.tag && <span className="badge glass stay-tag">{h.tag}</span>}
          {h.airbnb_rating && <span className="stay-rating"><Star size={13} fill="currentColor" /> {h.airbnb_rating} <small>{h.rating_source}</small></span>}
        </div>
        <div className="stay-body">
          <h3>{h.apartment_name || h.hotel_name}</h3>
          <p className="small muted clamp-2">{h.description}</p>
          <div className="stay-facts small">
            <span><BedDouble size={14} /> {tr("{n} bd", { n: h.bedrooms })}</span>
            <span><Bath size={14} /> {tr("{n} ba", { n: h.bathrooms })}</span>
            <span><Users size={14} /> {tr("{n} guests", { n: h.max_guests })}</span>
            {h.business && <span><MapPin size={14} /> {h.city}</span>}
          </div>
          <div className="row between">
            <span><b className="stay-price">{euro(h.price_per_night)}</b> <span className="small muted">{tr("/ night")}</span></span>
            <span className="btn sm">{tr("View")} <ArrowRight size={14} /></span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Stays() {
  const { data } = useApi("/hotels/");
  useEffect(() => { document.title = "Meg'Rooms apartments · Sarandë"; }, []);
  const own = data?.filter((h) => !h.business);
  const partners = data?.filter((h) => h.business) || [];
  return (
    <div className="page container">
      <div className="stays-head">
        <PageHeader eyebrow={tr("Meg'Rooms · Sarandë")} icon={BedDouble} title={tr("Feels like home, on the Ionian")} lead={tr("Bright apartments steps from the Sarandë promenade — Butrint, Ksamil and the Blue Eye are all easy day trips. Book direct with the host.")} />
        <img src="/media/megrooms-logo.png" alt={tr("Meg'Rooms — feels like home")} className="stays-logo big" width="160" height="160" />
      </div>
      <div className="grid" style={{ "--min": "310px" }}>
        {!data && [0, 1, 2].map((i) => <Skeleton key={i} h={380} r={26} />)}
        {own?.map((h, i) => <StayCard key={h.id} h={h} i={i} />)}
      </div>
      <div className="card pad stays-why">
        <div><MapPin size={20} /><b>{tr("Central Sarandë")}</b><span className="small muted">{tr("Walk to the promenade, restaurants and the Corfu ferry.")}</span></div>
        <div><Waves size={20} /><b>{tr("Sea views")}</b><span className="small muted">{tr("Balconies and terraces facing the bay and Corfu.")}</span></div>
        <div><Star size={20} /><b>{tr("Loved by guests")}</b><span className="small muted">{tr("Highly rated on Airbnb and Booking.com.")}</span></div>
      </div>
      {partners.length > 0 && (
        <section className="stack partner-stays">
          <div>
            <div className="eyebrow"><Store size={14} /> {tr("From local hosts")}</div>
            <h2>{tr("More places to stay")}</h2>
            <p className="muted">{tr("Offered by independent businesses we've checked. You request the dates and pay the host directly.")} <Link to="/partners">{tr("See all local businesses")}</Link></p>
          </div>
          <div className="grid" style={{ "--min": "310px" }}>
            {partners.map((h, i) => <StayCard key={h.id} h={h} i={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}

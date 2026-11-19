import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Box, CalendarRange, Compass, Route, Users, BedDouble, BookOpen, Sparkles, ArrowRight, MapPin, Clock, Car, Ship, Sun, Star, Waves,
} from "lucide-react";
import { useApi } from "../lib/useApi";
import { useGuidesOn } from "../lib/useConfig";
import { useDestinations } from "../lib/useDestinations";
import { hm, hmRange, euro } from "../lib/format";
import { WeatherChip, WeatherCard } from "../components/live/Weather";
import { FxChip } from "../components/live/FxWidget";
import RouteSketch from "../components/art/RouteSketch";
import SceneArt from "../components/art/SceneArt";
import OceanHero from "../components/hero/OceanHero";
import ReelSection from "../components/media/ReelSection";
import GuideAvatar from "../components/art/GuideAvatar";
import { Skeleton } from "../components/ui";
import PlacePicker from "../components/ui/PlacePicker";
import { useUi } from "../store/ui";
import { useTrip } from "../store/trip";
import { loc, plural, rich, tr } from "../i18n";

const QUICK = [
  { to: "/plan", icon: CalendarRange, title: "Plan a trip", text: "Day-by-day timelines", grad: "var(--grad-sea)" },
  { to: "/routes", icon: Route, title: "Connect routes", text: "Any A → B, with times", grad: "var(--grad-sunset)" },
  { to: "/atlas", icon: Box, title: "3D atlas", text: "Fly over Albania", grad: "var(--grad-lagoon)" },
  { to: "/guides", icon: Users, title: "Local guides", text: "Pick your expert", grad: "var(--grad-olive)" },
  { to: "/stays", icon: BedDouble, title: "Meg'Rooms", text: "Sea-view apartments", grad: "var(--grad-terracotta)" },
  { to: "/essentials", icon: BookOpen, title: "Essentials", text: "Money, food, safety", grad: "var(--grad-aegean)" },
];
// Takes the guides tile's place until real guides are listed.
const EXPLORE_TILE = { to: "/explore", icon: Compass, title: "Explore", text: "Beaches, castles, towns", grad: "var(--grad-olive)" };

function HeroConnector() {
  const { list } = useDestinations();
  const navigate = useNavigate();
  const [from, setFrom] = useState("tirana");
  const [to, setTo] = useState("ksamil");
  const options = list.filter((d) => d.category !== "boat");
  return (
    <form className="hero-connector glass-card" onSubmit={(e) => { e.preventDefault(); navigate(`/routes?from=${from}&to=${to}`); }}>
      <div className="hc-field" data-pp-anchor>
        <span className="hc-dot a" />
        <PlacePicker id="hc-from" label={tr("From")} value={from} onChange={setFrom} places={options} />
      </div>
      <div className="hc-field" data-pp-anchor>
        <span className="hc-dot b" />
        <PlacePicker id="hc-to" label={tr("To")} value={to} onChange={setTo} places={list} />
      </div>
      <button className="btn sun"><Route size={18} /> {tr("How long?")}</button>
    </form>
  );
}

function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const openConcierge = useUi((s) => s.openConcierge);
  const guides = useGuidesOn();
  return (
    <section className="hero" ref={ref}>
      <OceanHero scrollProgress={scrollYProgress} surfaceRef={ref} />
      <div className="hero-overlay" />
      <motion.div className="container hero-content" style={{ opacity: fade }}>
        <motion.div className="eyebrow light" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <MapPin size={14} /> {tr("Sarandë · Albanian Riviera · 2027 edition")}
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          {rich("Albania, planned from <em>the Ionian coast.</em>", { em: (c) => <em>{c}</em> })}
        </motion.h1>
        <motion.p className="hero-lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
          {guides
            ? tr("Connect any two places with real drive times, build day-by-day timelines, estimate your budget, pick a local guide — and come home to a sea-view apartment.")
            : tr("Connect any two places with real drive times, build day-by-day timelines, estimate your budget — and come home to a sea-view apartment.")}
        </motion.p>
        <motion.div className="row hero-chips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <WeatherChip />
          <FxChip />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <HeroConnector />
        </motion.div>
        <motion.div className="row" style={{ marginTop: 18 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}>
          <Link to="/plan" className="btn primary lg"><CalendarRange size={20} /> {tr("Plan my trip")}</Link>
          <button className="btn glass lg" onClick={() => openConcierge()}><Sparkles size={20} /> {tr("Ask the concierge")}</button>
        </motion.div>
      </motion.div>
      <svg className="hero-wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path className="hw1" d="M0 70c120-30 240-40 360-20s240 50 360 40 240-50 360-50 240 30 360 30v70H0z" fill="var(--bg)" opacity="0.45" />
        <path className="hw2" d="M0 90c140-20 260-30 400-10s260 40 380 30 260-40 380-40 180 20 280 30v40H0z" fill="var(--bg)" />
      </svg>
    </section>
  );
}

function QuickActions() {
  const guides = useGuidesOn();
  const tiles = guides ? QUICK : QUICK.map((q) => (q.to === "/guides" ? EXPLORE_TILE : q));
  return (
    <section className="container quick-grid" aria-label={tr("Quick actions")}>
      {tiles.map((q, i) => (
        <motion.div key={q.to} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
          <Link to={q.to} className="quick card hover">
            <span className="quick-icon" style={{ background: q.grad }}><q.icon size={22} /></span>
            <span>
              <b>{tr(q.title)}</b>
              <span className="small muted">{tr(q.text)}</span>
            </span>
            <ArrowRight size={18} className="quick-arrow" />
          </Link>
        </motion.div>
      ))}
    </section>
  );
}

function Itineraries() {
  const { data } = useApi("/itineraries");
  const { name } = useDestinations();
  const load = useTrip((s) => s.loadItinerary);
  const navigate = useNavigate();
  const main = (data?.itineraries || []).filter((i) => [7, 10, 14].includes(i.days_count));
  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <div className="eyebrow">{tr("Choose your trip length")}</div>
          <h2>{tr("7, 10 or 14 days — ready to go")}</h2>
        </div>
        <Link to="/itineraries" className="btn sm">{tr("All itineraries")} <ArrowRight size={16} /></Link>
      </div>
      <div className="grid" style={{ "--min": "300px" }}>
        {!data && [0, 1, 2].map((i) => <Skeleton key={i} h={380} r={26} />)}
        {main.map((it, i) => (
          <motion.article key={it.slug} className={`itin-card card ${it.recommended ? "recommended" : ""}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
            <div className={`itin-top tone-${it.color}`}>
              <div className="itin-days"><b>{it.days_count}</b><span>{tr("days")}</span></div>
              {it.recommended && <span className="badge glass"><Star size={12} /> {tr("The sweet spot")}</span>}
              <RouteSketch path={it.path} labels={it.path.map(() => "")} width={300} height={150} className="itin-sketch" color="#fff" />
            </div>
            <div className="itin-body">
              <h3>{it.title}</h3>
              <p className="small muted">{it.tagline}</p>
              <div className="itin-stats">
                <span><Car size={14} /> {hmRange(it.stats.drive_minutes_min, it.stats.drive_minutes_max)}</span>
                <span><MapPin size={14} /> {it.stats.stops} places</span>
                <span><BedDouble size={14} /> {it.stats.hotel_changes} bases</span>
              </div>
              <div className="itin-bases small">{it.bases.map(name).join(" · ")}</div>
              <div className="row" style={{ marginTop: 14 }}>
                <Link to={`/itineraries/${it.slug}`} className="btn sm">{tr("Day by day")}</Link>
                <button className="btn primary sm" onClick={() => { load(it); navigate("/plan"); }}>{tr("Use this plan")}</button>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function SarandaBase() {
  const { data } = useApi("/destinations/sarande");
  const { bySlug } = useDestinations();
  const trips = (data?.connections || []).filter((c) => bySlug[c.slug]);
  return (
    <section className="section base-section">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow"><Waves size={14} /> {tr("Your Sarandë base")}</div>
            <h2>{tr("Split the south into easy day trips")}</h2>
            <p className="muted">{tr("Don't try to see everything in one afternoon — everything below is a short hop from our door.")}</p>
          </div>
          <Link to="/itineraries/sarande-3-day-base" className="btn sm">{tr("3-day base plan")} <ArrowRight size={16} /></Link>
        </div>
        <div className="h-scroll">
          {trips.map((c, i) => {
            const d = bySlug[c.slug];
            return (
              <motion.div key={c.slug} initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}>
                <Link to={`/explore/${c.slug}`} className="trip-tile card hover">
                  <SceneArt scene={d.scene} seed={d.slug} />
                  <div className="trip-tile-body">
                    <b>{d.name}</b>
                    <span className="row small" style={{ gap: 6 }}>
                      {c.mode === "drive" ? <Car size={14} /> : <Ship size={14} />}
                      {hmRange(c.min_minutes, c.max_minutes)} · {c.km_min === c.km_max ? c.km_min : `${c.km_min}–${c.km_max}`} km
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SeasonStrip() {
  const { data } = useApi("/essentials");
  const month = new Date().getMonth() + 1;
  if (!data) return <Skeleton h={220} r={26} />;
  const max = Math.max(...data.climate.map((c) => c.air_high));
  return (
    <div className="card pad season-card">
      <div className="panel-title"><h3><Sun size={18} /> {tr("When to go")}</h3><Link to="/essentials#seasons" className="small">{tr("Season guide")}</Link></div>
      <div className="season-bars" role="img" aria-label={tr("Typical air and sea temperatures by month in Sarandë")}>
        {data.climate.map((c) => (
          <div key={c.month} className={`sb ${c.month === month ? "now" : ""}`}>
            <span className="sb-air" style={{ height: `${(c.air_high / max) * 100}%` }}><i>{c.air_high}°</i></span>
            <span className="sb-sea" style={{ height: `${(c.sea / max) * 100}%` }} />
            <small>{"JFMAMJJASOND"[c.month - 1]}</small>
          </div>
        ))}
      </div>
      <div className="row tiny muted" style={{ gap: 14, marginTop: 8 }}>
        <span className="legend air">{tr("Air high")}</span><span className="legend sea">{tr("Sea")}</span>
      </div>
      <div className="seasons">
        {data.seasons.map((s) => (
          <div key={s.key} className="season"><b>{s.months}</b> <span className={`badge ${s.key === "september" ? "sea" : s.key === "peak" ? "terracotta" : s.key === "early-summer" ? "sun" : "olive"}`}>{s.verdict}</span></div>
        ))}
      </div>
    </div>
  );
}

function GuidesPreview() {
  const on = useGuidesOn();
  const { data } = useApi(on ? "/guides/" : null);
  const guides = (data?.guides || []).slice(0, 4);
  if (!on) return null;
  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <div className="eyebrow"><Users size={14} /> {tr("Local experts")}</div>
          <h2>{tr("Pick your guide")}</h2>
          <p className="muted">{tr("Archaeologists, skippers, chefs and drivers — request a date and they confirm.")}</p>
        </div>
        <Link to="/guides" className="btn sm">{tr("All guides")} <ArrowRight size={16} /></Link>
      </div>
      <div className="grid" style={{ "--min": "250px" }}>
        {!data && [0, 1, 2, 3].map((i) => <Skeleton key={i} h={200} r={26} />)}
        {guides.map((g) => (
          <Link key={g.slug} to={`/guides/${g.slug}`} className="card pad hover guide-mini">
            <GuideAvatar name={g.name} palette={g.palette} size={56} />
            <div>
              <b>{g.name}</b>
              <p className="small muted clamp-2">{loc(g, "headline")}</p>
              <span className="small">from <b>{euro(g.price_half_day)}</b> · {g.languages.slice(0, 3).join(", ")}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StaysBanner() {
  const { data } = useApi("/hotels/");
  const from = data?.length ? Math.min(...data.map((h) => h.price_per_night)) : null;
  return (
    <section className="container section">
      <div className="stays-banner">
        <div className="stays-banner-art"><SceneArt scene="harbor" seed="megrooms" variant="golden" /></div>
        <div className="stays-banner-body">
          <img src="/media/megrooms-logo.png" alt={tr("Meg'Rooms")} className="stays-logo" width="96" height="96" />
          <h2>{tr("Sleep by the sea in Sarandë")}</h2>
          <p>{tr("Apartments with Ionian views, steps from the promenade.")}{from ? ` ${tr("From {price} a night.", { price: euro(from) })}` : ""} {tr("Book direct, no platform fees.")}</p>
          <Link to="/stays" className="btn dark">{tr("See apartments")} <ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>
  );
}

function CorfuBanner() {
  return (
    <section className="container">
      <div className="corfu-banner">
        <div>
          <div className="eyebrow light"><Ship size={14} /> {tr("Greece + Albania")}</div>
          <h2>{tr("Corfu is just across the channel")}</h2>
          <p>{tr("2 nights Corfu + 3 nights Sarandë makes a perfect 5-day, two-country trip. Ferry schedules are seasonal — always check the current operator timetable.")}</p>
          <div className="row">
            <Link to="/itineraries/corfu-sarande-5" className="btn glass">{tr("5-day Corfu + Sarandë")}</Link>
            <Link to="/essentials#corfu" className="btn ghost" style={{ color: "#fff" }}>{tr("Ferry checklist")} <ArrowRight size={16} /></Link>
          </div>
        </div>
        <svg viewBox="0 0 200 120" className="corfu-art" aria-hidden="true">
          <path d="M20 30 C40 10 70 20 60 50 C55 70 30 80 25 60 Z" fill="rgba(255,255,255,.35)" />
          <path d="M150 20 C175 30 185 70 170 100 L200 100 L200 10 Z" fill="rgba(255,255,255,.35)" />
          <path d="M60 50 Q110 40 160 60" stroke="#fff" strokeWidth="2.5" strokeDasharray="4 7" fill="none" className="ferry-path" />
          <text x="18" y="96" fill="#fff" fontSize="10" fontWeight="800">CORFU</text>
          <text x="140" y="116" fill="#fff" fontSize="10" fontWeight="800">SARANDË</text>
        </svg>
      </div>
    </section>
  );
}

export default function Home() {
  useEffect(() => {
    document.title = "Saranda Companion · Meg'Rooms";
  }, []);
  return (
    <div className="page flush home">
      <Hero />
      <QuickActions />
      <ReelSection />
      <Itineraries />
      <SarandaBase />
      <section className="container section">
        <div className="split">
          <div className="card pad"><div className="panel-title"><h3><Clock size={18} /> {tr("Sarandë right now")}</h3></div><WeatherCard /></div>
          <SeasonStrip />
        </div>
      </section>
      <GuidesPreview />
      <StaysBanner />
      <CorfuBanner />
    </div>
  );
}

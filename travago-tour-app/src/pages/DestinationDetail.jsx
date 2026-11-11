import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Sparkles, MapPin, Car, Ship, Sailboat, ExternalLink, Star, Plus, Heart, Lightbulb, Navigation, BedDouble, Ticket, Users } from "lucide-react";
import { useApi } from "../lib/useApi";
import { hmRange, kmRange, euro } from "../lib/format";
import SceneArt from "../components/art/SceneArt";
import VideoLoop from "../components/media/VideoLoop";
import { clipsForPlace } from "../lib/media";
import GuideAvatar from "../components/art/GuideAvatar";
import { WeatherCard } from "../components/live/Weather";
import { CATEGORY_META, CategoryIcon, ErrorState, Sheet, Skeleton, toast } from "../components/ui";
import { useTrip } from "../store/trip";
import { useUi } from "../store/ui";
import AlbaniaMap from "../components/map/AlbaniaMap";
import { useDestinations } from "../lib/useDestinations";

const MODE_ICON = { drive: Car, ferry: Ship, boat: Sailboat };
const LINK_ICON = { stay: BedDouble, tour: Ticket, map: MapPin, directions: Navigation, ferry: Ship, car: Car };

function AddToTrip({ slug, name }) {
  const { days, addStop, set } = useTrip();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}><Plus size={18} /> Add to my trip</button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Add ${name} to…`} variant="center">
        <div className="stack" style={{ "--gap": "10px" }}>
          {days.map((d, i) => (
            <button key={d.id} className="day-pick card pad hover" onClick={() => { addStop(i, slug); set({ activeDay: i }); setOpen(false); toast(`Added to Day ${i + 1}`); }}>
              <b>Day {i + 1}</b> <span className="small muted">{d.title || d.stops.join(" → ")}</span>
            </button>
          ))}
          <Link to="/plan" className="btn" onClick={() => setOpen(false)}>Open the planner</Link>
        </div>
      </Sheet>
    </>
  );
}

function GooglePlace({ slug }) {
  const { data } = useApi(`/destinations/${slug}/place`);
  if (!data?.configured || !data.found) return null;
  return (
    <div className="gplace">
      <span className="gplace-rating"><Star size={16} fill="currentColor" /> {data.rating?.toFixed(1)}</span>
      <span className="small muted">{data.rating_count?.toLocaleString("en")} Google reviews</span>
      {data.open_now != null && <span className={`badge ${data.open_now ? "olive" : "terracotta"}`}>{data.open_now ? "Open now" : "Closed now"}</span>}
      {data.maps_url && <a className="small" href={data.maps_url} target="_blank" rel="noopener noreferrer">Google Maps <ExternalLink size={12} /></a>}
    </div>
  );
}

export default function DestinationDetail() {
  const { slug } = useParams();
  const { data: d, error, loading, reload } = useApi(`/destinations/${slug}`);
  const { data: links } = useApi(`/destinations/${slug}/links`);
  const { data: guides } = useApi(`/guides/?region=${d?.region || ""}`, [d?.region]);
  const { bySlug } = useDestinations();
  const fav = useTrip((s) => s.favorites.includes(slug));
  const toggle = useTrip((s) => s.toggleFavorite);
  const ask = useUi((s) => s.openConcierge);
  const clip = clipsForPlace(slug)[0];

  useEffect(() => {
    if (d) document.title = `${d.name} · Saranda Companion`;
  }, [d]);

  if (error) return <div className="page container"><ErrorState error={error} onRetry={reload} /></div>;
  if (loading || !d) return <div className="page container"><Skeleton h={420} r={30} /></div>;

  const meta = CATEGORY_META[d.category] || {};
  const nodes = [bySlug[d.slug], ...d.connections.map((c) => bySlug[c.slug])].filter(Boolean);
  return (
    <div className="page dest-page">
      <div className="container">
        <motion.div className="dest-hero" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
          {clip ? <VideoLoop clip={clip} className="dest-hero-video" eager /> : <SceneArt scene={d.scene} seed={d.slug} title={d.name} />}
          <div className="dest-hero-overlay">
            <div className="row" style={{ gap: 8 }}>
              <span className="badge glass"><CategoryIcon category={d.category} size={13} /> {meta.label}</span>
              <span className="badge glass">{d.region_name}</span>
              {d.unesco && <span className="badge glass">UNESCO World Heritage</span>}
              {d.access !== "road" && <span className="badge glass">{d.access === "boat" ? "Boat access" : "Ferry"}</span>}
            </div>
            <h1>{d.name}</h1>
            <p className="dest-hero-lead">{d.summary}</p>
          </div>
          {clip && (
            <span className="dest-hero-credit tiny">
              Video: <a href={clip.source} target="_blank" rel="noopener noreferrer">{clip.author}</a> · <a href={clip.license.url} target="_blank" rel="noopener noreferrer license">{clip.license.name}</a> · edited
            </span>
          )}
          <button className={`fav-btn big ${fav ? "on" : ""}`} onClick={() => toggle(slug)} aria-pressed={fav} aria-label="Save"><Heart size={22} fill={fav ? "currentColor" : "none"} /></button>
        </motion.div>

        <div className="split wide-left" style={{ marginTop: 28 }}>
          <div className="stack" style={{ "--gap": "22px" }}>
            <div className="stats">
              <div className="stat"><div className="stat-label"><Clock size={14} /> Suggested time</div><div className="stat-value">{hmRange(d.visit_min, d.visit_max)}</div></div>
              <div className="stat"><div className="stat-label"><Sparkles size={14} /> Best for</div><div className="stat-sub" style={{ fontWeight: 700, color: "var(--text)", marginTop: 6 }}>{d.best_for || meta.label}</div></div>
            </div>
            <GooglePlace slug={slug} />
            {d.planning_note && (
              <div className="tip-card"><Lightbulb size={20} /><div><b>Planner tip</b><p className="mb-0">{d.planning_note}</p></div></div>
            )}
            {d.highlights?.length > 0 && (
              <div className="card pad">
                <h3>Highlights</h3>
                <ul className="check-list">{d.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
            )}
            <div className="card pad">
              <div className="panel-title"><h3>Getting there & around</h3><Link to={`/routes?to=${slug}`} className="small">Route from anywhere →</Link></div>
              <div className="conn-list">
                {d.connections.map((c) => {
                  const Icon = MODE_ICON[c.mode];
                  return (
                    <Link key={c.slug} to={`/routes?from=${slug}&to=${c.slug}`} className="conn">
                      <span className={`conn-icon m-${c.mode}`}><Icon size={16} /></span>
                      <span className="conn-name">{c.name}</span>
                      <span className="conn-time">{hmRange(c.min_minutes, c.max_minutes)}</span>
                      <span className="conn-km small muted">{kmRange(c.km_min, c.km_max)}</span>
                      {c.source === "planner" && <span className="badge sea">Planner</span>}
                    </Link>
                  );
                })}
              </div>
              <div className="map-mini"><AlbaniaMap nodes={nodes} selected={slug} fit={nodes.map((n) => [n.lat, n.lng])} showNetwork={false} routes={d.connections.filter((c) => bySlug[c.slug]).map((c) => ({ coords: [[d.lat, d.lng], [bySlug[c.slug].lat, bySlug[c.slug].lng]], color: c.mode === "drive" ? "#0b5c7e" : "#19c3c0", dashed: c.mode !== "drive" }))} /></div>
            </div>
          </div>
          <aside className="stack sticky-col" style={{ "--gap": "18px" }}>
            <div className="card pad stack" style={{ "--gap": "12px" }}>
              <AddToTrip slug={slug} name={d.name} />
              <button className="btn" onClick={() => ask(`Tell me about ${d.name}: what to do and how to plan it`)}><Sparkles size={18} /> Ask about {d.name.split(" (")[0]}</button>
            </div>
            <div className="card pad"><h3>Weather</h3><WeatherCard place={slug} compact /></div>
            {links && (
              <div className="card pad">
                <h3>Book & navigate</h3>
                <p className="tiny muted">Pre-filled searches on each platform — compare and book where you prefer.</p>
                {Object.entries(links).map(([group, items]) => (
                  <div key={group} className="link-group">
                    {items.map((l) => {
                      const Icon = LINK_ICON[l.kind] || ExternalLink;
                      return (
                        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer sponsored" className="ext-link">
                          <Icon size={16} /> {l.provider} <ExternalLink size={13} className="faint" />
                        </a>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            {guides?.guides?.length > 0 && (
              <div className="card pad">
                <h3><Users size={18} /> Guides for this area</h3>
                <div className="stack" style={{ "--gap": "10px" }}>
                  {guides.guides.slice(0, 3).map((g) => (
                    <Link key={g.slug} to={`/guides/${g.slug}`} className="guide-row">
                      <GuideAvatar name={g.name} palette={g.palette} size={42} />
                      <span><b>{g.name}</b><span className="tiny muted block">{g.specialties.slice(0, 2).join(" · ")} · from {euro(g.price_half_day)}</span></span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

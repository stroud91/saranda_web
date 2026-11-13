import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Heart } from "lucide-react";
import SceneArt from "./art/SceneArt";
import { CATEGORY_META, CategoryIcon } from "./ui";
import { hmRange } from "../lib/format";
import { useTrip } from "../store/trip";
import { tr } from "../i18n";

export default function DestinationCard({ d, extra, index = 0 }) {
  const fav = useTrip((s) => s.favorites.includes(d.slug));
  const toggle = useTrip((s) => s.toggleFavorite);
  const meta = CATEGORY_META[d.category] || {};
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="dest-card card hover"
    >
      <Link to={`/explore/${d.slug}`} className="dest-link" aria-label={d.name}>
        <div className="dest-art">
          <SceneArt scene={d.scene} seed={d.slug} title={d.name} />
          <span className="dest-cat" style={{ "--c": meta.color }}>
            <CategoryIcon category={d.category} size={13} /> {meta.label}
          </span>
          {d.unesco && <span className="badge glass dest-unesco">{tr("UNESCO")}</span>}
        </div>
        <div className="dest-body">
          <h3>{d.name}</h3>
          <p className="small muted clamp-2">{d.summary}</p>
          <div className="row small" style={{ gap: 10 }}>
            <span className="row muted" style={{ gap: 5 }}><Clock size={14} /> {hmRange(d.visit_min, d.visit_max)}</span>
            {extra}
          </div>
        </div>
      </Link>
      <button className={`fav-btn ${fav ? "on" : ""}`} onClick={() => toggle(d.slug)} aria-pressed={fav} aria-label={fav ? `Remove ${d.name} from saved` : `Save ${d.name}`}>
        <Heart size={18} fill={fav ? "currentColor" : "none"} />
      </button>
    </motion.div>
  );
}

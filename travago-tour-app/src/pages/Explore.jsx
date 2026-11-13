import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Compass, Heart } from "lucide-react";
import { useDestinations } from "../lib/useDestinations";
import DestinationCard from "../components/DestinationCard";
import { CATEGORY_META, CategoryIcon, PageHeader, Skeleton } from "../components/ui";
import { useTrip } from "../store/trip";
import { normalize } from "../lib/text";
import { tr } from "../i18n";

export default function Explore() {
  const { list, regions, loading } = useDestinations();
  const favorites = useTrip((s) => s.favorites);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const cat = params.get("category") || "";
  const region = params.get("region") || "";
  const saved = params.get("saved") === "1";

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const items = useMemo(() => {
    const nq = normalize(q);
    return list.filter((d) =>
      (!cat || d.category === cat) &&
      (!region || d.region === region) &&
      (!saved || favorites.includes(d.slug)) &&
      (!nq || normalize(`${d.name} ${d.summary} ${d.tags.join(" ")} ${d.best_for}`).includes(nq))
    );
  }, [list, q, cat, region, saved, favorites]);

  return (
    <div className="page container">
      <PageHeader eyebrow={tr("Explore Albania")} icon={Compass} title={tr("Where the day could take you")} lead={tr("Beaches, UNESCO stone cities, boat-only bays and mountain villages — each with suggested visit times and honest planning notes.")} />
      <div className="explore-tools">
        <label className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search beaches, castles, villages…")} aria-label={tr("Search destinations")} />
        </label>
        <div className="chips scroll" role="toolbar" aria-label={tr("Category")}>
          <button className={`chip ${!cat && !saved ? "on" : ""}`} onClick={() => { setParam("category", ""); setParam("saved", ""); }}>{tr("All")}</button>
          <button className={`chip ${saved ? "on" : ""}`} onClick={() => setParam("saved", saved ? "" : "1")}><Heart size={14} /> Saved {favorites.length > 0 && `(${favorites.length})`}</button>
          {Object.entries(CATEGORY_META).filter(([k]) => k !== "hub").map(([k, m]) => (
            <button key={k} className={`chip ${cat === k ? "on" : ""}`} onClick={() => setParam("category", cat === k ? "" : k)}>
              <CategoryIcon category={k} size={14} /> {m.label}
            </button>
          ))}
        </div>
        <div className="chips scroll" role="toolbar" aria-label={tr("Region")}>
          {Object.entries(regions).map(([k, r]) => (
            <button key={k} className={`chip sm ${region === k ? "on" : ""}`} onClick={() => setParam("region", region === k ? "" : k)}>{r.name}</button>
          ))}
        </div>
      </div>
      <p className="small muted" aria-live="polite">{loading ? "Loading…" : `${items.length} place${items.length === 1 ? "" : "s"}`}</p>
      <div className="grid" style={{ "--min": "270px" }}>
        {loading && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={330} r={26} />)}
        {items.filter((d) => d.category !== "hub").map((d, i) => <DestinationCard key={d.slug} d={d} index={i} />)}
      </div>
      {!loading && !items.length && <div className="empty">{tr("No places match — try another filter.")}</div>}
    </div>
  );
}

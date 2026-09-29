import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Sheet, CategoryIcon, CATEGORY_META } from "../ui";
import { useDestinations } from "../../lib/useDestinations";
import { normalize } from "../../lib/text";

export default function StopPicker({ open, onClose, onPick, near }) {
  const { list, regions } = useDestinations();
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const nq = normalize(q);
    return list.filter((d) => !nq || normalize(d.name + " " + d.tags.join(" ")).includes(nq));
  }, [list, q]);
  const grouped = useMemo(() => {
    const g = {};
    for (const d of items) (g[d.region] ||= []).push(d);
    const order = near ? [list.find((d) => d.slug === near)?.region] : [];
    return Object.entries(g).sort(([a], [b]) => (order.includes(b) ? 1 : 0) - (order.includes(a) ? 1 : 0));
  }, [items, near, list]);
  return (
    <Sheet open={open} onClose={onClose} title="Add a stop">
      <label className="search" style={{ marginBottom: 14 }}>
        <Search size={18} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places…" aria-label="Search places" />
      </label>
      {grouped.map(([region, ds]) => (
        <div key={region} className="picker-group">
          <div className="eyebrow">{regions[region]?.name || region}</div>
          {ds.map((d) => (
            <button key={d.slug} className="picker-item" onClick={() => { onPick(d.slug); onClose(); }}>
              <span className="picker-icon" style={{ "--c": CATEGORY_META[d.category]?.color }}><CategoryIcon category={d.category} size={16} /></span>
              <span className="picker-text"><b>{d.name}</b><span className="tiny muted clamp-1">{d.best_for || d.summary}</span></span>
              <Plus size={18} className="faint" />
            </button>
          ))}
        </div>
      ))}
    </Sheet>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BedDouble, BookOpen, Box, CalendarRange, Clapperboard, Compass, CornerDownLeft, Map, MessageCircle, Moon, Route, Search, Sparkles, Store, Users,
} from "lucide-react";
import { useDestinations } from "../../lib/useDestinations";
import { CategoryIcon } from "../ui";
import { useUi } from "../../store/ui";
import { useGuidesOn, usePartnersOn } from "../../lib/useConfig";

const fold = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/\p{Mn}/gu, "");

const PAGES = [
  { id: "p-plan", label: "Plan a trip", hint: "Day-by-day timeline", icon: CalendarRange, to: "/plan", words: "planner itinerary days" },
  { id: "p-routes", label: "Connect two places", hint: "Drive & ferry times", icon: Route, to: "/routes", words: "route distance how long" },
  { id: "p-atlas", label: "3D atlas", hint: "Fly over Albania", icon: Box, to: "/atlas", words: "3d terrain mountains fly" },
  { id: "p-map", label: "Map", hint: "Every place & road", icon: Map, to: "/map", words: "map leaflet" },
  { id: "p-guides", label: "Local guides", hint: "Pick your expert", icon: Users, to: "/guides", words: "guide tour" },
  { id: "p-stays", label: "Meg'Rooms apartments", hint: "Sea-view stays", icon: BedDouble, to: "/stays", words: "hotel apartment room stay book" },
  { id: "p-ess", label: "Essentials", hint: "Money, food, safety", icon: BookOpen, to: "/essentials", words: "money food safety emergency packing" },
  { id: "p-explore", label: "Explore destinations", hint: "Beaches, castles, villages", icon: Compass, to: "/explore", words: "places beaches" },
  { id: "p-itins", label: "Ready-made itineraries", hint: "7, 10 and 14 days", icon: CalendarRange, to: "/itineraries", words: "week ideas" },
  { id: "p-films", label: "Films & video credits", hint: "Clips and licences", icon: Clapperboard, to: "/credits", words: "video credits licence" },
  { id: "p-partners", label: "Local businesses", hint: "Hosts, rentals and tours", icon: Store, to: "/partners", words: "business partner rental shop host operator", partners: true },
  { id: "p-business", label: "List your business", hint: "Business dashboard", icon: Store, to: "/business", words: "business owner partner add listing dashboard", partners: true },
  { id: "p-account", label: "My account", hint: "Bookings, trips and security", icon: Users, to: "/account", words: "sign in login account profile password bookings" },
  { id: "p-contact", label: "Contact us", hint: "WhatsApp or email", icon: MessageCircle, to: "/contact", words: "email whatsapp help" },
];

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { list, regions } = useDestinations();
  const openConcierge = useUi((s) => s.openConcierge);
  const toggleTheme = useUi((s) => s.cycleTheme || s.toggleTheme);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQ("");
    setActive(0);
    const before = document.activeElement;
    requestAnimationFrame(() => input.current?.focus());
    return () => before?.focus?.();
  }, [open]);

  const guidesOn = useGuidesOn();
  const partnersOn = usePartnersOn();
  const items = useMemo(() => {
    const pages = PAGES.filter((p) => (guidesOn || p.to !== "/guides") && (partnersOn || !p.partners));
    const actions = [
      { id: "a-ask", label: q ? `Ask the concierge: “${q}”` : "Ask the concierge", hint: "Offline travel assistant", icon: Sparkles, run: () => openConcierge(q || undefined), words: "ask question help" , always: Boolean(q) },
      ...(toggleTheme ? [{ id: "a-theme", label: "Switch light / dark theme", hint: "Appearance", icon: Moon, run: toggleTheme, words: "dark light theme night" }] : []),
    ];
    const places = list.map((d) => ({ id: `d-${d.slug}`, label: d.name, hint: regions[d.region]?.name || regions[d.region] || d.region, category: d.category, to: `/explore/${d.slug}`, words: `${d.tags?.join(" ") || ""} ${d.category}` }));
    const all = [...pages, ...places, ...actions];
    const terms = fold(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return [...pages.slice(0, 7), ...actions.filter((a) => !a.always)];
    const scored = all
      .map((it) => {
        const label = fold(it.label), hay = `${label} ${fold(it.hint)} ${fold(it.words)}`;
        if (!it.always && !terms.every((t) => hay.includes(t))) return null;
        const score = (label.startsWith(terms[0]) ? 3 : 0) + (label.includes(terms[0]) ? 2 : 0) + (it.id.startsWith("d-") ? 1 : 0) - (it.always ? 5 : 0);
        return { it, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it);
    return scored.slice(0, 12);
  }, [q, list, regions, openConcierge, toggleTheme, guidesOn, partnersOn]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;
  const choose = (it) => {
    onClose();
    if (it.to) navigate(it.to);
    else it.run?.();
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); choose(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return createPortal(
    <div className="cmdk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div className="cmdk" role="dialog" aria-modal="true" aria-label="Search" initial={{ opacity: 0, scale: 0.97, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <div className="cmdk-input">
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search places, pages, or ask anything…"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={items[active] ? `cmdk-${items[active].id}` : undefined}
            aria-autocomplete="list"
          />
          <kbd>esc</kbd>
        </div>
        <ul className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {items.map((it, i) => (
            <li
              key={it.id}
              id={`cmdk-${it.id}`}
              data-i={i}
              role="option"
              aria-selected={i === active}
              className={i === active ? "on" : ""}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(it)}
            >
              <span className="cmdk-icon">{it.icon ? <it.icon size={17} /> : <CategoryIcon category={it.category} size={17} />}</span>
              <span className="cmdk-text"><b>{it.label}</b>{it.hint && <span className="tiny muted">{it.hint}</span>}</span>
              {i === active && <CornerDownLeft size={15} className="cmdk-enter" aria-hidden="true" />}
            </li>
          ))}
          {!items.length && <li className="cmdk-empty muted small">No matches — try a town, beach or castle.</li>}
        </ul>
        <div className="cmdk-foot tiny muted"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>K</kbd> anywhere</span></div>
      </motion.div>
    </div>,
    document.body
  );
}

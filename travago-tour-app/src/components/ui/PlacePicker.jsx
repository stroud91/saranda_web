import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { CATEGORY_META, CategoryIcon } from "./index";
import { locale, tr } from "../../i18n";

// A place picker drawn by the site itself, so it looks the same in every browser and theme.
// A native <select> opens a list the browser draws: on Windows it opens white while the
// text keeps the site's colour, so in dark mode and on the hero the names fade out.
//
// It follows the ARIA combobox pattern: the trigger is a button; the open panel has a
// search box (role=combobox) that points at the highlighted option of a grouped listbox.

// Group order and headings. Anything else goes under "Other places".
const GROUPS = [
  ["city", "Towns & cities"],
  ["hub", "Airport"],
  ["beach", "Beaches"],
  ["history", "History"],
  ["nature", "Nature"],
  ["viewpoint", "Viewpoints"],
  ["village", "Villages"],
  ["food", "Food & wine"],
  ["boat", "Boat-only bays"],
];
const ORDER = Object.fromEntries(GROUPS.map(([key], i) => [key, i]));
const HEADING = Object.fromEntries(GROUPS);

/** Lower case without accents, so "sarande" finds "Sarandë" and "gjirokaster" finds "Gjirokastër". */
export const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Places matching the search, grouped by kind in a fixed order, A to Z inside each group. */
export function groupPlaces(places, query = "") {
  const q = fold(query).trim();
  const byName = new Intl.Collator(locale(), { sensitivity: "base" });
  const groups = new Map();
  for (const place of places) {
    if (q && !fold(place.name).includes(q)) continue;
    const key = place.category in ORDER ? place.category : "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(place);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (ORDER[a] ?? GROUPS.length) - (ORDER[b] ?? GROUPS.length))
    .map(([key, list]) => ({ key, heading: HEADING[key] || "Other places", places: list.sort((a, b) => byName.compare(a.name, b.name)) }));
}

const GAP = 6;
const MARGIN = 12;

/**
 * value/onChange take a place's slug. `places` is [{ slug, name, category }].
 * `label` names the field for screen readers ("From"). Pass children to draw your own
 * trigger (e.g. an "Add a stop" chip); `tone="dark"` keeps the list dark on dark panels.
 * The list opens under the closest element marked data-pp-anchor (the whole field).
 */
export default function PlacePicker({ id, value, onChange, places, label, placeholder, tone, className = "", children }) {
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (slug) => `${listId}-${slug}`;
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const groups = useMemo(() => groupPlaces(places || [], query), [places, query]);
  const items = useMemo(() => groups.flatMap((g) => g.places), [groups]);
  const selected = (places || []).find((p) => p.slug === value);
  const current = items[active];

  const close = useCallback((refocus) => {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }, []);


  const choose = (place) => {
    if (!place) return;
    onChange(place.slug);
    close(true);
  };

  // Place the panel under the field, or above it when there's more room there.
  // Lines up with the whole field when the page marks one with data-pp-anchor.
  const measure = useCallback(() => {
    const el = triggerRef.current?.closest("[data-pp-anchor]") || triggerRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 280), vw - 2 * MARGIN);
    const left = Math.min(Math.max(r.left, MARGIN), vw - MARGIN - width);
    const below = vh - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    const up = below < 260 && above > below;
    const maxHeight = Math.max(160, Math.min(420, up ? above : below));
    return up ? { left, width, bottom: vh - r.top + GAP, maxHeight } : { left, width, top: r.bottom + GAP, maxHeight };
  }, []);
  const place = useCallback(() => setPos(measure()), [measure]);

  const openWith = (text = "") => {
    setQuery(text);
    const start = text ? 0 : Math.max(0, groupPlaces(places || []).flatMap((g) => g.places).findIndex((p) => p.slug === value));
    setActive(start);
    setPos(measure());
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    const onScroll = (e) => { if (!panelRef.current?.contains(e.target)) place(); };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", onScroll, true); };
  }, [open, place]);

  // Typing goes straight into the search box. On touch screens the box only takes the
  // focus when tapped, so the keyboard doesn't cover the list.
  useEffect(() => {
    if (!open) return;
    const touch = Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);
    if (touch && !inputRef.current?.value) panelRef.current?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  // A click anywhere else closes it, leaving the focus where the click put it.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  const activeSlug = open ? current?.slug : null;
  useEffect(() => {
    if (activeSlug) document.getElementById(`${listId}-${activeSlug}`)?.scrollIntoView({ block: "nearest" });
  }, [activeSlug, listId]);

  const onTriggerKey = (e) => {
    if (open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openWith();
    } else if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openWith(e.key); // start searching with the letter typed
    }
  };

  const onPanelKey = (e) => {
    const n = items.length;
    const inInput = e.target === inputRef.current;
    const move = (to) => { e.preventDefault(); e.stopPropagation(); if (n) setActive(Math.max(0, Math.min(n - 1, to))); };
    switch (e.key) {
      case "ArrowDown": return move(active + 1);
      case "ArrowUp": return move(active - 1);
      case "PageDown": return move(active + 8);
      case "PageUp": return move(active - 8);
      case "Home": if (!inInput || !query) move(0); return undefined;
      case "End": if (!inInput || !query) move(n - 1); return undefined;
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        return choose(current);
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        return close(true);
      case "Tab":
        // Back to the field, then let the browser move on from there as usual.
        close(true);
        return undefined;
      default:
        if (!inInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) inputRef.current?.focus();
        return undefined;
    }
  };

  const shown = selected ? selected.name : placeholder || tr("Choose a place");
  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={children ? className : `pp-trigger ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label ? (children ? label : `${label}: ${shown}`) : undefined}
        onClick={() => (open ? close(false) : openWith())}
        onKeyDown={onTriggerKey}
      >
        {children || (
          <>
            <span className={`pp-value ${selected ? "" : "placeholder"}`}>{shown}</span>
            <ChevronDown className="pp-chevron" size={18} aria-hidden="true" />
          </>
        )}
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className={`pp-panel ${tone ? "theme-scope" : ""}`}
          data-theme={tone}
          style={pos || undefined}
          tabIndex={-1}
          onKeyDown={onPanelKey}
          data-testid="place-picker"
        >
          <div className="pp-search">
            <Search size={16} aria-hidden="true" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={current ? optionId(current.slug) : undefined}
              aria-label={label ? `${label}: ${tr("Search places")}` : tr("Search places")}
              placeholder={tr("Search places")}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
            />
          </div>
          <div className="pp-list" id={listId} role="listbox" aria-label={label || tr("Places")}>
            {!items.length && <p className="pp-empty" role="status">{tr("No place matches “{q}”", { q: query.trim() })}</p>}
            {groups.map((g) => (
              <div key={g.key} role="group" aria-labelledby={`${uid}-g-${g.key}`}>
                <div className="pp-group" id={`${uid}-g-${g.key}`} role="presentation">{tr(g.heading)}</div>
                {g.places.map((p) => {
                  const isActive = current?.slug === p.slug;
                  const color = (CATEGORY_META[p.category] || {}).color || "var(--accent)";
                  return (
                    <div
                      key={p.slug}
                      id={optionId(p.slug)}
                      role="option"
                      aria-selected={p.slug === value}
                      className={`pp-option ${isActive ? "active" : ""}`}
                      onPointerDown={(e) => e.preventDefault()} // keep the focus in the search box
                      onPointerMove={() => { if (!isActive) setActive(items.indexOf(p)); }}
                      onClick={() => choose(p)}
                    >
                      <span className="pp-icon" style={{ "--c": color }} aria-hidden="true"><CategoryIcon category={p.category} size={15} /></span>
                      <span className="pp-name">{p.name}</span>
                      {p.slug === value && <Check className="pp-check" size={16} aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

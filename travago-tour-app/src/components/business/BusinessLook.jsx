// How a business's public page looks. A "look" is a palette plus a few choices
// from fixed lists (see STYLE_OPTIONS on the server); this component turns them
// into classes and two colour variables. The same component draws the public
// page and the live preview in the dashboard, so what an owner tries is what
// guests get.
import { MapPin, Store } from "lucide-react";
import GuideAvatar, { PALETTES } from "../art/GuideAvatar";
import SceneArt from "../art/SceneArt";

export const DEFAULT_LOOK = { background: "plain", scene: "harbor", variant: "golden", cards: "soft" };

export const LOOK_CHOICES = {
  background: [
    { value: "plain", label: "Clean", hint: "The site's own background" },
    { value: "gradient", label: "Soft colour", hint: "A wash of your colours" },
    { value: "waves", label: "Waves", hint: "Rings like ripples on water" },
    { value: "dots", label: "Dots", hint: "A fine dotted grid" },
    { value: "scene", label: "Picture", hint: "An illustrated header" },
  ],
  scene: [
    { value: "harbor", label: "Harbour" }, { value: "beach", label: "Beach" }, { value: "cove", label: "Cove" },
    { value: "island", label: "Islands" }, { value: "castle", label: "Castle" }, { value: "ruins", label: "Ruins" },
    { value: "village", label: "Village" }, { value: "city", label: "Old town" }, { value: "mountain", label: "Mountains" },
    { value: "lake", label: "Lake" }, { value: "vineyard", label: "Vineyard" }, { value: "spring", label: "Spring" },
  ],
  variant: [
    { value: "day", label: "Midday" }, { value: "golden", label: "Golden hour" },
    { value: "sunset", label: "Sunset" }, { value: "dusk", label: "Dusk" },
  ],
  cards: [
    { value: "soft", label: "Soft cards", hint: "White cards with a shadow" },
    { value: "outline", label: "Outlined", hint: "See-through cards with a coloured edge" },
  ],
};

export const PALETTE_NAMES = { sea: "Sea", sunset: "Sunset", olive: "Olive", lagoon: "Lagoon", aegean: "Deep blue", spring: "Spring", terracotta: "Terracotta" };

/** Only known choices are ever used, whatever the data says. */
export function cleanLook(look) {
  const out = { ...DEFAULT_LOOK };
  for (const key of Object.keys(DEFAULT_LOOK)) {
    if (LOOK_CHOICES[key].some((c) => c.value === look?.[key])) out[key] = look[key];
  }
  return out;
}

export function BusinessLook({ palette, look, className = "", children, ...rest }) {
  const [a, b] = PALETTES[palette] || PALETTES.sea;
  const s = cleanLook(look);
  return (
    <div className={`biz-look bg-${s.background} cards-${s.cards} ${className}`} style={{ "--biz-a": a, "--biz-b": b }} {...rest}>
      {s.background === "scene" && (
        <div className="biz-look-scene" aria-hidden="true"><SceneArt scene={s.scene} seed={`look-${s.scene}`} variant={s.variant} animated={false} /></div>
      )}
      {children}
    </div>
  );
}

/** The header card of a business page: who they are and how to reach them. */
export function BusinessHero({ business: b, children }) {
  return (
    <header className="card pad biz-hero">
      <GuideAvatar name={b.name || "?"} palette={b.palette} size={88} />
      <div className="stack" style={{ "--gap": "8px", minWidth: 0 }}>
        <div className="eyebrow"><Store size={14} /> Local business{b.since ? ` · on Saranda Companion since ${b.since}` : ""}</div>
        <h1>{b.name || "Your business"}</h1>
        {b.tagline && <p className="lead" style={{ margin: 0 }}>{b.tagline}</p>}
        {(b.address || b.city) && <span className="small muted"><MapPin size={14} /> {[b.address, b.city].filter(Boolean).join(", ")}</span>}
        <div className="row">{children}</div>
      </div>
    </header>
  );
}

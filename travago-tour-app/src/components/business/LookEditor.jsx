import { useState } from "react";
import { BedDouble, MessageSquare, Phone, RotateCcw, Save, Ticket } from "lucide-react";
import { partnerPut } from "../../lib/partners";
import { euro } from "../../lib/format";
import { PALETTES } from "../art/GuideAvatar";
import SceneArt from "../art/SceneArt";
import { Alert, Segmented, toast } from "../ui";
import { BusinessHero, BusinessLook, LOOK_CHOICES, PALETTE_NAMES, cleanLook } from "./BusinessLook";

const vars = (palette) => ({ "--biz-a": PALETTES[palette][0], "--biz-b": PALETTES[palette][1] });

function Choice({ name, value, current, onPick, label, hint, children }) {
  return (
    <label className={`look-option ${current === value ? "on" : ""}`}>
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onPick(value)} />
      {children}
      <span className="look-option-text"><b>{label}</b>{hint && <span className="tiny muted">{hint}</span>}</span>
    </label>
  );
}

/**
 * Lets a business try out how its public page looks. Every click changes the
 * preview straight away; guests only see it after Save. The preview is drawn
 * by the same component as the real page.
 */
export default function LookEditor({ business, listings, onSaved }) {
  const saved = { palette: PALETTES[business.palette] ? business.palette : "sea", look: cleanLook(business.style) };
  const [draft, setDraft] = useState(saved);
  const [mode, setMode] = useState("site");
  const [state, setState] = useState({ busy: false, error: "" });
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const pick = (key) => (value) => setDraft((d) => (key === "palette" ? { ...d, palette: value } : { ...d, look: { ...d.look, [key]: value } }));

  const save = async () => {
    setState({ busy: true, error: "" });
    try {
      onSaved(await partnerPut("/partner/business", { palette: draft.palette, style: draft.look }));
      setState({ busy: false, error: "" });
      toast("Saved — guests now see this look");
    } catch (e) {
      setState({ busy: false, error: e.message });
    }
  };

  const { look, palette } = draft;
  const stay = listings.stays[0];
  const activity = listings.experiences[0];
  const preview = { ...business, palette };
  return (
    <div className="look-editor">
      <div className="look-controls card pad stack" style={{ "--gap": "20px" }}>
        <fieldset className="look-group">
          <legend>Background</legend>
          <div className="look-options">
            {LOOK_CHOICES.background.map((c) => (
              <Choice key={c.value} name="background" current={look.background} onPick={pick("background")} {...c}>
                <span className={`look-swatch biz-look bg-${c.value}`} style={vars(palette)}>
                  {c.value === "scene" && <SceneArt scene={look.scene} seed={`look-${look.scene}`} variant={look.variant} animated={false} />}
                </span>
              </Choice>
            ))}
          </div>
        </fieldset>

        {look.background === "scene" && (
          <>
            <fieldset className="look-group">
              <legend>Picture</legend>
              <div className="look-scenes">
                {LOOK_CHOICES.scene.map((c) => (
                  <label key={c.value} className={`look-scene ${look.scene === c.value ? "on" : ""}`} title={c.label}>
                    <input type="radio" name="scene" value={c.value} checked={look.scene === c.value} onChange={() => pick("scene")(c.value)} />
                    <SceneArt scene={c.value} seed={`look-${c.value}`} variant={look.variant} animated={false} />
                    <span className="tiny">{c.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="look-group">
              <legend>Time of day</legend>
              <div className="chips">
                {LOOK_CHOICES.variant.map((c) => (
                  <button key={c.value} type="button" className={`chip sm ${look.variant === c.value ? "on" : ""}`} aria-pressed={look.variant === c.value} onClick={() => pick("variant")(c.value)}>{c.label}</button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <fieldset className="look-group">
          <legend>Colours</legend>
          <div className="look-palettes">
            {Object.keys(PALETTES).map((p) => (
              <label key={p} className={`look-palette ${palette === p ? "on" : ""}`}>
                <input type="radio" name="palette" value={p} checked={palette === p} onChange={() => pick("palette")(p)} />
                <span className="look-dot" style={{ background: `linear-gradient(135deg, ${PALETTES[p][0]}, ${PALETTES[p][1]})` }} />
                <span className="tiny">{PALETTE_NAMES[p]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="look-group">
          <legend>Cards</legend>
          <div className="look-options two">
            {LOOK_CHOICES.cards.map((c) => <Choice key={c.value} name="cards" current={look.cards} onPick={pick("cards")} {...c} />)}
          </div>
        </fieldset>

        {state.error && <Alert kind="error">{state.error}</Alert>}
        <div className="row">
          <button type="button" className="btn primary" disabled={!dirty || state.busy} onClick={save}>{state.busy ? <span className="spinner" /> : <Save size={16} />} Save this look</button>
          <button type="button" className="btn" disabled={!dirty || state.busy} onClick={() => setDraft(saved)}><RotateCcw size={15} /> Undo</button>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>{dirty ? "You're trying a new look. Guests still see the saved one until you press Save." : "This is what guests see now."}</p>
      </div>

      <div className="look-preview">
        <div className="row between">
          <b>Live preview</b>
          <Segmented layoutId="look-mode" value={mode} onChange={setMode} options={[{ value: "site", label: "As set" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        </div>
        <div className="look-frame theme-scope" data-theme={mode === "site" ? undefined : mode} data-testid="look-preview">
          <BusinessLook palette={palette} look={look} className="look-page">
            <div className="biz-profile">
              <BusinessHero business={preview}>
                <span className="btn primary sm"><MessageSquare size={14} /> Ask a question</span>
                {business.phone && <span className="btn sm"><Phone size={14} /> {business.phone}</span>}
              </BusinessHero>
              {business.description && <p className="biz-about clamp-3">{business.description}</p>}
              <div className="look-samples">
                <div className="card pad stack" style={{ "--gap": "6px" }}>
                  <span className="eyebrow"><BedDouble size={13} /> Place to stay</span>
                  <b>{stay?.hotel_name || "Sea-view apartment"}</b>
                  <span className="small muted">{euro(stay?.price_per_night || 60)} / night</span>
                </div>
                <div className="card pad stack" style={{ "--gap": "6px" }}>
                  <span className="eyebrow"><Ticket size={13} /> Activity</span>
                  <b>{activity?.tour_name || "Boat trip to the islands"}</b>
                  <span className="small muted">{euro(activity?.price || 30)} per person</span>
                </div>
              </div>
            </div>
          </BusinessLook>
        </div>
        <p className="tiny muted">Guests see your page in light or dark depending on their own setting, so check both.</p>
      </div>
    </div>
  );
}

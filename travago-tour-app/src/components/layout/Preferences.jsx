import { useEffect, useRef, useState } from "react";
import { Check, Globe, MonitorSmartphone, Moon, Sun } from "lucide-react";
import { LANGS, currentLang } from "../../i18n";
import { useUi } from "../../store/ui";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: MonitorSmartphone },
];

/** Language and light/dark settings, one tap from every page. */
export default function Preferences() {
  const { theme, setTheme, setLang } = useUi();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const lang = currentLang();

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="prefs" ref={box}>
      <button type="button" className="icon-btn prefs-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" aria-label="Language and appearance" title="Language and appearance">
        <Globe size={17} aria-hidden="true" />
        <span className="prefs-code">{lang.toUpperCase()}</span>
      </button>
      {open && (
        <div className="prefs-pop" role="dialog" aria-label="Language and appearance">
          <div className="prefs-title" id="prefs-lang">Language</div>
          <div className="prefs-langs" role="radiogroup" aria-labelledby="prefs-lang">
            {LANGS.map((l) => (
              <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} lang={l.code} className={`prefs-lang ${lang === l.code ? "on" : ""}`} onClick={() => { setOpen(false); setLang(l.code); }}>
                <span>{l.name}</span>
                {lang === l.code && <Check size={15} aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="prefs-title" id="prefs-theme">Appearance</div>
          <div className="prefs-themes" role="radiogroup" aria-labelledby="prefs-theme">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" role="radio" aria-checked={theme === value} className={`prefs-theme ${theme === value ? "on" : ""}`} onClick={() => setTheme(value)}>
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

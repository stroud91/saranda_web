import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import SceneArt from "../art/SceneArt";
import Logo from "../art/Logo";
import { createOcean, webgl2Supported } from "../hero/ocean";
import { tr } from "../../i18n";

/**
 * Split layout for sign-in pages: the live Ionian Sea on one side (each page
 * gets its own time of day), the form on the other.
 */
export default function AuthShell({ hour = 19.2, eyebrow, title, lead, children, footer }) {
  const canvas = useRef(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!webgl2Supported()) {
      setFallback(true);
      return undefined;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ocean;
    try {
      ocean = createOcean(canvas.current, { animate: !reduce });
      ocean.setHour(hour, true);
    } catch {
      setFallback(true);
    }
    const el = canvas.current;
    const tap = (e) => ocean?.tap(e.clientX, e.clientY);
    el?.addEventListener("pointerdown", tap);
    return () => {
      el?.removeEventListener("pointerdown", tap);
      ocean?.destroy();
    };
  }, [hour]);

  return (
    <div className="auth-page">
      <div className="auth-art" aria-hidden="true">
        {fallback ? <SceneArt scene="harbor" seed="auth" variant="sunset" /> : <canvas ref={canvas} className="ocean-canvas" />}
        <div className="auth-art-shade" />
        <div className="auth-art-copy">
          <Logo />
          <p>{tr("Your trips, bookings and guides — kept together, wherever you sign in.")}</p>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {lead && <p className="muted">{lead}</p>}
          {children}
          {footer && <div className="auth-footer small">{footer}</div>}
          <p className="tiny faint auth-safe"><ShieldCheck size={13} /> Passwords are stored only as salted hashes. <Link to="/essentials">Travel essentials</Link></p>
        </div>
      </div>
    </div>
  );
}

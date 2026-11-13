import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Sunrise, Sunset, Volume2, VolumeX, Radio } from "lucide-react";
import SceneArt from "../art/SceneArt";
import { createOcean, webgl2Supported } from "./ocean";
import { plip, setSound, soundAvailable } from "../../lib/seaSound";
import { tr } from "../../i18n";

/** Current hour in Sarandë (Europe/Tirane), e.g. 18.5 for 18:30. */
export function sarandaHour(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Tirane", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === "hour").value);
    const m = Number(parts.find((p) => p.type === "minute").value);
    return h + m / 60;
  } catch {
    return date.getHours() + date.getMinutes() / 60;
  }
}

const fmtHour = (h) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
const moodOf = (h) => (h < 5.5 || h >= 20.5 ? ["Night", Moon] : h < 8 ? ["Sunrise", Sunrise] : h < 17 ? ["Daylight", Sun] : ["Golden hour", Sunset]);

const MIN_H = 0;
const MAX_H = 24;

export default function OceanHero({ scrollProgress, surfaceRef }) {
  const canvasRef = useRef(null);
  const ctl = useRef(null);
  const [mode, setMode] = useState("pending"); // pending | live | still | fallback
  const [hour, setHour] = useState(() => Math.min(MAX_H, Math.max(MIN_H, sarandaHour())));
  const [live, setLive] = useState(true);
  const [sound, setSoundOn] = useState(false);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!webgl2Supported()) {
      setMode("fallback");
      return undefined;
    }
    try {
      ctl.current = createOcean(canvasRef.current, { animate: !reduce });
      ctl.current.setHour(hour, true);
      setMode(reduce ? "still" : "live");
    } catch {
      setMode("fallback");
    }
    return () => {
      ctl.current?.destroy();
      ctl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    ctl.current?.setHour(hour);
  }, [hour]);

  // Follow the real clock in Sarandë until the guest takes over the dial.
  useEffect(() => {
    if (!live) return undefined;
    const tick = () => setHour(Math.min(MAX_H, Math.max(MIN_H, sarandaHour())));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (!scrollProgress) return undefined;
    return scrollProgress.on("change", (v) => ctl.current?.setScroll(Math.min(1, v * 1.4)));
  }, [scrollProgress]);

  useEffect(() => () => {
    setSound(false);
  }, []);

  // Pointer handlers live on the whole hero (the text layer sits above the canvas).
  useEffect(() => {
    const el = surfaceRef?.current;
    if (!el || mode !== "live") return undefined;
    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      ctl.current?.setLook(((e.clientX - r.left) / r.width - 0.5) * 2, -((e.clientY - r.top) / r.height - 0.5) * 2);
    };
    const onTap = (e) => {
      if (!ctl.current || e.button > 0) return;
      // Taps on controls or text are not taps on the sea.
      if (e.target.closest("a, button, input, select, label, form, h1, p, .ocean-controls")) return;
      const res = ctl.current.tap(e.clientX, e.clientY);
      setHint(false);
      if (res.kind === "water") {
        const r = el.getBoundingClientRect();
        plip(((e.clientX - r.left) / r.width - 0.5) * 2, res.distance);
      }
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerdown", onTap);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onTap);
    };
  }, [mode, surfaceRef]);

  const toggleSound = async () => {
    const next = !sound;
    if (await setSound(next)) setSoundOn(next);
  };

  const [mood, MoodIcon] = moodOf(hour);
  return (
    <>
      <div className="hero-media ocean-hero">
        {mode === "fallback" ? (
          <SceneArt scene="harbor" seed="sarande-hero" variant={hour >= 17 || hour < 7 ? "sunset" : undefined} />
        ) : (
          <canvas ref={canvasRef} className="ocean-canvas" aria-hidden="true" />
        )}
      </div>
      {mode !== "fallback" && (
        <div className="ocean-controls">
          <div className="time-dial glass-card">
            <MoodIcon size={16} aria-hidden="true" />
            <label htmlFor="ocean-hour" className="time-dial-label">
              <span className="tiny">{live ? tr("Now in Sarandë") : mood}</span>
              <b>{fmtHour(hour)}</b>
            </label>
            <input
              id="ocean-hour" type="range" min={MIN_H} max={MAX_H} step={0.05} value={hour}
              onChange={(e) => { setLive(false); setHour(Number(e.target.value)); }}
              aria-valuetext={`${fmtHour(hour)}, ${mood}`}
              aria-label="Time of day over the bay"
            />
            {!live && (
              <button type="button" className="icon-btn sm" onClick={() => setLive(true)} title="Back to the real time in Sarandë" aria-label="Back to the real time in Sarandë">
                <Radio size={15} />
              </button>
            )}
            {soundAvailable() && (
              <button type="button" className="icon-btn sm" onClick={toggleSound} aria-pressed={sound} title={sound ? "Mute the sea" : "Hear the sea"} aria-label={sound ? "Mute the sea" : "Hear the sea"}>
                {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            )}
          </div>
          {mode === "live" && hint && <div className="ocean-hint tiny">Tap the water · drag the time{hour >= 20.5 ? " · tap the stars" : ""}</div>}
        </div>
      )}
    </>
  );
}

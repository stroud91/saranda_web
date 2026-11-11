import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Pause, Play, X } from "lucide-react";
import { prefersReducedMotion } from "../../lib/media";

/**
 * Full-screen stories: clips play one after another with progress bars.
 * Tap right/left to skip, hold to pause, swipe down or Esc to close.
 */
export default function Stories({ items, start = 0, onClose, placeName = (s) => s }) {
  const [i, setI] = useState(start);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const video = useRef(null);
  const dialog = useRef(null);
  const press = useRef(null);
  const reduce = prefersReducedMotion();
  const item = items[i];

  const next = useCallback(() => {
    setProgress(0);
    if (i < items.length - 1) setI(i + 1);
    else onClose();
  }, [i, items.length, onClose]);
  const prev = useCallback(() => {
    setProgress(0);
    if (i > 0) setI(i - 1);
    else if (video.current) video.current.currentTime = 0;
  }, [i]);

  useEffect(() => {
    const before = document.activeElement;
    dialog.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, i]);

  // Reduced motion: still frames that advance every 6 s.
  useEffect(() => {
    if (!reduce || paused) return undefined;
    const t0 = performance.now();
    const id = setInterval(() => {
      const p = (performance.now() - t0) / 6000;
      if (p >= 1) next();
      else setProgress(p);
    }, 100);
    return () => clearInterval(id);
  }, [reduce, paused, i, next]);

  const onPointerDown = (e) => {
    press.current = { x: e.clientX, y: e.clientY, t: performance.now(), held: false };
    press.current.timer = setTimeout(() => {
      if (press.current) {
        press.current.held = true;
        setPaused(true);
      }
    }, 280);
  };
  const onPointerUp = (e) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.held) {
      setPaused(false);
      return;
    }
    if (e.clientY - p.y > 90) return onClose();
    if (e.target.closest("a, button")) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 3) prev();
    else next();
  };

  return createPortal(
    <motion.div
      className="stories"
      role="dialog"
      aria-modal="true"
      aria-label={`Video stories, ${i + 1} of ${items.length}: ${item.title}`}
      tabIndex={-1}
      ref={dialog}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="stories-backdrop" style={{ backgroundImage: `url(${item.src.poster})` }} aria-hidden="true" />
      <div className="stories-frame" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { press.current = null; setPaused(false); }}>
        <div className="stories-bars" aria-hidden="true">
          {items.map((it, k) => (
            <span key={it.key}><i style={{ transform: `scaleX(${k < i ? 1 : k === i ? progress : 0})` }} /></span>
          ))}
        </div>
        <div className="stories-top">
          <span className="stories-count tiny">{i + 1} / {items.length}</span>
          <button type="button" className="icon-btn sm" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"}>
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close stories"><X size={18} /></button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={item.key} className="stories-media" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.3 }}>
            {reduce ? (
              <img src={item.src.poster} alt="" />
            ) : (
              <video
                ref={video}
                src={item.src.mp4}
                poster={item.src.poster}
                muted
                playsInline
                autoPlay
                preload="auto"
                onTimeUpdate={(e) => e.currentTarget.duration && setProgress(e.currentTarget.currentTime / e.currentTarget.duration)}
                onEnded={next}
              />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="stories-caption">
          <h3>{item.title}</h3>
          <p className="small">{item.caption}</p>
          <div className="row wrap gap-sm">
            <Link className="btn sm glass" to={`/explore/${item.place}`} onClick={onClose}><MapPin size={14} /> {placeName(item.place)}</Link>
          </div>
          <p className="stories-credit tiny">
            Video: <a href={item.source} target="_blank" rel="noopener noreferrer">{item.author}</a> · <a href={item.license.url} target="_blank" rel="noopener noreferrer license">{item.license.name}</a> · edited
          </p>
        </div>
        <button type="button" className="stories-nav prev icon-btn" onClick={prev} aria-label="Previous clip" disabled={i === 0}><ChevronLeft size={22} /></button>
        <button type="button" className="stories-nav next icon-btn" onClick={next} aria-label="Next clip"><ChevronRight size={22} /></button>
      </div>
    </motion.div>,
    document.body
  );
}

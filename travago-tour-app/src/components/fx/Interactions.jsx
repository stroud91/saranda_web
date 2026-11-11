import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Site-wide micro-interactions, all driven by CSS variables so React never
 * re-renders on pointer moves:
 *  - a soft light halo that follows the pointer and grows over clickable things
 *  - magnetic primary buttons that lean towards the pointer
 *  - 3D tilt with a moving glare on cards
 *  - a reading-progress line at the top of long pages
 * Off for touch screens and for visitors who prefer reduced motion.
 */
export default function Interactions() {
  const halo = useRef(null);
  const bar = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return undefined;
    document.documentElement.classList.add("fx-on");
    let raf = 0;
    let x = -100, y = -100, hx = -100, hy = -100;
    let magnet = null, tilt = null;

    const loop = () => {
      hx += (x - hx) * 0.2;
      hy += (y - hy) * 0.2;
      if (halo.current) halo.current.style.transform = `translate3d(${hx}px, ${hy}px, 0)`;
      raf = Math.abs(x - hx) + Math.abs(y - hy) > 0.3 ? requestAnimationFrame(loop) : 0;
    };
    const reset = (el, props) => el && props.forEach((p) => el.style.removeProperty(p));

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
      const t = e.target instanceof Element ? e.target : null;
      const interactive = t?.closest("a, button, [role='button'], select, input, label, summary, .story-card, .card.hover");
      halo.current?.classList.toggle("on-link", Boolean(interactive));

      const m = t?.closest(".btn.lg, .btn.primary, .btn.sun, .magnetic");
      if (m !== magnet) {
        reset(magnet, ["--mx", "--my"]);
        magnet = m;
      }
      if (m) {
        const r = m.getBoundingClientRect();
        m.style.setProperty("--mx", `${((x - r.left) / r.width - 0.5) * 10}px`);
        m.style.setProperty("--my", `${((y - r.top) / r.height - 0.5) * 8}px`);
      }

      const c = t?.closest(".card.hover, .quick, .tilt, .yt-facade, .guide-card, .dest-card");
      if (c !== tilt) {
        reset(tilt, ["--rx", "--ry", "--gx", "--gy"]);
        tilt?.classList.remove("tilting");
        tilt = c;
        c?.classList.add("tilting");
      }
      if (c) {
        const r = c.getBoundingClientRect();
        const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
        c.style.setProperty("--ry", `${(px - 0.5) * 7}deg`);
        c.style.setProperty("--rx", `${(0.5 - py) * 6}deg`);
        c.style.setProperty("--gx", `${px * 100}%`);
        c.style.setProperty("--gy", `${py * 100}%`);
      }
    };
    const onLeave = () => {
      x = y = -100;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onDown = () => halo.current?.classList.add("down");
    const onUp = () => halo.current?.classList.remove("down");
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("fx-on");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  // Reading progress
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 200 ? window.scrollY / max : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  return (
    <>
      <div className="fx-progress" aria-hidden="true"><i ref={bar} /></div>
      <div className="fx-halo" ref={halo} aria-hidden="true" />
    </>
  );
}

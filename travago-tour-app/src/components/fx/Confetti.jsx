import { useEffect, useRef } from "react";

const COLORS = ["#f4b63f", "#d9653b", "#3fd3cf", "#1192a8", "#f9d27f", "#ffffff", "#e07a8f"];

/**
 * One short burst of paper confetti in the site's colours (about two seconds,
 * then the canvas removes itself). Skipped for visitors who prefer reduced motion.
 */
export default function Confetti({ fire }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!fire || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    const pieces = Array.from({ length: 110 }, (_, i) => {
      const side = i % 2 ? 1 : -1; // two cannons in the bottom corners, each firing inwards
      const angle = (-Math.PI / 2) + side * (0.25 + Math.random() * 0.55);
      const speed = (9 + Math.random() * 9) * dpr;
      return {
        x: side > 0 ? w * 0.1 : w * 0.9, y: h * 0.95,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size: (5 + Math.random() * 6) * dpr, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[i % COLORS.length], wobble: Math.random() * 6.3,
      };
    });
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const p of pieces) {
        p.vy += 0.32 * dpr;          // gravity
        p.vx *= 0.99;
        p.x += p.vx + Math.sin(t * 6 + p.wobble) * 0.8 * dpr;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1.5) / 0.9);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t < 2.4) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  if (!fire) return null;
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}

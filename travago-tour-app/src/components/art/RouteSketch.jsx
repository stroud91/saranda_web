import { useId } from "react";
import { motion } from "framer-motion";
import { project, smoothPath } from "../../lib/geo";

/** Animated mini-map of a route drawn from lat/lng points. */
export default function RouteSketch({ path = [], width = 320, height = 180, labels = [], className = "", color = "url(#rs-grad)" }) {
  const id = useId().replace(/:/g, "");
  const { pts } = project(path, width, height, 18);
  const d = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`route-sketch ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`rs${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4b63f" />
          <stop offset="0.5" stopColor="#d9653b" />
          <stop offset="1" stopColor="#19c3c0" />
        </linearGradient>
        <pattern id={`dots${id}`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill="currentColor" opacity="0.12" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#dots${id})`} />
      {d && (
        <>
          <path d={d} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="7" strokeLinecap="round" />
          <motion.path
            d={d}
            fill="none"
            stroke={color === "url(#rs-grad)" ? `url(#rs${id})` : color}
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </>
      )}
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i === 0 || i === pts.length - 1 ? 6 : 4} fill="var(--surface)" stroke={i === 0 ? "#f4b63f" : i === pts.length - 1 ? "#19c3c0" : "#d9653b"} strokeWidth="2.5" />
          {labels[i] && (
            <text x={x + 8} y={y - 8} fontSize="10.5" fontWeight="800" fill="currentColor" opacity="0.8" style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3 }}>
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

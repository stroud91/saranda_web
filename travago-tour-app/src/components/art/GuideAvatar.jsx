import { hash } from "../../lib/format";

export const PALETTES = {
  sea: ["#0b5c7e", "#19c3c0"],
  sunset: ["#d9653b", "#f4b63f"],
  olive: ["#6e7f3a", "#a9b872"],
  lagoon: ["#10a3a3", "#3fd3cf"],
  aegean: ["#06324a", "#0e8fb0"],
  spring: ["#0e8fb0", "#a9b872"],
  terracotta: ["#bf5230", "#f4b63f"],
};

// Procedural avatar: initials over a patterned Mediterranean tile.
export default function GuideAvatar({ name = "", palette = "sea", size = 72, className = "" }) {
  const [a, b] = PALETTES[palette] || PALETTES.sea;
  const initials = name.replace(/[^A-Za-zÀ-ž& ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const h = hash(name);
  const id = `ga${h}`;
  const pattern = h % 3;
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className={`guide-avatar ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <clipPath id={`${id}c`}><circle cx="40" cy="40" r="40" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="80" height="80" fill={`url(#${id})`} />
        {pattern === 0 && [0, 1, 2, 3].map((i) => (
          <path key={i} d={`M-10 ${50 + i * 9} q 10 -5 20 0 t 20 0 t 20 0 t 20 0 t 20 0`} stroke="#fff" strokeOpacity="0.22" strokeWidth="2" fill="none" />
        ))}
        {pattern === 1 && <circle cx="62" cy="18" r="22" fill="#fff" opacity="0.14" />}
        {pattern === 2 && [0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 18 - 4} y="-10" width="7" height="100" fill="#fff" opacity="0.08" transform="rotate(25 40 40)" />)}
      </g>
      <text x="40" y="47" textAnchor="middle" fontFamily="'Fraunces Variable', Fraunces, Georgia, serif" fontWeight="800" fontSize="26" fill="#fff">{initials}</text>
    </svg>
  );
}

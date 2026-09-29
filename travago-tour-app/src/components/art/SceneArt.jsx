// Procedural Mediterranean postcards. Each destination gets a deterministic,
// hand-tuned SVG scene (sky, sun, mountains, sea, and a foreground motif) —
// crisp at any size, themable, animated, and free of image licensing.
import { useId, useMemo } from "react";
import { hash, seeded } from "../../lib/format";

const W = 400;
const H = 250;
const HORIZON = 146;

const SKIES = {
  day: { sky: ["#6cc4ec", "#bfe7f7", "#fdf3df"], sun: "#fff4cf", glow: "#fff1c1", sea: ["#19c3c0", "#0c769c", "#06324a"], far: "#8fb7c9", near: "#5d8a8f" },
  golden: { sky: ["#f5c46b", "#f9dea4", "#fff3dc"], sun: "#fffaf0", glow: "#ffd98a", sea: ["#3fb8c0", "#0c769c", "#06324a"], far: "#c4a488", near: "#8a7a5f" },
  sunset: { sky: ["#3b3f7a", "#d9653b", "#f9c46b"], sun: "#ffe7b0", glow: "#ffb46b", sea: ["#c46a6a", "#5e4a7a", "#122c4a"], far: "#7b5a86", near: "#4b3a5e" },
  dusk: { sky: ["#0d2744", "#2c4f7c", "#e59a74"], sun: "#ffe9c4", glow: "#f7a87c", sea: ["#2a6f8f", "#123f5d", "#061a26"], far: "#3c5577", near: "#243a55" },
};

const NO_SEA = new Set(["mountain", "city", "windows", "vineyard", "spring"]);

function ridge(rand, y, amp, step, jag = 1) {
  let d = `M0 ${H} L0 ${y}`;
  for (let x = 0; x <= W + step; x += step) {
    const peak = y - rand() * amp * jag;
    d += ` L${x} ${peak.toFixed(1)}`;
  }
  return d + ` L${W} ${H} Z`;
}

function softRidge(rand, y, amp, n = 5) {
  let d = `M0 ${H} L0 ${y}`;
  const step = W / n;
  let prev = y;
  for (let i = 1; i <= n; i++) {
    const x = i * step;
    const ny = y - rand() * amp;
    d += ` C${x - step * 0.6} ${prev} ${x - step * 0.4} ${ny} ${x} ${ny}`;
    prev = ny;
  }
  return d + ` L${W} ${H} Z`;
}

const House = ({ x, y, w = 14, h = 11, roof = "#d9653b", wall = "#fffaf0" }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill={wall} />
    <path d={`M${x - 1.5} ${y} L${x + w / 2} ${y - h * 0.55} L${x + w + 1.5} ${y} Z`} fill={roof} />
    <rect x={x + w * 0.35} y={y + h * 0.35} width={w * 0.3} height={h * 0.4} fill="#0b5c7e" opacity="0.55" />
  </g>
);

const Boat = ({ x, y, s = 1, sail = "#fffaf0", hull = "#d9653b", cls = "bob" }) => (
  <g className={cls} transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-14 0 L14 0 L9 6 L-9 6 Z" fill={hull} />
    <path d="M0 -1 L0 -24 L11 -2 Z" fill={sail} />
    <path d="M-1 -1 L-1 -18 L-9 -2 Z" fill={sail} opacity="0.8" />
  </g>
);

const Cypress = ({ x, y, h = 30, c = "#3f5a2a" }) => (
  <path d={`M${x} ${y} C${x - 5} ${y - h * 0.4} ${x - 3} ${y - h * 0.85} ${x} ${y - h} C${x + 3} ${y - h * 0.85} ${x + 5} ${y - h * 0.4} ${x} ${y} Z`} fill={c} />
);

const Olive = ({ x, y, s = 1, c = "#6e7f3a" }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-1.5" y="-8" width="3" height="10" fill="#6b4f33" />
    <ellipse cx="0" cy="-14" rx="12" ry="8" fill={c} />
    <ellipse cx="-7" cy="-10" rx="7" ry="5" fill={c} opacity="0.9" />
    <ellipse cx="8" cy="-11" rx="7" ry="5" fill={c} opacity="0.85" />
  </g>
);

const Umbrella = ({ x, y, c = "#d9653b" }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="-0.8" y="-14" width="1.6" height="14" fill="#6b4f33" />
    <path d="M-11 -13 Q0 -24 11 -13 Z" fill={c} />
    <path d="M-11 -13 Q-5.5 -17 0 -13 Q5.5 -17 11 -13" fill="none" stroke="#fffaf0" strokeWidth="0.8" opacity="0.7" />
  </g>
);

function Castle({ x, y, s = 1, c = "#c9b28c", shade = "#a8916b" }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-40 0 L-40 -22 L-34 -22 L-34 -27 L-29 -27 L-29 -22 L-22 -22 L-22 -27 L-17 -27 L-17 -22 L-10 -22 L-10 -38 L-4 -38 L-4 -43 L1 -43 L1 -38 L6 -38 L6 -43 L11 -43 L11 -38 L16 -38 L16 -22 L24 -22 L24 -27 L29 -27 L29 -22 L40 -22 L40 0 Z" fill={c} />
      <rect x="-10" y="-38" width="26" height="38" fill={shade} opacity="0.35" />
      <path d="M0 0 L0 -12 Q3 -16 6 -12 L6 0 Z" fill="#3b2e22" opacity="0.6" />
      <rect x="-30" y="-16" width="3" height="5" fill="#3b2e22" opacity="0.5" />
      <rect x="28" y="-16" width="3" height="5" fill="#3b2e22" opacity="0.5" />
      <path d="M3 -43 L3 -55" stroke="#3b2e22" strokeWidth="1" />
      <path d="M3 -55 L13 -52 L3 -49 Z" fill="#e41e20" className="flag" />
    </g>
  );
}

function Column({ x, y, h = 38, broken = false }) {
  return (
    <g>
      <rect x={x - 4} y={y - h} width="8" height={h} fill="#efe2c6" />
      <rect x={x - 2} y={y - h} width="1.6" height={h} fill="#d7c59e" />
      {!broken && <rect x={x - 6.5} y={y - h - 4} width="13" height="4" rx="1" fill="#e6d6b3" />}
      <rect x={x - 6} y={y - 3} width="12" height="3" fill="#d7c59e" />
    </g>
  );
}

function Foreground({ scene, rand, pal }) {
  switch (scene) {
    case "harbor": {
      const houses = [];
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 7 - row; i++) {
          const x = 212 + i * 24 + row * 10 + rand() * 6;
          const y = HORIZON - 10 - row * 15 + rand() * 4;
          houses.push(<House key={`${row}-${i}`} x={x} y={y} w={14 + rand() * 6} roof={rand() > 0.3 ? "#d9653b" : "#bf5230"} wall={rand() > 0.2 ? "#fffaf0" : "#f5e6c8"} />);
        }
      }
      return (
        <g>
          <path d={`M170 ${HORIZON + 2} C220 ${HORIZON - 40} 300 ${HORIZON - 80} ${W} ${HORIZON - 70} L${W} ${HORIZON + 4} Z`} fill="#6e7f3a" opacity="0.85" />
          {houses}
          <Cypress x={200} y={HORIZON - 2} h={26} />
          <Cypress x={385} y={HORIZON - 58} h={22} />
          <path d={`M160 ${HORIZON + 3} L${W} ${HORIZON + 3}`} stroke="#fffaf0" strokeWidth="3" opacity="0.8" />
          <Boat x={70} y={HORIZON + 34} s={1.2} />
          <Boat x={135} y={HORIZON + 58} s={0.9} hull="#0b5c7e" cls="bob slow" />
        </g>
      );
    }
    case "castle":
      return (
        <g>
          <path d={`M150 ${HORIZON + 6} C200 ${HORIZON - 30} 250 ${HORIZON - 72} 300 ${HORIZON - 74} C340 ${HORIZON - 74} 370 ${HORIZON - 40} ${W} ${HORIZON - 30} L${W} ${HORIZON + 10} Z`} fill={pal.near} />
          <path d={`M180 ${HORIZON + 6} C230 ${HORIZON - 20} 270 ${HORIZON - 50} 300 ${HORIZON - 52} C330 ${HORIZON - 50} 360 ${HORIZON - 26} ${W} ${HORIZON - 16} L${W} ${HORIZON + 10} Z`} fill="#6e7f3a" opacity="0.9" />
          <Castle x={298} y={HORIZON - 70} s={1.15} />
          <Olive x={200} y={HORIZON + 2} s={0.9} />
          <Cypress x={360} y={HORIZON - 26} h={28} />
          <Boat x={70} y={HORIZON + 44} />
        </g>
      );
    case "island":
      return (
        <g>
          <ellipse cx="120" cy={HORIZON + 26} rx="150" ry="22" fill="#3fd3cf" opacity="0.55" />
          {[[90, 22, 40], [180, 16, 28], [250, 10, 18]].map(([x, dy, r], i) => (
            <g key={i}>
              <ellipse cx={x} cy={HORIZON + dy} rx={r} ry={r * 0.32} fill="#e8d4a8" />
              <ellipse cx={x} cy={HORIZON + dy - r * 0.2} rx={r * 0.8} ry={r * 0.35} fill="#5f7a2e" />
              <ellipse cx={x - r * 0.3} cy={HORIZON + dy - r * 0.35} rx={r * 0.4} ry={r * 0.25} fill="#6e7f3a" />
            </g>
          ))}
          <path d={`M0 ${H} L0 ${H - 44} C120 ${H - 64} 260 ${H - 50} ${W} ${H - 70} L${W} ${H} Z`} fill="#f2e4cc" />
          <path d={`M0 ${H - 44} C120 ${H - 64} 260 ${H - 50} ${W} ${H - 70}`} fill="none" stroke="#fffaf0" strokeWidth="3" opacity="0.9" className="shore" />
          <Umbrella x={300} y={H - 50} c="#19c3c0" />
          <Umbrella x={340} y={H - 54} c="#d9653b" />
          <Umbrella x={260} y={H - 46} c="#f4b63f" />
        </g>
      );
    case "ruins":
      return (
        <g>
          <path d={softRidge(rand, HORIZON + 10, 18, 4)} fill="#6e7f3a" opacity="0.8" />
          <path d={`M0 ${H} L0 ${H - 60} C140 ${H - 70} 260 ${H - 58} ${W} ${H - 66} L${W} ${H} Z`} fill="#e6cfa7" />
          <g>
            <Column x={150} y={H - 60} h={54} />
            <Column x={180} y={H - 61} h={54} />
            <Column x={210} y={H - 62} h={32} broken />
            <Column x={260} y={H - 63} h={54} />
            <rect x="142" y={H - 122} width="126" height="8" fill="#e6d6b3" opacity="0.95" />
            <path d="M296 190 L296 150 Q320 118 344 150 L344 190 L334 190 L334 154 Q320 134 306 154 L306 190 Z" fill="#d7c59e" transform={`translate(0 ${H - 250})`} />
          </g>
          <Olive x={60} y={H - 58} s={1.3} />
          <Cypress x={370} y={H - 64} h={40} />
        </g>
      );
    case "spring":
      return (
        <g>
          <path d={softRidge(rand, HORIZON - 10, 40, 5)} fill="#3f6b35" />
          {Array.from({ length: 14 }).map((_, i) => (
            <Cypress key={i} x={i * 30 + rand() * 12} y={HORIZON + 30 + rand() * 12} h={40 + rand() * 30} c={i % 2 ? "#2f5528" : "#3f6b35"} />
          ))}
          <path d={`M0 ${H} L0 ${H - 90} C100 ${H - 100} 300 ${H - 100} ${W} ${H - 86} L${W} ${H} Z`} fill="#4c7a3d" />
          <ellipse cx="200" cy={H - 44} rx="120" ry="34" fill="url(#springPool)" />
          <ellipse cx="200" cy={H - 44} rx="120" ry="34" fill="none" stroke="#a7ece9" strokeWidth="2" opacity="0.7" className="ripple" />
          <ellipse cx="200" cy={H - 42} rx="38" ry="11" fill="#062a4a" opacity="0.8" />
        </g>
      );
    case "beach":
      return (
        <g>
          <path d={`M0 ${H} L0 ${H - 52} C110 ${H - 72} 250 ${H - 56} ${W} ${H - 80} L${W} ${H} Z`} fill="#f2e4cc" />
          <path d={`M0 ${H - 52} C110 ${H - 72} 250 ${H - 56} ${W} ${H - 80}`} fill="none" stroke="#fffaf0" strokeWidth="3.5" className="shore" />
          {[70, 120, 170, 220, 270, 320].map((x, i) => (
            <g key={x}>
              <Umbrella x={x + rand() * 10} y={H - 62 + i * -3 + rand() * 6} c={["#d9653b", "#19c3c0", "#f4b63f", "#d63c7a"][i % 4]} />
              <rect x={x - 6} y={H - 58 + i * -3} width="12" height="3" rx="1.5" fill="#fffaf0" opacity="0.9" />
            </g>
          ))}
          <path d={`M${W - 110} ${HORIZON + 4} C${W - 70} ${HORIZON - 40} ${W - 30} ${HORIZON - 50} ${W} ${HORIZON - 44} L${W} ${HORIZON + 8} Z`} fill={pal.near} />
        </g>
      );
    case "village": {
      const houses = [];
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i < 5; i++) {
          const x = 150 + i * 30 + row * 8 + rand() * 8;
          const y = HORIZON - 4 - row * 17 + rand() * 5;
          houses.push(<House key={`${row}-${i}`} x={x} y={y} w={16} h={13} roof={rand() > 0.5 ? "#8b7d6b" : "#a5937a"} wall={rand() > 0.5 ? "#d9cdb7" : "#cbbfa7"} />);
        }
      }
      return (
        <g>
          <path d={`M110 ${HORIZON + 10} C170 ${HORIZON - 60} 260 ${HORIZON - 100} ${W} ${HORIZON - 96} L${W} ${HORIZON + 10} Z`} fill="#7b8a4a" />
          {houses}
          <Cypress x={140} y={HORIZON + 4} h={34} />
          <Cypress x={352} y={HORIZON - 80} h={26} />
          <Olive x={60} y={HORIZON + 40} s={1.2} />
        </g>
      );
    }
    case "canyon":
    case "cove":
      return (
        <g>
          <path d={`M0 ${H} L0 30 C40 40 70 90 90 ${HORIZON - 10} C100 ${HORIZON + 30} 120 ${H - 40} 150 ${H} Z`} fill="#c9a87f" />
          <path d={`M0 ${H} L0 60 C30 80 50 110 70 ${HORIZON + 10} C80 ${HORIZON + 40} 96 ${H - 30} 110 ${H} Z`} fill="#a88962" />
          <path d={`M${W} ${H} L${W} 40 C${W - 50} 50 ${W - 80} 100 ${W - 100} ${HORIZON} C${W - 110} ${HORIZON + 40} ${W - 130} ${H - 30} ${W - 160} ${H} Z`} fill="#b99670" />
          <path d={`M${W} ${H} L${W} 70 C${W - 30} 90 ${W - 60} 120 ${W - 76} ${HORIZON + 20} C${W - 86} ${HORIZON + 50} ${W - 100} ${H - 20} ${W - 120} ${H} Z`} fill="#9c7c56" />
          <ellipse cx="200" cy={H - 18} rx="90" ry="16" fill="#f2e4cc" />
          <ellipse cx="200" cy={H - 44} rx="70" ry="16" fill="#3fd3cf" opacity="0.55" />
          {scene === "cove" && <Boat x={210} y={HORIZON + 40} s={1.1} hull="#0b5c7e" />}
          <Olive x={40} y={46} s={0.8} c="#5f7a2e" />
          <Olive x={W - 40} y={56} s={0.8} c="#5f7a2e" />
        </g>
      );
    case "mountain":
      return (
        <g>
          <path d={`M0 ${H} L0 150 L60 70 L95 110 L150 36 L205 104 L250 60 L300 120 L345 54 L${W} 118 L${W} ${H} Z`} fill="#5d7085" />
          <path d="M150 36 L170 62 L160 60 L150 70 L140 60 L132 62 Z M345 54 L360 74 L345 70 L332 74 Z M60 70 L74 88 L60 84 L48 88 Z" fill="#fffaf0" opacity="0.95" />
          <path d={softRidge(rand, 190, 30, 5)} fill="#3f6b35" />
          {Array.from({ length: 18 }).map((_, i) => (
            <path key={i} d={`M${i * 23 + rand() * 8} ${H - 10 - rand() * 30} l7 -22 l7 22 Z`} fill={i % 2 ? "#2f5528" : "#264a22"} />
          ))}
          <path d={`M0 ${H} L0 ${H - 16} C140 ${H - 26} 260 ${H - 10} ${W} ${H - 22} L${W} ${H} Z`} fill="#6e7f3a" />
        </g>
      );
    case "city":
      return (
        <g>
          <path d={softRidge(rand, 128, 34, 5)} fill="#9fb3c4" opacity="0.7" />
          {Array.from({ length: 16 }).map((_, i) => {
            const w = 20 + rand() * 12;
            const h = 30 + rand() * 70;
            const x = i * 25 + rand() * 4;
            const colors = ["#f4b63f", "#d9653b", "#19c3c0", "#d63c7a", "#6e7f3a", "#0e8fb0", "#f2e4cc"];
            return (
              <g key={i}>
                <rect x={x} y={H - 40 - h} width={w} height={h + 40} fill={colors[i % colors.length]} />
                {Array.from({ length: Math.floor(h / 12) }).map((_, j) => (
                  <rect key={j} x={x + 4} y={H - 34 - h + j * 12} width={w - 8} height="4" fill="#fffaf0" opacity="0.55" />
                ))}
              </g>
            );
          })}
          <path d={`M0 ${H} L0 ${H - 20} L${W} ${H - 20} L${W} ${H} Z`} fill="#3b4d57" />
        </g>
      );
    case "windows":
      return (
        <g>
          <path d={softRidge(rand, 118, 30, 4)} fill="#7b8a4a" />
          <Castle x={300} y={92} s={0.8} />
          {Array.from({ length: 6 }).map((_, row) =>
            Array.from({ length: 9 }).map((_, i) => {
              const x = 10 + i * 44 + (row % 2) * 20;
              const y = 128 + row * 20;
              return (
                <g key={`${row}-${i}`}>
                  <rect x={x} y={y} width="36" height="18" fill={row % 2 ? "#fffaf0" : "#f5ead3"} />
                  <path d={`M${x - 2} ${y} L${x + 18} ${y - 7} L${x + 38} ${y} Z`} fill="#8b6f5a" />
                  {[0, 1, 2, 3].map((k) => (
                    <rect key={k} x={x + 4 + k * 8} y={y + 5} width="4.5" height="8" fill="#3b2e22" opacity="0.7" />
                  ))}
                </g>
              );
            })
          )}
          <path d={`M0 ${H} L0 ${H - 16} C140 ${H - 22} 260 ${H - 10} ${W} ${H - 18} L${W} ${H} Z`} fill="#0e8fb0" />
        </g>
      );
    case "lake":
      return (
        <g>
          <path d={`M180 ${HORIZON + 4} C220 ${HORIZON - 40} 260 ${HORIZON - 60} 300 ${HORIZON - 60} C330 ${HORIZON - 58} 360 ${HORIZON - 30} ${W} ${HORIZON - 20} L${W} ${HORIZON + 6} Z`} fill="#6e7f3a" />
          <Castle x={296} y={HORIZON - 58} s={0.9} />
          <path d={`M0 ${H} L0 ${H - 30} C80 ${H - 44} 150 ${H - 30} 220 ${H - 40} L220 ${H} Z`} fill="#4c7a3d" />
          <Boat x={100} y={HORIZON + 30} s={0.9} sail="#f4b63f" hull="#3b4d57" />
        </g>
      );
    case "vineyard":
      return (
        <g>
          <path d={softRidge(rand, 120, 26, 4)} fill="#a9b872" />
          <path d={softRidge(rand, 160, 20, 3)} fill="#7b8a4a" />
          {Array.from({ length: 9 }).map((_, i) => (
            <path key={i} d={`M-10 ${170 + i * 10} Q200 ${150 + i * 12} 410 ${176 + i * 9}`} stroke="#4d5a22" strokeWidth="3" strokeDasharray="2 6" fill="none" opacity="0.8" />
          ))}
          <g transform="translate(270 118)">
            <rect x="0" y="0" width="46" height="26" fill="#e6d6b3" />
            <path d="M-4 0 L23 -14 L50 0 Z" fill="#bf5230" />
            <rect x="18" y="-26" width="10" height="14" fill="#e6d6b3" />
            <path d="M16 -26 L23 -34 L30 -26 Z" fill="#bf5230" />
          </g>
          <Cypress x={250} y={144} h={30} />
          <Cypress x={330} y={146} h={34} />
        </g>
      );
    default:
      return null;
  }
}

export default function SceneArt({ scene = "harbor", seed = "", variant, className = "", title, animated = true }) {
  const uid = useId().replace(/:/g, "");
  const { rand, pal, v } = useMemo(() => {
    const h = hash(seed + scene);
    const vs = ["day", "golden", "sunset", "dusk"];
    const v = variant || vs[h % 3 === 0 ? 2 : h % 5 === 0 ? 1 : h % 7 === 0 ? 3 : 0];
    return { rand: seeded(h), pal: SKIES[v], v };
  }, [seed, scene, variant]);

  // Fixed draws so layout is stable across renders.
  const layers = useMemo(() => {
    const r = seeded(hash(seed + "layers"));
    return { far: ridge(r, HORIZON - 18, 34, 26, 1.1), near: softRidge(r, HORIZON - 4, 26, 4), sunX: 70 + r() * 260, clouds: [r(), r(), r()] };
  }, [seed]);

  const hasSea = !NO_SEA.has(scene);
  const sunY = v === "sunset" || v === "dusk" ? HORIZON - 16 : 52 + layers.clouds[0] * 18;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={`scene ${animated ? "animated" : ""} ${className}`} role="img" aria-label={title || `${scene} illustration`}>
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.sky[0]} />
          <stop offset="0.6" stopColor={pal.sky[1]} />
          <stop offset="1" stopColor={pal.sky[2]} />
        </linearGradient>
        <linearGradient id={`sea${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.sea[0]} />
          <stop offset="0.45" stopColor={pal.sea[1]} />
          <stop offset="1" stopColor={pal.sea[2]} />
        </linearGradient>
        <radialGradient id={`glow${uid}`}>
          <stop offset="0" stopColor={pal.glow} stopOpacity="0.95" />
          <stop offset="1" stopColor={pal.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="springPool">
          <stop offset="0" stopColor="#04294d" />
          <stop offset="0.35" stopColor="#0b5c9e" />
          <stop offset="0.7" stopColor="#19c3c0" />
          <stop offset="1" stopColor="#8fe3dc" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky${uid})`} />
      <circle cx={layers.sunX} cy={sunY} r="70" fill={`url(#glow${uid})`} className="sun-glow" />
      <circle cx={layers.sunX} cy={sunY} r="17" fill={pal.sun} />
      {layers.clouds.map((c, i) => (
        <g key={i} className="cloud" style={{ animationDelay: `${-i * 9}s` }} opacity={v === "dusk" ? 0.35 : 0.75}>
          <ellipse cx={40 + c * 320} cy={24 + i * 16} rx={26 + c * 16} ry="7" fill="#fff" />
          <ellipse cx={56 + c * 320} cy={20 + i * 16} rx={16 + c * 10} ry="7" fill="#fff" />
        </g>
      ))}
      <path d={layers.far} fill={pal.far} opacity="0.55" />
      <path d={layers.near} fill={pal.near} opacity="0.65" />
      {hasSea && (
        <g>
          <rect y={HORIZON} width={W} height={H - HORIZON} fill={`url(#sea${uid})`} />
          <rect x={layers.sunX - 20} y={HORIZON + 2} width="40" height={H - HORIZON} fill={pal.glow} opacity="0.18" className="shimmer" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              className={`wave w${i % 3}`}
              d={`M-40 ${HORIZON + 14 + i * 18} q 20 -5 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0`}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.28 - i * 0.03}
              strokeWidth={1.4 + i * 0.25}
              strokeLinecap="round"
            />
          ))}
        </g>
      )}
      <Foreground scene={scene} rand={rand} pal={pal} />
    </svg>
  );
}

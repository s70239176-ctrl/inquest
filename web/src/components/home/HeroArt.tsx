/**
 * Hero illustration: a dark mountain range under a fine gold geometric structure. The structure is deliberately
 * measured rather than decorative: a hexagon of six vertices (the jury), three diagonals (independent checks that
 * must agree), a plumb line dropped to the ridge with graduation ticks (evidence that can be measured).
 * Pure SVG, no raster assets, no animation.
 */
const CX = 300;
const CY = 262;

function hexPoints(r: number, rotateDeg: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((rotateDeg + i * 60) * Math.PI) / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as [number, number];
  });
}

const fmt = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export function HeroArt({ className = "" }: { className?: string }) {
  const outer = hexPoints(132, -90);
  const inner = hexPoints(66, -60);
  const ticks = Array.from({ length: 11 }, (_, i) => 398 + i * 13);

  return (
    <svg viewBox="0 0 600 760" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ha-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070806" />
          <stop offset="0.55" stopColor="#0d0e0a" />
          <stop offset="1" stopColor="#1b1a10" />
        </linearGradient>
        <radialGradient id="ha-glow" cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor="#D6A844" stopOpacity="0.28" />
          <stop offset="0.6" stopColor="#D6A844" stopOpacity="0.05" />
          <stop offset="1" stopColor="#D6A844" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ha-ridge-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1d12" />
          <stop offset="1" stopColor="#12130c" />
        </linearGradient>
      </defs>

      <rect width="600" height="760" fill="url(#ha-sky)" />
      <rect width="600" height="760" fill="url(#ha-glow)" />

      {/* a few fixed stars */}
      {[
        [64, 92, 1.1],
        [132, 160, 0.8],
        [510, 84, 1.2],
        [548, 188, 0.8],
        [468, 40, 0.8],
        [90, 300, 0.7],
        [540, 330, 0.9],
        [30, 210, 0.7],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#F1F0EA" opacity="0.55" />
      ))}

      {/* mountains, back to front */}
      <path d="M0 548 L66 486 L128 520 L212 430 L284 496 L356 408 L434 484 L504 440 L600 520 L600 760 L0 760 Z" fill="url(#ha-ridge-a)" />
      <polyline points="0,548 66,486 128,520 212,430 284,496 356,408 434,484 504,440 600,520" fill="none" stroke="#D6A844" strokeOpacity="0.28" strokeWidth="0.9" />
      <path d="M0 622 L92 556 L164 598 L252 520 L334 590 L414 538 L492 600 L560 560 L600 580 L600 760 L0 760 Z" fill="#0f100a" />
      <polyline points="0,622 92,556 164,598 252,520 334,590 414,538 492,600 560,560 600,580" fill="none" stroke="#D6A844" strokeOpacity="0.4" strokeWidth="0.9" />
      <path d="M0 702 L102 650 L194 690 L284 642 L384 700 L474 662 L600 712 L600 760 L0 760 Z" fill="#090a07" />

      {/* the structure */}
      <g fill="none" stroke="#D6A844" strokeLinecap="round" strokeLinejoin="round">
        <circle cx={CX} cy={CY} r="196" strokeOpacity="0.14" strokeDasharray="2 7" strokeWidth="1" />
        <circle cx={CX} cy={CY} r="132" strokeOpacity="0.28" strokeWidth="0.9" />
        <polygon points={fmt(outer)} strokeOpacity="0.9" strokeWidth="1.1" />
        <polygon points={fmt(inner)} strokeOpacity="0.55" strokeWidth="0.9" />
        {/* three diagonals: opposite vertices, the checks that must agree */}
        {[0, 1, 2].map((i) => (
          <line key={i} x1={outer[i][0]} y1={outer[i][1]} x2={outer[i + 3][0]} y2={outer[i + 3][1]} strokeOpacity="0.4" strokeWidth="0.8" />
        ))}
        {/* two interlocked triangles */}
        <polygon points={fmt([outer[0], outer[2], outer[4]])} strokeOpacity="0.5" strokeWidth="0.8" />
        <polygon points={fmt([outer[1], outer[3], outer[5]])} strokeOpacity="0.5" strokeWidth="0.8" />
        {/* plumb line to the ridge, with graduations */}
        <line x1={CX} y1={outer[3][1]} x2={CX} y2="548" strokeOpacity="0.7" strokeWidth="0.9" strokeDasharray="3 4" />
        {ticks.map((y, i) => (
          <line key={y} x1={CX - (i % 5 === 0 ? 9 : 5)} y1={y} x2={CX + (i % 5 === 0 ? 9 : 5)} y2={y} strokeOpacity="0.6" strokeWidth="0.9" />
        ))}
      </g>

      {/* vertices */}
      {outer.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="7" fill="#D6A844" fillOpacity="0.12" />
          <circle cx={x} cy={y} r="2.6" fill="#F0C96C" />
        </g>
      ))}
      <circle cx={CX} cy={CY} r="3.2" fill="#F0C96C" />

      <text x="28" y="742" fill="#A3A39A" fontFamily="JetBrains Mono, monospace" fontSize="11" letterSpacing="2">
        5 FIELDS · 1 VERDICT
      </text>
    </svg>
  );
}

/** Quiet linework for the closing section: the same vocabulary, reduced to a few strokes. */
export function Linework({ className = "" }: { className?: string }) {
  const outer = hexPoints(132, -90);
  return (
    <svg viewBox="0 0 600 520" className={className} preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false">
      <g fill="none" stroke="#D6A844" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 -60)">
        <circle cx={CX} cy={CY} r="200" strokeOpacity="0.12" strokeDasharray="2 8" />
        <polygon points={fmt(outer)} strokeOpacity="0.5" strokeWidth="1" />
        <polygon points={fmt([outer[0], outer[2], outer[4]])} strokeOpacity="0.3" strokeWidth="0.8" />
        <polygon points={fmt([outer[1], outer[3], outer[5]])} strokeOpacity="0.3" strokeWidth="0.8" />
        {[0, 1, 2].map((i) => (
          <line key={i} x1={outer[i][0]} y1={outer[i][1]} x2={outer[i + 3][0]} y2={outer[i + 3][1]} strokeOpacity="0.22" strokeWidth="0.8" />
        ))}
      </g>
      {outer.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y - 60} r="2.4" fill="#F0C96C" opacity="0.8" />
      ))}
    </svg>
  );
}

/**
 * MindSeal — the brand mark.
 *
 * A hexagonal seal with a glowing core, a rotating dotted inner ring,
 * a counter-rotating tick ring, and concentric runes. Used as the logo
 * on landing and the attestation badge on memories.
 */

interface Props {
  size?: number;
  variant?: "seal" | "rune"; // jade vs violet
  active?: boolean;
  className?: string;
}

export default function MindSeal({
  size = 120,
  variant = "seal",
  active = true,
  className = "",
}: Props) {
  const color = variant === "seal" ? "#06B6D4" : "#8B5CF6";
  const colorDeep = variant === "seal" ? "#0E7490" : "#6D28D9";

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer rotating tick ring */}
      <svg
        viewBox="0 0 200 200"
        className={`absolute inset-0 ${active ? "anim-spin-slow" : ""}`}
        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
      >
        <g fill="none" stroke={color} strokeWidth="0.6">
          {Array.from({ length: 60 }).map((_, i) => {
            const angle = (i * 6 * Math.PI) / 180;
            const x1 = 100 + Math.cos(angle) * 92;
            const y1 = 100 + Math.sin(angle) * 92;
            const len = i % 5 === 0 ? 8 : 3;
            const x2 = 100 + Math.cos(angle) * (92 - len);
            const y2 = 100 + Math.sin(angle) * (92 - len);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                opacity={i % 5 === 0 ? 0.9 : 0.4}
              />
            );
          })}
        </g>
      </svg>

      {/* Hexagon body */}
      <svg viewBox="0 0 200 200" className="absolute inset-0">
        <defs>
          <radialGradient id={`seal-grad-${variant}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="45%" stopColor={colorDeep} stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </radialGradient>
          <linearGradient id={`seal-stroke-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={colorDeep} />
          </linearGradient>
          <filter id={`seal-shadow-${variant}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor={color} floodOpacity="0.25" />
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={colorDeep} floodOpacity="0.15" />
          </filter>
        </defs>
        <polygon
          points="100,18 168,56 168,144 100,182 32,144 32,56"
          fill={`url(#seal-grad-${variant})`}
          stroke={`url(#seal-stroke-${variant})`}
          strokeWidth="1.8"
          filter={`url(#seal-shadow-${variant})`}
        />
      </svg>

      {/* Counter-rotating dotted inner ring */}
      <svg
        viewBox="0 0 200 200"
        className={`absolute inset-0 ${active ? "anim-spin-reverse" : ""}`}
      >
        <circle
          cx="100"
          cy="100"
          r="62"
          fill="none"
          stroke={color}
          strokeWidth="0.8"
          strokeDasharray="2 5"
          opacity="0.7"
        />
        <circle
          cx="100"
          cy="100"
          r="50"
          fill="none"
          stroke={color}
          strokeWidth="0.5"
          strokeDasharray="1 3"
          opacity="0.5"
        />
      </svg>

      {/* Glyphs at hex corners */}
      <svg viewBox="0 0 200 200" className="absolute inset-0">
        {[
          [100, 30],
          [158, 64],
          [158, 136],
          [100, 170],
          [42, 136],
          [42, 64],
        ].map(([cx, cy], i) => (
          <g key={i} fill={color} opacity="0.85">
            <circle cx={cx} cy={cy} r="1.6" />
            <circle cx={cx} cy={cy} r="3.5" fill="none" stroke={color} strokeWidth="0.5" />
          </g>
        ))}
      </svg>

      {/* Glowing core */}
      <svg viewBox="0 0 200 200" className={`absolute inset-0 ${active ? "anim-glow-breathe" : ""}`}>
        <circle cx="100" cy="100" r="14" fill={color} opacity="0.95" />
        <circle cx="100" cy="100" r="7" fill="#ffffff" />
        <circle cx="100" cy="100" r="22" fill="none" stroke={color} strokeWidth="0.8" opacity="0.6" />
      </svg>
    </div>
  );
}

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
  const color = variant === "seal" ? "#5eead4" : "#c084fc";
  const colorDeep = variant === "seal" ? "#0d9488" : "#7c3aed";

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer rotating tick ring */}
      <svg
        viewBox="0 0 200 200"
        className={`absolute inset-0 ${active ? "anim-spin-slow" : ""}`}
        style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
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
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="40%" stopColor={colorDeep} stopOpacity="0.6" />
            <stop offset="100%" stopColor="#050507" stopOpacity="1" />
          </radialGradient>
          <linearGradient id={`seal-stroke-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={colorDeep} />
          </linearGradient>
        </defs>
        <polygon
          points="100,18 168,56 168,144 100,182 32,144 32,56"
          fill={`url(#seal-grad-${variant})`}
          stroke={`url(#seal-stroke-${variant})`}
          strokeWidth="1.2"
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
        <circle cx="100" cy="100" r="7" fill="#f5f1e8" />
        <circle cx="100" cy="100" r="22" fill="none" stroke={color} strokeWidth="0.8" opacity="0.6" />
      </svg>
    </div>
  );
}

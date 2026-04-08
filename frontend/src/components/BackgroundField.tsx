/**
 * BackgroundField — atmospheric layered backdrop.
 *
 * Layers (back to front):
 *   1. Deep gradient mesh (radial blooms in jade + violet)
 *   2. SVG dot lattice with edge fade
 *   3. Drifting glow orbs
 *   4. Grain overlay
 *   5. A horizontal scan line that occasionally sweeps across the screen
 */

export default function BackgroundField() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Layer 1 — gradient mesh */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 15% 20%, rgba(94, 234, 212, 0.12) 0%, transparent 60%), " +
            "radial-gradient(ellipse 70% 50% at 85% 80%, rgba(192, 132, 252, 0.08) 0%, transparent 60%), " +
            "radial-gradient(ellipse 100% 80% at 50% 100%, rgba(13, 148, 136, 0.06) 0%, transparent 50%), " +
            "linear-gradient(180deg, #050507 0%, #08080e 100%)",
        }}
      />

      {/* Layer 2 — dot lattice with edge fade */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)",
        }}
      >
        <defs>
          <pattern id="lattice" width="48" height="48" patternUnits="userSpaceOnUse">
            <circle cx="24" cy="24" r="0.8" fill="#5eead4" opacity="0.18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lattice)" />
      </svg>

      {/* Layer 3 — drifting orbs */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full anim-drift"
        style={{
          left: "-200px",
          top: "10%",
          background: "radial-gradient(circle, rgba(94, 234, 212, 0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full anim-drift"
        style={{
          right: "-150px",
          bottom: "20%",
          background: "radial-gradient(circle, rgba(192, 132, 252, 0.12) 0%, transparent 70%)",
          filter: "blur(60px)",
          animationDelay: "-7s",
        }}
      />

      {/* Layer 4 — grain */}
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='3'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Layer 5 — scan line */}
      <div
        className="absolute left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, #5eead4, transparent)",
          opacity: 0.4,
          animation: "scan 14s linear infinite",
        }}
      />
    </div>
  );
}

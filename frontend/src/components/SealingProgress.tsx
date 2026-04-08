import { useEffect, useState } from "react";

/**
 * SealingProgress — animated multi-stage loader for remember/recall.
 *
 * The real flow takes ~30s on testnet (TEE inference + 0G Storage txs +
 * confirmations). Static spinners feel frozen — this walks through the
 * actual stages so the user sees forward motion.
 */

const REMEMBER_STAGES = [
  { label: "Routing into TEE enclave", ms: 1500 },
  { label: "Extracting facts inside Intel TDX", ms: 4000 },
  { label: "Generating embedding vectors", ms: 1500 },
  { label: "Sealing with AES-256-GCM", ms: 800 },
  { label: "Submitting tx to 0G Storage", ms: 6000 },
  { label: "Awaiting node finality", ms: 8000 },
  { label: "Anchoring CID on chain", ms: 4000 },
];

const RECALL_STAGES = [
  { label: "Routing into TEE enclave", ms: 1500 },
  { label: "Embedding query vector", ms: 1200 },
  { label: "HNSW vector search", ms: 800 },
  { label: "Decrypting matched memories", ms: 1500 },
  { label: "Synthesising answer in TDX", ms: 5000 },
  { label: "Verifying TEE attestation", ms: 2000 },
];

interface Props {
  mode: "remember" | "recall";
}

export default function SealingProgress({ mode }: Props) {
  const stages = mode === "remember" ? REMEMBER_STAGES : RECALL_STAGES;
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => setElapsed(Date.now() - start), 200);
    let t: ReturnType<typeof setTimeout>;
    let i = 0;
    const next = () => {
      if (i >= stages.length - 1) return;
      t = setTimeout(() => {
        i++;
        setStage(i);
        next();
      }, stages[i].ms);
    };
    next();
    return () => {
      clearInterval(tick);
      clearTimeout(t);
    };
  }, [stages]);

  const accent = mode === "remember" ? "rune" : "seal";
  const accentColor = mode === "remember" ? "#c084fc" : "#5eead4";

  return (
    <div className={`fade-up border-l-2 pl-5 py-2`} style={{ borderColor: accentColor }}>
      <div
        className={`text-[11px] tracking-[0.22em] uppercase mb-3 font-mono text-${accent}`}
      >
        ⬡ {mode === "remember" ? "Sealing memory" : "Querying enclave"} ·{" "}
        <span className="text-vellum-mute">
          {(elapsed / 1000).toFixed(1)}s
        </span>
      </div>

      {/* Stage list */}
      <div className="space-y-1.5 font-mono text-[11px]">
        {stages.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          const pending = i > stage;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 transition-opacity ${
                pending ? "opacity-30" : "opacity-100"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-4 h-4 ${
                  done
                    ? "text-seal"
                    : active
                    ? ""
                    : "text-vellum-mute"
                }`}
                style={active ? { color: accentColor } : undefined}
              >
                {done ? "✓" : active ? <Spinner color={accentColor} /> : "·"}
              </span>
              <span
                className={
                  done
                    ? "text-vellum-dim"
                    : active
                    ? "text-vellum"
                    : "text-vellum-mute"
                }
              >
                {s.label}
                {active && (
                  <span className="anim-blink ml-1 inline-block w-[6px] h-[10px] align-middle" style={{ background: accentColor }} />
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-px bg-vellum/10 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 transition-all duration-700"
          style={{
            width: `${((stage + 0.5) / stages.length) * 100}%`,
            background: `linear-gradient(90deg, transparent, ${accentColor})`,
            boxShadow: `0 0 12px ${accentColor}`,
          }}
        />
      </div>
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className="anim-spin-slow"
      style={{ animationDuration: "1.2s" }}
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeDasharray="6 6"
        opacity="0.9"
      />
    </svg>
  );
}

import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";

/**
 * /deck — Editorial presentation surface.
 *
 *  Each slide is a magazine spread, not a Powerpoint template. The route
 *  renders BARE (no Layout chrome) — full viewport canvas for screen
 *  recording at 1920×1080 or 4K.
 *
 *  Keyboard:
 *   →  Space  PgDn  →  next slide
 *   ←  PgUp        →  previous slide
 *   F              →  toggle fullscreen
 *   Esc / O        →  toggle overview grid
 *   1-9, 0         →  jump to slide N (0 = slide 10, etc.)
 *   Home / End     →  first / last
 *
 *  Cursor auto-hides after 3s of inactivity for clean recording.
 */

const TOTAL_SLIDES = 15;

export default function Deck() {
  const [index, setIndex] = useState(0);
  const [overview, setOverview] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [cursorHidden, setCursorHidden] = useState(false);
  const cursorTimer = useRef<number | null>(null);

  // ── navigation helpers ──────────────────────────────────────
  const goto = useCallback((n: number) => {
    const next = Math.max(0, Math.min(TOTAL_SLIDES - 1, n));
    setIndex((prev) => {
      setDirection(next > prev ? "forward" : "back");
      return next;
    });
    setOverview(false);
  }, []);

  const next = useCallback(() => goto(indexRef.current + 1), [goto]);
  const prev = useCallback(() => goto(indexRef.current - 1), [goto]);

  // Always-current ref so keyboard handlers don't capture a stale index.
  const indexRef = useRef(index);
  useEffect(() => { indexRef.current = index; }, [index]);

  // ── keyboard ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't intercept while typing somewhere (no inputs on deck — just defensive).
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
          e.preventDefault(); next(); break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault(); prev(); break;
        case "Home":
          e.preventDefault(); goto(0); break;
        case "End":
          e.preventDefault(); goto(TOTAL_SLIDES - 1); break;
        case "Escape":
        case "o":
        case "O":
          e.preventDefault(); setOverview((v) => !v); break;
        case "f":
        case "F":
          e.preventDefault();
          if (!document.fullscreenElement) document.documentElement.requestFullscreen();
          else document.exitFullscreen();
          break;
        default:
          // Number keys 1-9 jump to slide N; 0 = slide 10
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const n = e.key === "0" ? 9 : parseInt(e.key, 10) - 1;
            goto(n);
          }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goto]);

  // ── cursor auto-hide for clean recording ────────────────────
  useEffect(() => {
    function bump() {
      setCursorHidden(false);
      if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
      cursorTimer.current = window.setTimeout(() => setCursorHidden(true), 3000);
    }
    bump();
    window.addEventListener("mousemove", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("keydown", bump);
      if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
    };
  }, []);

  const slide = SLIDES[index];

  return (
    <div
      className={`deck-root relative w-screen h-screen overflow-hidden bg-ink text-vellum ${cursorHidden ? "cursor-none" : ""}`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 18% 10%, rgba(6,182,212,0.06), transparent 40%),
          radial-gradient(circle at 82% 92%, rgba(139,92,246,0.05), transparent 50%)
        `,
      }}
    >
      {/* Subtle grain — adds atmosphere, not noise */}
      <DeckGrain />

      {/* Slide content area — keyed on index so React remounts and the
          per-slide fade-up/stagger animations re-trigger every navigation. */}
      <div
        key={index}
        className={`absolute inset-0 ${direction === "forward" ? "slide-enter-fwd" : "slide-enter-back"}`}
      >
        <slide.Component />
      </div>

      {/* Persistent chrome — page number, label, brand mark */}
      <SlideChrome index={index} label={slide.label} />

      {/* Overview grid overlay (Esc) */}
      {overview && <Overview index={index} onPick={goto} onClose={() => setOverview(false)} />}

      {/* Inline styles for slide transitions + a few one-off animations */}
      <DeckStyles />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// CHROME — page number, label, brand mark, escape hatch
// ────────────────────────────────────────────────────────────────

function SlideChrome({ index, label }: { index: number; label: string }) {
  const folio = String(index + 1).padStart(2, "0");
  const total = String(TOTAL_SLIDES).padStart(2, "0");
  return (
    <>
      {/* Top-left — current section eyebrow */}
      <div className="absolute top-7 left-8 md:top-10 md:left-12 z-30 flex items-center gap-3 font-mono text-[10px] tracking-[0.28em] uppercase text-vellum-mute">
        <span className="inline-block w-6 h-px bg-seal" />
        <span>{folio}</span>
        <span className="text-vellum-dim">/</span>
        <span>{label}</span>
      </div>

      {/* Top-right — total folio + small live status pill */}
      <div className="absolute top-7 right-8 md:top-10 md:right-12 z-30 flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 hairline-seal font-mono text-[9px] tracking-[0.22em] uppercase text-seal-deep">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-seal anim-pulse-seal" />
          Live · 0G
        </div>
        <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-vellum-mute">
          {folio} <span className="text-vellum-dim">/ {total}</span>
        </div>
      </div>

      {/* Bottom-left — brand mark + back-to-site link (small, recessive) */}
      <div className="absolute bottom-7 left-8 md:bottom-9 md:left-12 z-30 flex items-center gap-4">
        <SealGlyph size={22} />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-[13px] text-vellum">SealedMind</span>
          <span className="font-mono text-[8px] tracking-[0.28em] uppercase text-vellum-mute">
            0G Hackathon · 2026
          </span>
        </div>
      </div>

      {/* Bottom-right — keyboard hint (auto-fades) */}
      <div className="absolute bottom-7 right-8 md:bottom-9 md:right-12 z-30 font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute opacity-50 hover:opacity-100 transition-opacity">
        ← →&nbsp;&nbsp;·&nbsp;&nbsp;F · Esc
      </div>

      {/* Tiny exit link — only obvious if you're looking. Recordings won't pick it up at the corner. */}
      <Link
        to="/"
        className="absolute top-7 left-1/2 -translate-x-1/2 z-30 font-mono text-[8px] tracking-[0.22em] uppercase text-vellum-mute opacity-0 hover:opacity-60 transition-opacity"
        aria-label="Exit deck"
      >
        ⤺ exit
      </Link>
    </>
  );
}

function SealGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="text-seal">
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
      <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
      <circle cx="20" cy="20" r="4" fill="currentColor" className="anim-pulse-seal" />
    </svg>
  );
}

function DeckGrain() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.025]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────────
// OVERVIEW (Esc / O) — 5×3 mini grid of all slides
// ────────────────────────────────────────────────────────────────

function Overview({ index, onPick, onClose }: { index: number; onPick: (n: number) => void; onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-50 bg-ink/95 backdrop-blur-md flex flex-col"
      onClick={onClose}
    >
      <div className="px-12 pt-10 pb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-block w-8 h-px bg-seal" />
          <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-vellum-mute">
            Overview · 15 slides · click any to jump
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.28em] uppercase text-vellum-mute">
          Esc to dismiss
        </span>
      </div>
      <div
        className="flex-1 px-12 pb-12 grid grid-cols-5 grid-rows-3 gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {SLIDES.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(i)}
            className={`relative text-left p-5 transition-all bg-ink-2/60 hover:bg-ink-2 hover:-translate-y-0.5 ${
              i === index ? "hairline-seal ring-1 ring-seal" : "hairline"
            }`}
          >
            <div className="font-mono text-[9px] tracking-[0.28em] uppercase text-vellum-mute">
              {String(i + 1).padStart(2, "0")} · {s.label}
            </div>
            <div className="mt-3 font-display text-vellum text-[18px] leading-[1.05] line-clamp-3">
              {s.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// SLIDE STYLES (inlined — keeps the deck self-contained)
// ────────────────────────────────────────────────────────────────

function DeckStyles() {
  return (
    <style>{`
      .deck-root { font-feature-settings: "ss01", "ss02"; }
      .cursor-none, .cursor-none * { cursor: none !important; }

      @keyframes slide-fwd {
        from { opacity: 0; transform: translate3d(40px, 0, 0); }
        to   { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      @keyframes slide-back {
        from { opacity: 0; transform: translate3d(-40px, 0, 0); }
        to   { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      .slide-enter-fwd  { animation: slide-fwd  520ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
      .slide-enter-back { animation: slide-back 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }

      @keyframes draw-line {
        from { stroke-dashoffset: var(--len, 1000); }
        to   { stroke-dashoffset: 0; }
      }
      .draw-line {
        stroke-dasharray: var(--len, 1000);
        animation: draw-line 1600ms 200ms cubic-bezier(0.6, 0.05, 0.25, 1) both;
      }

      @keyframes type-cursor {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
      .type-caret { display: inline-block; width: 0.4ch; background: currentColor; margin-left: 0.1ch; animation: type-cursor 900ms steps(1) infinite; }

      @keyframes folio-rise {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .folio-rise { animation: folio-rise 700ms 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }

      @keyframes hero-glow {
        0%, 100% { filter: drop-shadow(0 0 30px rgba(6,182,212,0.15)); }
        50%      { filter: drop-shadow(0 0 60px rgba(6,182,212,0.35)); }
      }
      .hero-glow { animation: hero-glow 4s ease-in-out infinite; }

      .line-clamp-3 {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `}</style>
  );
}

// ────────────────────────────────────────────────────────────────
// SLIDE FRAME — common spatial scaffold for every slide
// ────────────────────────────────────────────────────────────────

function Frame({ children, align = "center", padTop = false }: {
  children: React.ReactNode;
  align?: "center" | "top";
  padTop?: boolean;
}) {
  return (
    <div className={`absolute inset-0 flex ${align === "center" ? "items-center" : "items-start"} justify-center`}>
      <div
        className={`relative w-full h-full max-w-[1640px] mx-auto px-10 md:px-20 ${padTop ? "pt-32 md:pt-40" : "pt-24 md:pt-28"} pb-24 md:pb-28 flex flex-col ${align === "center" ? "justify-center" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// THE 15 SLIDES
// ════════════════════════════════════════════════════════════════

// ── 01 · HERO ───────────────────────────────────────────────────
function Slide01() {
  return (
    <Frame align="center">
      <div className="flex flex-col items-start max-w-[1280px]">
        <div className="eyebrow fade-up flex items-center gap-3">
          <span className="inline-block w-8 h-px bg-seal" />
          A primitive · not an app
        </div>

        <h1 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(72px,11vw,184px)] leading-[0.86] tracking-[-0.045em] hero-glow">
          Sealed<span className="text-seal glow-text-seal">Mind</span>.
        </h1>

        <p className="font-display-italic fade-up-2 mt-10 text-vellum-dim text-[clamp(22px,2.4vw,38px)] leading-[1.2] max-w-[860px]">
          Your AI's lifetime memory — encrypted, permanent, transferable.
        </p>

        <div className="fade-up-3 mt-14 flex flex-wrap items-center gap-3">
          <Chip>Encrypted under your wallet key</Chip>
          <Chip>TEE-attested inference</Chip>
          <Chip>ERC-7857 iNFT</Chip>
          <Chip>Capability-shareable</Chip>
        </div>

        <div className="fade-up-4 mt-16 grid grid-cols-[auto,1fr] gap-x-6 gap-y-3 items-baseline">
          <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-vellum-mute">Site</span>
          <a href="https://sealedmind.vercel.app" className="font-mono text-[14px] text-seal-deep hover:text-seal underline-offset-2 hover:underline">
            sealedmind.vercel.app
          </a>
          <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-vellum-mute">Source</span>
          <a href="https://github.com/SealedMind/SealedMindMonoRepo" className="font-mono text-[14px] text-seal-deep hover:text-seal underline-offset-2 hover:underline">
            github.com/SealedMind/SealedMindMonoRepo
          </a>
        </div>
      </div>

      {/* Massive folio mark, bottom-right of the page — magazine-cover energy */}
      <div className="absolute right-20 bottom-32 hidden lg:flex flex-col items-end folio-rise">
        <div className="font-display text-vellum/[0.08] text-[260px] leading-none tracking-[-0.05em] select-none pointer-events-none">
          01
        </div>
      </div>
    </Frame>
  );
}

// ── 02 · PROBLEM ────────────────────────────────────────────────
function Slide02() {
  const problems = [
    {
      n: "i",
      title: "AI has no persistent memory.",
      body: "Every conversation starts from zero. You explain yourself to ChatGPT, then to Claude, then to your company's internal AI. There is no standard way for an agent to remember you across sessions, platforms, or providers.",
    },
    {
      n: "ii",
      title: "When AI does remember — you don't own it.",
      body: "Your ChatGPT history belongs to OpenAI's servers. Your health data shared with an AI assistant lives in that company's database. You can't take it with you. You can't sell it. You can't will it to your kid.",
    },
    {
      n: "iii",
      title: "Zero privacy. Zero proof.",
      body: "AI providers can read, train on, or sell your data. \"We don't read your data\" is policy, not math. There is no cryptographic receipt that the LLM saw your data inside a sealed environment.",
    },
  ];
  return (
    <Frame align="center">
      <div className="grid grid-cols-12 gap-8 lg:gap-16">
        {/* Left column — headline + verdict */}
        <div className="col-span-12 lg:col-span-5 flex flex-col">
          <div className="eyebrow fade-up flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-crimson" />
            The problem · in three parts
          </div>
          <h2 className="font-display fade-up-1 mt-7 text-vellum text-[clamp(48px,5.6vw,92px)] leading-[0.92] tracking-[-0.035em]">
            AI has amnesia.
            <br />
            <span className="font-display-italic text-vellum-dim">And your data</span>
            <br />
            <span className="text-crimson">is naked.</span>
          </h2>
          <p className="font-display-italic fade-up-2 mt-10 text-vellum-dim text-[20px] leading-[1.4] max-w-[420px]">
            The average person uses 4+ AI tools — none share memory, none are private. Until now.
          </p>
        </div>

        {/* Right column — three problem cards */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-5 self-center">
          {problems.map((p, i) => (
            <article
              key={p.n}
              className={`fade-up-${i + 2} grid grid-cols-[44px,1fr] gap-6 items-start p-6 hairline bg-ink/60`}
            >
              <span className="font-display-italic text-crimson text-[28px] leading-none">{p.n}.</span>
              <div>
                <h3 className="font-display text-vellum text-[22px] leading-[1.15]">{p.title}</h3>
                <p className="mt-2 text-vellum-dim text-[13.5px] leading-[1.6]">{p.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// ── 03 · WHY NOW ────────────────────────────────────────────────
function Slide03() {
  return (
    <Frame align="center">
      <div className="eyebrow fade-up flex items-center gap-3">
        <span className="inline-block w-8 h-px bg-seal" />
        Why now · a now-or-never moment
      </div>

      <h2 className="font-display fade-up-1 mt-7 text-vellum text-[clamp(48px,5.6vw,96px)] leading-[0.92] tracking-[-0.035em] max-w-[1100px]">
        Two missing primitives.
        <br />
        <span className="font-display-italic text-seal glow-text-seal">Both finally exist.</span>
      </h2>

      <div className="mt-16 grid grid-cols-2 gap-10 lg:gap-20">
        <Pillar
          delay={2}
          eyebrow="01 · Memory you actually own"
          headline="ERC-7857 iNFTs · client-side AES-256-GCM · 0G Storage"
          bullets={[
            "ERC-7857 standard for AI agent identity shipped in 2025",
            "AES-256-GCM under wallet-derived keys — a 5-line cryptographic primitive that no AI memory product wired end-to-end",
            "Decentralized blob storage finally fast enough for real-time memory writes",
          ]}
        />
        <Pillar
          delay={3}
          eyebrow="02 · Hardware-attested inference"
          headline="Intel TDX + NVIDIA H100 confidential GPU"
          bullets={[
            "Intel TDX + H100 confidential GPUs in production data centers since 2024",
            "0G Sealed Inference exposes them via SDK with signed attestations",
            "Cryptographic receipts on every LLM call — math, not policy",
          ]}
        />
      </div>

      {/* Timeline — magazine footer flourish */}
      <div className="fade-up-5 mt-16 grid grid-cols-4 gap-0 hairline-seal py-5 px-6 bg-ink/60">
        {["2023 · Foundation models", "2024 · H100 TDX general availability", "2025 · ERC-7857 iNFT standard", "2026 · SealedMind"].map((label, i) => (
          <div key={label} className="flex items-center gap-3 px-2">
            <span className={`inline-block w-2 h-2 rounded-full ${i === 3 ? "bg-seal anim-pulse-seal" : "bg-vellum-mute/40"}`} />
            <span className={`font-mono text-[10px] tracking-[0.18em] uppercase ${i === 3 ? "text-seal-deep" : "text-vellum-mute"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Pillar({ delay, eyebrow, headline, bullets }: { delay: 1 | 2 | 3 | 4 | 5; eyebrow: string; headline: string; bullets: string[] }) {
  return (
    <div className={`fade-up-${delay} flex flex-col gap-4`}>
      <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-seal-deep">{eyebrow}</div>
      <h3 className="font-display text-vellum text-[28px] leading-[1.15] max-w-[440px]">{headline}</h3>
      <ul className="mt-4 space-y-3">
        {bullets.map((b) => (
          <li key={b} className="grid grid-cols-[12px,1fr] gap-3 items-start text-vellum-dim text-[14px] leading-[1.55]">
            <span className="inline-block w-1.5 h-1.5 mt-2 bg-seal" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── 04 · THREE PILLARS ──────────────────────────────────────────
function Slide04() {
  const pillars = [
    {
      ic: "🔒",
      glyph: "I",
      name: "Sealed",
      one: "AES-256-GCM under your wallet key. We are blind.",
      details: [
        "Encrypted before it leaves your device",
        "HKDF-SHA256 from your wallet signature",
        "Server-side mathematically blind to plaintext",
        "Not even with a court order",
      ],
    },
    {
      ic: "📦",
      glyph: "II",
      name: "Portable",
      one: "One Mind ID. Works with any agent. Forever.",
      details: [
        "Mind ID = your wallet address",
        "Any agent, any platform, any device",
        "Switch from Claude to GPT to internal LLM",
        "ERC-7857 iNFT — sell · lease · inherit",
      ],
    },
    {
      ic: "✅",
      glyph: "III",
      name: "Provable",
      one: "Intel TDX attestation + on-chain audit. Math, not promises.",
      details: [
        "Qwen 2.5 7B inside Intel TDX + NVIDIA H100",
        "Signed TEE attestation per query",
        "On-chain MemoryAccessLog for every read/write",
        "Verify Proof button → chainscan link",
      ],
    },
  ];
  return (
    <Frame align="center">
      <div className="eyebrow fade-up flex items-center gap-3">
        <span className="inline-block w-8 h-px bg-seal" />
        The solution · three pillars
      </div>
      <h2 className="font-display fade-up-1 mt-7 text-vellum text-[clamp(56px,7vw,124px)] leading-[0.9] tracking-[-0.04em]">
        Sealed.{" "}
        <span className="font-display-italic text-seal glow-text-seal">Portable.</span>{" "}
        Provable.
      </h2>

      <div className="mt-16 grid grid-cols-3 gap-6">
        {pillars.map((p, i) => (
          <article key={p.name} className={`fade-up-${i + 2} terminal-frame hairline-seal p-7 flex flex-col`}>
            <div className="flex items-baseline justify-between">
              <span className="font-display text-seal text-[44px] leading-none">{p.glyph}</span>
              <span className="text-[28px] opacity-70">{p.ic}</span>
            </div>
            <h3 className="font-display mt-5 text-vellum text-[34px] leading-[1.05] tracking-[-0.02em]">{p.name}</h3>
            <p className="font-display-italic mt-3 text-vellum-dim text-[15px] leading-[1.45]">{p.one}</p>
            <ul className="mt-6 space-y-2">
              {p.details.map((d) => (
                <li key={d} className="flex gap-2 items-start text-vellum text-[12.5px] leading-[1.5]">
                  <span className="inline-block w-1 h-1 mt-2 bg-seal flex-shrink-0" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Frame>
  );
}

// ── 05 · THREE OPERATIONS ───────────────────────────────────────
function Slide05() {
  const ops = [
    {
      sig: "remember(content, shard)",
      steps: [
        "Two-pass extraction (regex → TEE-LLM)",
        "AES-256-GCM encrypt with your wallet key",
        "Upload ciphertext to 0G Storage",
        "Background tx → MemoryAccessLog",
      ],
      out: "→ memories[] · attestation · txHash",
    },
    {
      sig: "recall(query, shard?, topK?)",
      steps: [
        "HNSW vector search (384d, all-MiniLM-L6-v2)",
        "Top-K matches → Qwen 2.5 7B in Intel TDX",
        "Synthesized answer + signed attestation",
        "Background tx → MemoryAccessLog",
      ],
      out: "→ answer · memories[] · attestation",
    },
    {
      sig: "grantCapability(grantee, shard, expiry)",
      steps: [
        "On-chain tx to CapabilityRegistry",
        "Time-bound, scoped, revocable",
        "Grantee can recall via the gateway",
        "Owner revokes in one tx → instant 403",
      ],
      out: "→ capId · txHash",
    },
  ];
  return (
    <Frame align="center">
      <div className="grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-4 flex flex-col">
          <div className="eyebrow fade-up flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-seal" />
            The API · in its entirety
          </div>
          <h2 className="font-display fade-up-1 mt-7 text-vellum text-[clamp(44px,5vw,84px)] leading-[0.92] tracking-[-0.035em]">
            Three calls.
            <br />
            <span className="font-display-italic text-seal">Memory you own.</span>
          </h2>
          <p className="fade-up-2 mt-8 text-vellum-dim text-[15px] leading-[1.6] max-w-[360px]">
            That's the whole API surface. Everything else — capability rental, on-chain audit, TEE attestation, iNFT ownership — is something the protocol gives you for free once those three exist.
          </p>

          <div className="fade-up-3 mt-10 hairline-seal p-4 bg-ink/60">
            <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-seal-deep">The invisible bonus</div>
            <p className="mt-2 text-vellum text-[13px] leading-[1.55]">
              Every operation now returns <code className="font-mono text-seal-deep">onChainTxHash</code> + <code className="font-mono text-seal-deep">onChainExplorerUrl</code> in the attestation payload — clickable proof in one tap.
            </p>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          {ops.map((o, i) => (
            <article key={o.sig} className={`fade-up-${i + 2} terminal-frame hairline-seal p-5`}>
              <div className="flex items-baseline justify-between gap-4">
                <code className="font-mono text-[14px] md:text-[16px] text-seal break-all">{o.sig}</code>
                <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">op · {String(i + 1).padStart(2, "0")}</span>
              </div>
              <ol className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {o.steps.map((s, j) => (
                  <li key={s} className="flex gap-2 text-vellum text-[12.5px] leading-[1.5]">
                    <span className="font-mono text-vellum-mute text-[11px] mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 pt-3 border-t border-vellum/5 font-mono text-[11.5px] text-seal-deep">{o.out}</div>
            </article>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// ── 06 · ARCHITECTURE ───────────────────────────────────────────
function Slide06() {
  return (
    <Frame align="center">
      <div className="grid grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="col-span-12 lg:col-span-3 flex flex-col">
          <div className="eyebrow fade-up flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-seal" />
            System architecture
          </div>
          <h2 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(36px,3.6vw,60px)] leading-[0.95] tracking-[-0.03em]">
            Six trust boundaries. Eight contracts.{" "}
            <span className="font-display-italic text-seal-deep">Zero hand-waving.</span>
          </h2>
          <p className="fade-up-2 mt-6 text-vellum-dim text-[13.5px] leading-[1.6]">
            Every node deployed. Every line a flow that runs in production. Click any contract on chainscan — verified source.
          </p>
          <div className="fade-up-3 mt-6 flex flex-col gap-2">
            <Legend tone="seal" label="User / Browser / 0G Storage — encrypted boundary" />
            <Legend tone="ember" label="Backend operator / TEE enclave — attested boundary" />
            <Legend tone="rune" label="0G Chain — public, immutable" />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-9 fade-up-3">
          <ArchDiagram />
        </div>
      </div>
    </Frame>
  );
}

function Legend({ tone, label }: { tone: "seal" | "ember" | "rune"; label: string }) {
  const dot = tone === "seal" ? "bg-seal" : tone === "ember" ? "bg-ember" : "bg-rune";
  return (
    <div className="flex items-start gap-2.5">
      <span className={`inline-block w-2 h-2 mt-1 ${dot}`} />
      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-vellum-dim">{label}</span>
    </div>
  );
}

function ArchDiagram() {
  // Compact version of the /architecture diagram, sized for slide canvas.
  return (
    <svg viewBox="0 0 1100 620" width="100%" className="block" role="img" aria-label="SealedMind architecture">
      <defs>
        <marker id="dk-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#06B6D4" />
        </marker>
        <marker id="dk-arrow-rune" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#8B5CF6" />
        </marker>
      </defs>

      {/* Top row — user/browser/backend boundaries */}
      <BoundaryLabel x={20} y={28} label="01 — User wallet" />
      <rect x={20} y={40} width={210} height={120} fill="rgba(6,182,212,0.04)" stroke="#06B6D4" strokeOpacity="0.5" strokeDasharray="4 4" strokeWidth="1.5" />
      <ArchNode x={40} y={66} w={170} h={70} title="MetaMask" sub="EOA · master key" tag="signs SIWE & EIP-712" tone="seal" />

      <BoundaryLabel x={260} y={28} label="02 — Browser (client)" />
      <rect x={260} y={40} width={300} height={120} fill="rgba(6,182,212,0.04)" stroke="#06B6D4" strokeOpacity="0.5" strokeDasharray="4 4" strokeWidth="1.5" />
      <ArchNode x={280} y={66} w={260} h={70} title="sealedmind.vercel.app" sub="React + viem + wagmi" tag="key derivation · AttestationCard" tone="seal" />

      <BoundaryLabel x={590} y={28} label="03 — Backend operator (cannot read plaintext)" />
      <rect x={590} y={40} width={490} height={250} fill="rgba(245,158,11,0.04)" stroke="#F59E0B" strokeOpacity="0.45" strokeDasharray="4 4" strokeWidth="1.5" />
      <ArchNode x={610} y={66} w={210} h={70} title="MemoryEngine" sub="ts · per-mind isolated" tag="encrypt → upload → log" tone="seal" />
      <ArchNode x={840} y={66} w={220} h={70} title="TwoPassExtract" sub="regex → TEE-LLM" tag="zero-shot fact distillation" tone="seal" />
      <ArchNode x={610} y={170} w={210} h={70} title="CapabilityEnforcer" sub="reads on-chain registry" tag="403 unless caller has cap" tone="seal" />
      <ArchNode x={840} y={170} w={220} h={70} title="OperatorAuth" sub="sm_op_* + rate-limit" tag="bearer token + bucket" tone="seal" />

      {/* Bottom row — 0G stack */}
      <BoundaryLabel x={20} y={328} label="04 — 0G Storage (encrypted at rest)" />
      <rect x={20} y={340} width={300} height={250} fill="rgba(6,182,212,0.04)" stroke="#06B6D4" strokeOpacity="0.4" strokeDasharray="4 4" strokeWidth="1.5" />
      <ArchNode x={40} y={368} w={260} h={70} title="0G Storage Indexer" sub="erasure-coded blobs" tag="AES-256-GCM ciphertext" tone="seal" />
      <ArchNode x={40} y={462} w={260} h={110} title="Encrypted memory blobs" sub="indexed by rootHash" tag={"keys never leave\nthe browser"} tone="seal" multiline />

      <BoundaryLabel x={350} y={328} label="05 — TEE enclave" />
      <rect x={350} y={340} width={300} height={250} fill="rgba(245,158,11,0.04)" stroke="#F59E0B" strokeOpacity="0.5" strokeDasharray="4 4" strokeWidth="1.5" />
      <ArchNode x={370} y={368} w={260} h={70} title="0G Compute broker" sub="ZG-Serving SDK" tag="returns chatId + attestation" tone="ember" />
      <ArchNode x={370} y={462} w={260} h={110} title="Qwen 2.5 7B in TDX" sub="confidential GPU" tag={"prompt + reply sealed,\nremote-attested"} tone="ember" multiline />

      <BoundaryLabel x={680} y={328} label="06 — 0G Chain · 16602 / 16661" />
      <rect x={680} y={340} width={400} height={250} fill="rgba(139,92,246,0.04)" stroke="#8B5CF6" strokeOpacity="0.5" strokeDasharray="4 4" strokeWidth="1.5" />
      <ArchNode x={700} y={368} w={360} h={48} title="SealedMindNFT" sub="ERC-7857 iNFT" tag="0xb6dB…05c1" tone="rune" small />
      <ArchNode x={700} y={425} w={360} h={48} title="CapabilityRegistry" sub="grant / revoke / hasCap" tag="0xeb2F…fa45" tone="rune" small />
      <ArchNode x={700} y={482} w={360} h={48} title="MemoryAccessLog" sub="immutable audit trail" tag="0xB085…4482" tone="rune" small />
      <ArchNode x={700} y={539} w={360} h={42} title="+ 5 supporting contracts" sub="all source-verified" tag="" tone="rune" small />

      <ArchEdge x1={210} y1={100} x2={280} y2={100} />
      <ArchEdge x1={540} y1={100} x2={610} y2={100} />
      <ArchEdge x1={715} y1={136} x2={715} y2={170} />
      <ArchEdge x1={950} y1={136} x2={950} y2={170} />
      <ArchEdge x1={715} y1={240} x2={170} y2={368} curve />
      <ArchEdge x1={820} y1={240} x2={500} y2={368} curve />
      <ArchEdge x1={950} y1={240} x2={500} y2={368} curve />
      <ArchEdge x1={950} y1={240} x2={880} y2={392} curve tone="ember" />
      <ArchEdge x1={715} y1={240} x2={880} y2={392} curve tone="rune" />
      <ArchEdge x1={715} y1={240} x2={880} y2={449} curve tone="rune" />
      <ArchEdge x1={715} y1={240} x2={880} y2={506} curve tone="rune" />
    </svg>
  );
}

function ArchNode({ x, y, w, h, title, sub, tag, tone, multiline, small }: {
  x: number; y: number; w: number; h: number;
  title: string; sub: string; tag: string;
  tone: "seal" | "rune" | "ember"; multiline?: boolean; small?: boolean;
}) {
  const stroke = tone === "seal" ? "#06B6D4" : tone === "rune" ? "#8B5CF6" : "#F59E0B";
  const fill = tone === "seal" ? "rgba(6,182,212,0.06)" : tone === "rune" ? "rgba(139,92,246,0.06)" : "rgba(245,158,11,0.06)";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth="1.2" />
      <text x={x + 12} y={y + 22} fontFamily="Fraunces, serif" fontSize={small ? 14 : 17} fill="#0A3A4A" fontWeight="600">{title}</text>
      <text x={x + 12} y={y + 39} fontFamily="JetBrains Mono, monospace" fontSize={9} letterSpacing="1.5" fill="#1A6070">{sub.toUpperCase()}</text>
      {tag && !multiline && (
        <text x={x + 12} y={y + h - 12} fontFamily="JetBrains Mono, monospace" fontSize={10} fill="#5A9AAA">{tag}</text>
      )}
      {tag && multiline && tag.split("\n").map((line, i) => (
        <text key={i} x={x + 12} y={y + 60 + i * 14} fontFamily="JetBrains Mono, monospace" fontSize={10} fill="#5A9AAA">{line}</text>
      ))}
    </g>
  );
}

function ArchEdge({ x1, y1, x2, y2, curve, tone = "seal" }: {
  x1: number; y1: number; x2: number; y2: number; curve?: boolean; tone?: "seal" | "rune" | "ember";
}) {
  const stroke = tone === "seal" ? "#06B6D4" : tone === "rune" ? "#8B5CF6" : "#F59E0B";
  const marker = tone === "rune" ? "url(#dk-arrow-rune)" : "url(#dk-arrow)";
  if (!curve) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="1.2" markerEnd={marker} opacity="0.7" />;
  }
  const mid = (y1 + y2) / 2;
  return (
    <path d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`} stroke={stroke} strokeWidth="1.2" fill="none" markerEnd={marker} opacity="0.6" />
  );
}

function BoundaryLabel({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <text x={x} y={y} fontFamily="JetBrains Mono, monospace" fontSize={9} letterSpacing="1.5" fill="#0A3A4A" fontWeight="600">
      {label.toUpperCase()}
    </text>
  );
}

// ── 07 · THREAT MODEL ───────────────────────────────────────────
function Slide07() {
  const threats = [
    { layer: "Encryption boundary", who: "Honest-but-curious operator", sees: "Ciphertext + CIDs only. Cannot decrypt.", by: "Per-user master key derivation in browser; HKDF seed only on server." },
    { layer: "0G Storage shards", who: "Malicious storage node", sees: "AES-256-GCM ciphertext + opaque rootHash. No metadata.", by: "Client-side AES-256-GCM with user-derived key. Storage treated as untrusted." },
    { layer: "TEE enclave", who: "Compromised inference host", sees: "Nothing — sealed in Intel TDX + H100.", by: "TEE remote attestation per chat. Verify Proof button rechecks enclave hash." },
    { layer: "Capability + audit", who: "Capability bearer gone rogue", sees: "Only granted shards. Every read on-chain.", by: "On-chain CapabilityRegistry + revokeCapability(). Owner sees abuse, revokes in one tx." },
    { layer: "Trust separation", who: "Stolen operator PRIVATE_KEY", sees: "Can mint MemoryAccessLog + pay gas. Cannot decrypt anything.", by: "Hard separation: ops wallet relays + pays gas; user keys live in user browsers." },
    { layer: "User boundary", who: "Stolen user wallet", sees: "Everything the user sees — same as any wallet compromise.", by: "SealedMind's role: revoke shared capabilities the moment user notices, in one tx." },
  ];
  return (
    <Frame align="center">
      <div className="flex items-end justify-between gap-10">
        <div>
          <div className="eyebrow fade-up flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-seal" />
            Threat model · in full
          </div>
          <h2 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(48px,5.6vw,96px)] leading-[0.92] tracking-[-0.035em] max-w-[1100px]">
            Six adversaries. <span className="font-display-italic text-seal-deep">Six receipts.</span>
          </h2>
        </div>
        <p className="fade-up-2 hidden lg:block max-w-[360px] text-vellum-dim text-[14px] leading-[1.55]">
          Most "private AI" pitches stop at <em>the database is encrypted</em>. We point to a math primitive at every layer.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-3 grid-rows-2 gap-4">
        {threats.map((t, i) => (
          <article key={t.who} className={`fade-up-${Math.min(i + 2, 5)} hairline bg-ink/60 p-5 flex flex-col`}>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">{t.layer}</div>
            <h3 className="font-display mt-2 text-vellum text-[22px] leading-[1.1]">{t.who}</h3>
            <div className="mt-4 flex-1 grid grid-cols-1 gap-3 text-[13px]">
              <div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-dim">they see</div>
                <p className="mt-1.5 text-vellum-dim leading-[1.55]">{t.sees}</p>
              </div>
              <div className="pt-2 border-t border-vellum/5">
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal">↳ defeated by</div>
                <p className="mt-1.5 text-vellum leading-[1.55]">{t.by}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Frame>
  );
}

// ── 08 · 0G STACK ───────────────────────────────────────────────
function Slide08() {
  const layers = [
    {
      n: "0G Storage",
      sub: "Decentralized blob storage",
      body: "Every encrypted memory blob (AES-256-GCM ciphertext) uploaded via @0gfoundation/0g-ts-sdk. RootHash + txHash returned per memory; auditable on chainscan. Storage nodes hold opaque ciphertext only — no metadata leakage.",
      tone: "seal",
    },
    {
      n: "0G Compute · Sealed Inference",
      sub: "Hardware-attested LLM",
      body: "Qwen 2.5 7B Instruct running inside Intel TDX + NVIDIA H100 confidential GPU via @0glabs/0g-serving-broker. Used for fact extraction (remember), synthesis (recall), and standalone chat. Returns signed attestation per call.",
      tone: "ember",
    },
    {
      n: "0G Chain · 16602 / 16661",
      sub: "Public, immutable settlement",
      body: "4 SealedMind contracts deployed + source-verified on mainnet AND testnet. ERC-7857 iNFT for Mind ownership. CapabilityRegistry for revocable shared access. MemoryAccessLog for immutable audit trail.",
      tone: "rune",
    },
  ];
  return (
    <Frame align="center">
      <div className="grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-4">
          <div className="eyebrow fade-up flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-seal" />
            0G stack · maximum-leverage
          </div>
          <h2 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(40px,4.4vw,72px)] leading-[0.95] tracking-[-0.03em]">
            Every layer is <span className="font-display-italic text-seal-deep">load-bearing.</span>
          </h2>
          <p className="fade-up-2 mt-7 text-vellum-dim text-[14px] leading-[1.6]">
            No other chain offers all three layers natively. Stitching together AWS S3 + a vector DB + Azure TEE + an L2 for the iNFT would take six months and four trust boundaries we don't have.
          </p>
          <div className="fade-up-3 mt-7 hairline-seal p-4 bg-ink/60">
            <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-seal-deep">The composition story</div>
            <p className="mt-2 text-vellum text-[13px] leading-[1.55]">
              0G ships them as one stack. SealedMind is what you build on top.
            </p>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          {layers.map((l, i) => {
            const accent = l.tone === "seal" ? "hairline-seal" : l.tone === "ember" ? "border-ember/40" : "hairline-rune";
            const ac = l.tone === "seal" ? "text-seal-deep" : l.tone === "ember" ? "text-ember" : "text-rune-deep";
            return (
              <article key={l.n} className={`fade-up-${i + 2} relative p-6 bg-ink/60 ${accent} border`}>
                <div className="grid grid-cols-[180px,1fr] gap-6 items-start">
                  <div>
                    <div className={`font-mono text-[9px] tracking-[0.22em] uppercase ${ac}`}>{String(i + 1).padStart(2, "0")} · layer</div>
                    <h3 className="font-display mt-2 text-vellum text-[26px] leading-[1.05]">{l.n}</h3>
                    <div className="font-display-italic mt-1 text-vellum-dim text-[13px]">{l.sub}</div>
                  </div>
                  <p className="text-vellum text-[13.5px] leading-[1.6]">{l.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

// ── 09 · WHAT'S SHIPPED ─────────────────────────────────────────
function Slide09() {
  const checklist = [
    "8 contracts deployed + source-verified on 0G Mainnet (16661) AND Galileo Testnet (16602)",
    "MemoryAccessLog wired end-to-end — chainscan-clickable proof in verify response",
    "Hardware-attested LLM inference — Qwen 2.5 7B in Intel TDX + NVIDIA H100",
    "@sealedmind/sdk on npm — TypeScript, MIT, full typings",
    "sealedmind on PyPI — async Python SDK",
    "evermemos-sealedmind on PyPI — drop-in addon for 0gfoundation/0g-memory",
    "Live two-agent capability demo at sealedmind.vercel.app/demo",
    "Live /architecture page with SVG diagram + threat model",
    "CLI (sealedmind login | remember | recall | grant) — scriptable workflows",
    "81 tests across 4 suites — contracts, SDK, backend, CLI",
  ];
  const contracts = [
    { name: "SealedMindNFT", addr: "0x091CfC4b9E6FF0026F384b8c4664B8C03Af21EA6" },
    { name: "CapabilityRegistry", addr: "0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45" },
    { name: "MemoryAccessLog", addr: "0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad" },
    { name: "Verifier", addr: "0x6D5B3B81119F78366B767DB81C2dd6625d5648Af" },
  ];
  return (
    <Frame align="center">
      <div className="eyebrow fade-up flex items-center gap-3">
        <span className="inline-block w-8 h-px bg-seal" />
        What's shipped · all on chain · all public
      </div>
      <h2 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(48px,5.6vw,96px)] leading-[0.92] tracking-[-0.035em] max-w-[1100px]">
        Ten things shipped.{" "}
        <span className="font-display-italic text-seal-deep">All auditable.</span>
      </h2>

      <div className="mt-10 grid grid-cols-12 gap-8">
        <ul className="col-span-12 lg:col-span-7 fade-up-2 grid grid-cols-1 gap-2">
          {checklist.map((c, i) => (
            <li key={c} className="grid grid-cols-[28px,1fr] gap-3 items-start text-vellum text-[13.5px] leading-[1.45]">
              <span className="font-mono text-[10px] text-seal mt-1">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex gap-2">
                <span className="text-seal mt-0.5">✓</span>
                <span>{c}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="col-span-12 lg:col-span-5 fade-up-3">
          <div className="hairline-seal p-5 bg-ink/60">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-seal-deep">Mainnet · 16661</div>
              <span className="font-mono text-[8px] tracking-[0.22em] uppercase text-vellum-mute">verified</span>
            </div>
            <table className="mt-4 w-full border-collapse">
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.name} className="border-b border-vellum/5 last:border-0">
                    <td className="py-2.5 pr-3 font-display text-vellum text-[14px]">{c.name}</td>
                    <td className="py-2.5 font-mono text-[10.5px] text-seal-deep break-all">{c.addr.slice(0, 10)}…{c.addr.slice(-6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-5 pt-4 border-t border-vellum/10 grid grid-cols-2 gap-3 text-[10px] text-vellum-dim font-mono">
              <div>
                <div className="tracking-[0.22em] uppercase text-vellum-mute">Deployer</div>
                <div className="mt-1 text-seal-deep break-all">0x21fc05b…2302</div>
              </div>
              <div>
                <div className="tracking-[0.22em] uppercase text-vellum-mute">Explorer</div>
                <div className="mt-1 text-seal-deep">chainscan.0g.ai</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ── 10 · USE CASES ──────────────────────────────────────────────
function Slide10() {
  const cases = [
    { ic: "🏥", k: "Healthcare", h: "Medical history on your terms",
      s: "Specialist's AI gets read access to your health shard for 7 days. Appointment over, you revoke. Audit log proves what they read, when, in which TEE.",
      pun: "Compliance artifact: BAA-able." },
    { ic: "💰", k: "Finance", h: "Advisor with your full picture",
      s: "Your finance shard holds everything. CA's AI gets temporary access during tax season. Switch fintech apps — your financial memory comes with you.",
      pun: "No vendor lock-in." },
    { ic: "⚖️", k: "Legal", h: "Privilege with cryptographic proof",
      s: "Case strategy in your legal shard. Switch firms mid-case → revoke old, grant new in seconds. TEE attestation = privileged data never left the enclave.",
      pun: "Attorney-client privilege in the AI era." },
    { ic: "🎓", k: "Education", h: "A profile that grows for 30 years",
      s: "Tutor at 15 → tutor at 25 → professional upskilling at 35. Same education shard. Every tutor AI builds on the last.",
      pun: "No more starting from zero." },
    { ic: "🏢", k: "Enterprise", h: "Agent-to-agent delegation",
      s: "Sales agent grants Proposal agent read on deals shard for 24h. Auto-expires. Compliance team verifies on-chain who accessed what.",
      pun: "On-chain permissions, granular." },
    { ic: "🤖", k: "Personal AI", h: "A companion that knows you",
      s: "Tell Life OS about your allergies → it seals to health. Ask \"can I eat prawn biryani?\" → recalls and answers no. Switch from Claude to GPT — memory follows.",
      pun: "The Life OS demo — live now." },
  ];
  return (
    <Frame align="center">
      <div className="eyebrow fade-up flex items-center gap-3">
        <span className="inline-block w-8 h-px bg-seal" />
        Real use cases · six verticals
      </div>
      <h2 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(40px,5vw,80px)] leading-[0.92] tracking-[-0.035em] max-w-[1200px]">
        Where <span className="font-display-italic text-seal-deep">"memory you own"</span> isn't optional.
      </h2>

      <div className="mt-10 grid grid-cols-3 grid-rows-2 gap-4">
        {cases.map((c, i) => (
          <article key={c.k} className={`fade-up-${Math.min(i + 2, 5)} group relative hairline bg-ink/70 p-5 flex flex-col hover:hairline-seal transition-all`}>
            <div className="flex items-baseline justify-between">
              <span className="text-[28px] opacity-80">{c.ic}</span>
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">{c.k}</span>
            </div>
            <h3 className="font-display mt-3 text-vellum text-[22px] leading-[1.15]">{c.h}</h3>
            <p className="mt-3 text-vellum-dim text-[13.5px] leading-[1.6] flex-1">{c.s}</p>
            <p className="font-display-italic mt-3 text-seal-deep text-[13.5px] leading-[1.45]">{c.pun}</p>
          </article>
        ))}
      </div>
    </Frame>
  );
}

// ── 11 · COLLABORATIONS ─────────────────────────────────────────
function Slide11() {
  return (
    <Frame align="center">
      <div className="flex items-end justify-between gap-10">
        <div>
          <div className="eyebrow fade-up flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-seal" />
            Collaborations · the stack
          </div>
          <h2 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(44px,5vw,88px)] leading-[0.92] tracking-[-0.035em] max-w-[1100px]">
            SealedMind is the{" "}
            <span className="font-display-italic text-seal glow-text-seal">memory layer</span>
            <br />in <em className="font-display-italic">both</em> Daimon and VeilSolver.
          </h2>
        </div>
        <p className="fade-up-2 hidden lg:block max-w-[360px] text-vellum-dim text-[14.5px] leading-[1.6]">
          Two flagship 0G projects ship on top of the SealedMind primitive. Same iNFT memory. Same capability sharing. Same on-chain audit. Three teams, one stack.
        </p>
      </div>

      <div className="mt-12 fade-up-3">
        <CollabTopology />
      </div>
    </Frame>
  );
}

function CollabTopology() {
  return (
    <div className="relative w-full max-w-[1280px] mx-auto">
      {/* SealedMind at the top — the source primitive */}
      <div className="relative flex justify-center">
        <article className="terminal-frame hairline-seal p-6 w-full max-w-[640px]">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">Memory primitive · upstream</div>
              <h3 className="font-display mt-2 text-vellum text-[40px] leading-none">SealedMind</h3>
              <div className="font-display-italic mt-1 text-vellum-dim text-[14px]">
                ERC-7857 iNFT · TEE-attested · capability-shareable
              </div>
            </div>
            <div className="hidden md:block">
              <SealGlyph size={56} />
            </div>
          </div>
          <p className="mt-4 text-vellum text-[14px] leading-[1.55]">
            Encrypted AI memory iNFT. AES-256-GCM under wallet keys. On-chain <code className="font-mono text-seal-deep">MemoryAccessLog</code>. Three SDKs published.
          </p>
        </article>
      </div>

      {/* SVG flow lines connecting SealedMind down to both consumers */}
      <svg
        viewBox="0 0 1280 140"
        className="block w-full h-[140px] -my-2"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <marker id="collab-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#06B6D4" />
          </marker>
        </defs>
        {/* Down to Daimon (left) */}
        <path d="M 640 0 C 640 70, 280 50, 280 130" stroke="#06B6D4" strokeWidth="1.4" fill="none" strokeDasharray="3 4" markerEnd="url(#collab-arrow)" opacity="0.75" />
        {/* Down to VeilSolver (right) */}
        <path d="M 640 0 C 640 70, 1000 50, 1000 130" stroke="#06B6D4" strokeWidth="1.4" fill="none" strokeDasharray="3 4" markerEnd="url(#collab-arrow)" opacity="0.75" />
        {/* Edge labels */}
        <text x="380" y="48" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#0E7490" letterSpacing="1.5">
          USES SEALEDMIND SDK + iNFT
        </text>
        <text x="788" y="48" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#0E7490" letterSpacing="1.5">
          USES SEALEDMIND SDK + AUDIT
        </text>
      </svg>

      {/* The two consumer projects, side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daimon */}
        <article className="terminal-frame border border-ember/40 p-6 bg-ember/[0.03]">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ember">Consumer surface · downstream</div>
          <h3 className="font-display mt-2 text-vellum text-[32px] leading-[1.05]">Daimon</h3>
          <div className="font-display-italic mt-1 text-vellum-dim text-[13.5px]">
            Train it · Own it · Pass it on
          </div>
          <p className="mt-4 text-vellum text-[13.5px] leading-[1.6]">
            Tradeable AI trading agents. <strong>Each agent's brain is a SealedMind ERC-7857 iNFT.</strong> Memory · capability rental · on-chain audit — all delegated to SealedMind.
          </p>
          <div className="mt-4 hairline-seal p-3">
            <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-seal-deep">Marketplace · live on Galileo + Mainnet</div>
            <code className="block mt-1.5 font-mono text-[11.5px] text-seal break-all">0xb9D42824955b492BE4cBf13988C3d0Ad9985F807</code>
          </div>
        </article>

        {/* VeilSolver */}
        <article className="terminal-frame hairline-rune p-6 bg-ink/60">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rune-deep">Execution primitive · downstream</div>
          <h3 className="font-display mt-2 text-vellum text-[32px] leading-[1.05]">VeilSolver</h3>
          <div className="font-display-italic mt-1 text-vellum-dim text-[13.5px]">
            MEV-resistant intent solving
          </div>
          <p className="mt-4 text-vellum text-[13.5px] leading-[1.6]">
            ECIES-encrypted intents → TEE plan → ECDSA settlement. <strong>Strategy registry + audit trail run on SealedMind.</strong> Their bespoke storage layer became <code className="font-mono text-rune-deep">@sealedmind/sdk</code> calls.
          </p>
          <div className="mt-4 hairline-rune p-3">
            <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-rune-deep">Joint integration · published</div>
            <code className="block mt-1.5 font-mono text-[11.5px] text-vellum">VEILSOLVER_INTEGRATION.md</code>
          </div>
        </article>
      </div>
    </div>
  );
}

// ── 12 · BUSINESS MODEL ─────────────────────────────────────────
function Slide12() {
  const plans = [
    { name: "Hobby", price: "$0", incl: "1k / 500 / 200", target: "Indie · hackathon" },
    { name: "Builder", price: "$29", incl: "50k / 20k / 5k", target: "Startups · solo founders" },
    { name: "Team", price: "$149", incl: "500k / 200k / 50k", target: "Mid-market" },
    { name: "Enterprise", price: "$2k+", incl: "Custom + SLA", target: "Regulated industry" },
  ];
  return (
    <Frame align="center">
      <div className="eyebrow fade-up flex items-center gap-3">
        <span className="inline-block w-8 h-px bg-seal" />
        Business model · path to $1M ARR
      </div>
      <h2 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(44px,5vw,84px)] leading-[0.92] tracking-[-0.035em] max-w-[1200px]">
        Four streams. <span className="font-display-italic text-seal-deep">Hosted infra ready for billing.</span>
      </h2>

      <div className="mt-10 grid grid-cols-12 gap-5">
        {/* Stream 1 — Metered API */}
        <div className="col-span-12 lg:col-span-3 fade-up-2 hairline-seal p-5 bg-ink/60">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">01 · stream</div>
          <h3 className="font-display mt-2 text-vellum text-[24px] leading-[1.1]">Metered API</h3>
          <p className="font-display-italic mt-2 text-vellum-dim text-[13px]">Stripe Metered Billing</p>
          <ul className="mt-4 space-y-2 text-vellum text-[13px] leading-[1.5] font-mono">
            <li>$0.003 / remember</li>
            <li>$0.005 / recall</li>
            <li>$0.004 / inference</li>
          </ul>
          <p className="mt-4 text-vellum-dim text-[12.5px] leading-[1.5]">60-70% gross margin at scale.</p>
        </div>

        {/* Stream 2 — Subscriptions table */}
        <div className="col-span-12 lg:col-span-5 fade-up-3 hairline p-5 bg-ink/60">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">02 · stream</div>
          <h3 className="font-display mt-2 text-vellum text-[24px] leading-[1.1]">Subscriptions</h3>
          <table className="mt-4 w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left font-mono text-[10px] tracking-[0.18em] uppercase text-vellum-mute">
                <th className="pb-2 pr-2">Plan</th>
                <th className="pb-2 pr-2">/mo</th>
                <th className="pb-2 pr-2">Included</th>
                <th className="pb-2">Target</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.name} className="border-t border-vellum/5">
                  <td className="py-2 pr-2 font-display text-vellum">{p.name}</td>
                  <td className="py-2 pr-2 font-mono text-seal-deep">{p.price}</td>
                  <td className="py-2 pr-2 font-mono text-[11.5px] text-vellum-dim">{p.incl}</td>
                  <td className="py-2 text-vellum-dim text-[12px]">{p.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stream 3 — Compliance Premium */}
        <div className="col-span-12 lg:col-span-4 fade-up-3 border border-ember/40 p-5 bg-ember/[0.04]">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ember">03 · highest margin</div>
          <h3 className="font-display mt-2 text-vellum text-[24px] leading-[1.1]">Compliance Premium</h3>
          <p className="font-display-italic mt-2 text-vellum-dim text-[13px]">The competitive moat</p>
          <ul className="mt-4 space-y-2 text-vellum text-[13px] leading-[1.5]">
            <li>· Attestation Certificate Export</li>
            <li>· Audit Log Export (SOC 2 / HIPAA)</li>
            <li>· HIPAA BAA — Enterprise-only</li>
            <li>· Capability Audit Reports</li>
          </ul>
        </div>

        {/* Stream 4 — Self-host */}
        <div className="col-span-12 lg:col-span-5 fade-up-4 hairline-rune p-5 bg-ink/60">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rune-deep">04 · enterprise</div>
          <h3 className="font-display mt-2 text-vellum text-[24px] leading-[1.1]">Self-Host License</h3>
          <table className="mt-4 w-full border-collapse text-[13px]">
            <tbody>
              {[["Standard", "$25k/yr", "Email · 5d SLA"],
                ["Premium", "$75k/yr", "Slack · 1d SLA · QBRs"],
                ["Enterprise", "$150k+/yr", "Dedicated engineer · custom"]].map(([t, p, s]) => (
                <tr key={t} className="border-t border-vellum/5">
                  <td className="py-2 pr-3 font-display text-vellum">{t}</td>
                  <td className="py-2 pr-3 font-mono text-rune-deep">{p}</td>
                  <td className="py-2 text-vellum-dim text-[12px]">{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Unit economics */}
        <div className="col-span-12 lg:col-span-7 fade-up-4 hairline p-5 bg-ink/60">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">Unit economics · LTV / CAC</div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {[["Developer inbound", "$2,680", "$200", "13×"],
              ["Compliance", "$36k", "$3.5k", "10×"],
              ["Self-host enterprise", "$150k", "$20k", "7.5×"]].map(([seg, ltv, cac, ratio]) => (
              <div key={seg} className="hairline-seal p-3">
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-dim">{seg}</div>
                <div className="mt-2 grid grid-cols-3 items-baseline gap-2">
                  <div><div className="font-mono text-[10px] text-vellum-mute">LTV</div><div className="font-display text-vellum text-[18px]">{ltv}</div></div>
                  <div><div className="font-mono text-[10px] text-vellum-mute">CAC</div><div className="font-display text-vellum text-[18px]">{cac}</div></div>
                  <div><div className="font-mono text-[10px] text-vellum-mute">ratio</div><div className="font-display text-seal-deep text-[22px]">{ratio}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ── 13 · TRACTION ───────────────────────────────────────────────
function Slide13() {
  return (
    <Frame align="center">
      <div className="grid grid-cols-12 gap-8 items-end">
        <div className="col-span-12 lg:col-span-7">
          <div className="eyebrow fade-up flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-seal" />
            Traction · live · being composed on
          </div>
          <h2 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(48px,5.6vw,96px)] leading-[0.92] tracking-[-0.035em]">
            Not vapor.
            <br />
            <span className="font-display-italic text-seal-deep">Real surface area.</span>
          </h2>
        </div>
        <p className="col-span-12 lg:col-span-5 fade-up-2 text-vellum-dim text-[14px] leading-[1.6]">
          Live on mainnet. SDKs published. Other 0G builders already integrating, with on-chain proof. Public engagement on X.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-12 gap-4">
        {/* Quad 1 — X threads */}
        <article className="col-span-12 lg:col-span-6 fade-up-2 hairline p-5 bg-ink/60">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">📣 Public X coverage</div>
          <ul className="mt-4 space-y-3.5 text-[13.5px] leading-[1.5]">
            <li>
              <a href="https://x.com/SealedMind_0G/status/2054824236494319702" className="text-vellum hover:text-seal-deep underline-offset-2 hover:underline">
                🧵 SealedMind launch thread
              </a>
              <div className="font-mono text-[11px] text-vellum-dim mt-0.5">"SealedMind is live on 0G mainnet."</div>
            </li>
            <li>
              <a href="https://x.com/SealedMind_0G/status/2055196827583181076" className="text-vellum hover:text-seal-deep underline-offset-2 hover:underline">
                🧵 Product update — on-chain MemoryAccessLog
              </a>
              <div className="font-mono text-[11px] text-vellum-dim mt-0.5">Chainscan-clickable verify proofs</div>
            </li>
            <li>
              <a href="https://x.com/VeilSolver/status/2052236211167821961" className="text-vellum hover:text-seal-deep underline-offset-2 hover:underline">
                🧵 VeilSolver × SealedMind ecosystem
              </a>
              <div className="font-mono text-[11px] text-vellum-dim mt-0.5">Partner amplification</div>
            </li>
          </ul>
          <div className="mt-5 pt-3 border-t border-vellum/5 font-mono text-[11px] text-seal-deep">@SealedMind_0G</div>
        </article>

        {/* Quad 2 — Distribution */}
        <article className="col-span-12 lg:col-span-6 fade-up-3 hairline p-5 bg-ink/60">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">📦 Distribution proof</div>
          <ul className="mt-4 space-y-3 text-[13.5px] leading-[1.5]">
            <li className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-vellum-mute w-14">npm</span>
              <code className="font-mono text-vellum">@sealedmind/sdk</code>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-vellum-mute w-14">PyPI</span>
              <code className="font-mono text-vellum">sealedmind</code>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-vellum-mute w-14">PyPI</span>
              <code className="font-mono text-vellum">evermemos-sealedmind</code>
            </li>
          </ul>
          <p className="mt-4 text-vellum-dim text-[12.5px] leading-[1.55]">
            All MIT-licensed. Full TypeScript typings. <code className="font-mono">evermemos-sealedmind</code> is our top-of-funnel into the 0G Memory community.
          </p>
        </article>

        {/* Quad 3 — Partners */}
        <article className="col-span-12 lg:col-span-7 fade-up-3 hairline-seal p-5 bg-ink/60">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">🤝 Real third-party integration</div>
          <div className="mt-4 grid grid-cols-2 gap-5">
            <div>
              <h3 className="font-display text-vellum text-[22px]">Daimon</h3>
              <div className="font-display-italic text-vellum-dim text-[13px]">Train it · Own it · Pass it on</div>
              <p className="mt-2 text-vellum-dim text-[13px] leading-[1.5]">First non-team builder shipping on SealedMind. Marketplace live on Galileo + Mainnet. Their entire trading-agent product depends on our iNFT + capability primitive.</p>
            </div>
            <div>
              <h3 className="font-display text-vellum text-[22px]">VeilSolver</h3>
              <div className="font-display-italic text-vellum-dim text-[13px]">Paired primitive · MEV-resistant solver</div>
              <p className="mt-2 text-vellum-dim text-[13px] leading-[1.5]">Joint integration guide in our repo. Three-project ecosystem submission.</p>
            </div>
          </div>
        </article>

        {/* Quad 4 — On-chain */}
        <article className="col-span-12 lg:col-span-5 fade-up-4 border border-ember/40 p-5 bg-ember/[0.04]">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ember">⛓ On-chain proof of usage</div>
          <p className="mt-4 text-vellum text-[13px] leading-[1.55]">
            Every <code className="font-mono text-seal-deep">remember</code>/<code className="font-mono text-seal-deep">recall</code>/<code className="font-mono text-seal-deep">chat</code> emits a MemoryAccessLog entry on 0G chain.
          </p>
          <div className="mt-4 hairline p-3 font-mono text-[11px] text-seal-deep break-all">
            0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad
          </div>
          <div className="mt-2 font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">live · chainscan.0g.ai</div>
        </article>

        {/* FULL-WIDTH ECOSYSTEM STRIP — 0G builder showcases & meets */}
        <article className="col-span-12 fade-up-5 hairline-seal p-6 bg-ink/70">
          <div className="grid grid-cols-12 gap-6 items-center">
            <div className="col-span-12 lg:col-span-4">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">🏛 0G ecosystem · since day one</div>
              <h3 className="font-display mt-2 text-vellum text-[26px] leading-[1.1]">
                Present at <em className="font-display-italic text-seal-deep">every</em> 0G builder showcase &amp; meet.
              </h3>
            </div>
            <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-x-8 gap-y-3 text-vellum text-[13px] leading-[1.5]">
              <div className="flex gap-3"><span className="text-seal mt-0.5">·</span><span>Attended <strong>every</strong> 0G builder showcase since the program launched</span></div>
              <div className="flex gap-3"><span className="text-seal mt-0.5">·</span><span>Attended <strong>every</strong> 0G builder meet — APAC track from day one</span></div>
              <div className="flex gap-3"><span className="text-seal mt-0.5">·</span><span>Coordinated with the 0G team across product + DevRel</span></div>
              <div className="flex gap-3"><span className="text-seal mt-0.5">·</span><span>Three-project ecosystem submission with two partner teams</span></div>
            </div>
          </div>
        </article>
      </div>
    </Frame>
  );
}

// ── 14 · ROADMAP ────────────────────────────────────────────────
function Slide14() {
  const phases = [
    { p: "Phase 1", w: "weeks 1-4", g: "Enable billing", target: "$500-2k MRR",
      bullets: ["Stripe Metered Billing wired to sm_* keys", "Hobby/Builder/Team plan pages", "Usage tracking middleware", "Hard rate limits to force upgrade"] },
    { p: "Phase 2", w: "months 2-4", g: "Developer growth", target: "$5-15k MRR · 100+ devs",
      bullets: ["Promotion of 3 SDKs in 0G ecosystem", "LangGraph / smolagents / OpenClaw guides", "Embeddable two-agent demo", "Discord communities"] },
    { p: "Phase 3", w: "months 3-6", g: "Compliance pipeline", target: "$20-50k MRR · 5-10 customers",
      bullets: ["First 3 enterprise pilots", "AI startups in healthcare/finance/legal", "HIPAA BAA template drafted", "SOC 2 Type I audit started"] },
    { p: "Phase 4", w: "months 6-12", g: "Enterprise self-host", target: "$75-150k ARR · 1st license",
      bullets: ["Dockerfile + Helm chart", "Onboarding playbook", "1-2 healthcare/finance pilots", "Self-host standard contracts"] },
  ];
  const months = [
    { m: "M3", v: "$5k" },
    { m: "M6", v: "$16k" },
    { m: "M9", v: "$27k" },
    { m: "M12", v: "$43k" },
  ];
  return (
    <Frame align="center">
      <div className="eyebrow fade-up flex items-center gap-3">
        <span className="inline-block w-8 h-px bg-seal" />
        Roadmap · 12-month plan
      </div>
      <h2 className="font-display fade-up-1 mt-6 text-vellum text-[clamp(44px,5vw,84px)] leading-[0.92] tracking-[-0.035em]">
        From primitive to platform.
      </h2>

      <div className="mt-10 grid grid-cols-4 gap-4">
        {phases.map((ph, i) => (
          <article key={ph.p} className={`fade-up-${i + 2} hairline bg-ink/60 p-5 flex flex-col`}>
            <div className="flex items-baseline justify-between">
              <span className="font-display text-seal text-[32px] leading-none">{i + 1}</span>
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">{ph.w}</span>
            </div>
            <h3 className="font-display mt-3 text-vellum text-[22px] leading-[1.1]">{ph.g}</h3>
            <ul className="mt-3 space-y-2 text-vellum-dim text-[13px] leading-[1.55] flex-1">
              {ph.bullets.map((b) => (
                <li key={b} className="flex gap-2"><span className="text-seal mt-0.5">·</span><span>{b}</span></li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-vellum/5 font-mono text-[11.5px] text-seal-deep">↳ {ph.target}</div>
          </article>
        ))}
      </div>

      {/* MRR ramp */}
      <div className="fade-up-5 mt-10 hairline-seal p-5 bg-ink/60 grid grid-cols-12 items-center gap-6">
        <div className="col-span-3">
          <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-seal-deep">Year-1 MRR ramp</div>
          <div className="font-display text-vellum text-[40px] leading-none mt-2">$516k <span className="text-vellum-dim text-[20px]">ARR</span></div>
          <div className="font-display-italic text-vellum-dim text-[13px] mt-1">conservative scenario</div>
        </div>
        <div className="col-span-9 grid grid-cols-4 gap-4">
          {months.map((m, i) => (
            <div key={m.m} className="flex flex-col items-end gap-1">
              <div className="w-full bg-gradient-to-t from-seal/30 to-seal" style={{ height: `${20 + i * 28}px` }} />
              <div className="flex justify-between w-full">
                <span className="font-mono text-[10px] uppercase text-vellum-mute">{m.m}</span>
                <span className="font-mono text-[10px] text-seal-deep">{m.v}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// ── 15 · CLOSING ────────────────────────────────────────────────
function Slide15() {
  const links = [
    { k: "Live website", v: "sealedmind.vercel.app", img: "/SealedMind-rwebsite-QR.png" },
    { k: "Source on GitHub", v: "github.com/SealedMind/SealedMindMonoRepo", img: "/SealedMind-repo-QR.png" },
  ];
  return (
    <Frame align="center">
      <div className="flex flex-col items-center text-center max-w-[1200px] mx-auto">
        <div className="eyebrow fade-up flex items-center gap-3">
          <span className="inline-block w-8 h-px bg-seal" />
          Vision · the closing argument
        </div>

        <blockquote className="font-display fade-up-1 mt-10 text-vellum text-[clamp(40px,5.4vw,96px)] leading-[1.05] tracking-[-0.03em]">
          We didn't build an app.
          <br />
          We built the{" "}
          <span className="font-display-italic text-seal glow-text-seal">memory primitive</span>{" "}
          that every AI agent will need.
        </blockquote>

        <p className="font-display-italic fade-up-2 mt-12 text-vellum-dim text-[clamp(18px,2vw,28px)] leading-[1.4] max-w-[820px]">
          Encrypted under your wallet key.
          Attested by Intel TDX.
          Logged on 0G chain.
          <span className="text-vellum"> Owned by you forever.</span>
        </p>

        <div className="fade-up-3 mt-14 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[760px] w-full">
          {links.map((l) => (
            <div key={l.k} className="terminal-frame hairline-seal p-6 flex items-center gap-5">
              <img
                src={l.img}
                alt={`QR code for ${l.k}`}
                className="w-32 h-32 object-contain bg-white p-1.5"
              />
              <div className="flex-1 text-left">
                <div className="font-mono text-[10px] tracking-[0.28em] uppercase text-seal-deep">
                  {l.k}
                </div>
                <div className="mt-2 font-mono text-[12px] text-vellum break-all leading-[1.5]">
                  {l.v}
                </div>
                <div className="mt-3 font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">
                  scan to open
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="fade-up-4 mt-14 font-mono text-[11px] tracking-[0.28em] uppercase text-vellum-mute flex flex-wrap items-center justify-center gap-3">
          <span>@0G_labs</span>
          <span className="text-vellum-dim">·</span>
          <span>@0g_CN</span>
          <span className="text-vellum-dim">·</span>
          <span>@0g_Eco</span>
          <span className="text-vellum-dim">·</span>
          <span>@HackQuest_</span>
          <span className="text-vellum-dim">·</span>
          <span className="text-seal-deep">#0GHackathon</span>
        </div>
      </div>
    </Frame>
  );
}

// ────────────────────────────────────────────────────────────────
// SHARED ATOMIC COMPONENTS
// ────────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 hairline-seal font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-seal" />
      {children}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// SLIDE REGISTRY
// ────────────────────────────────────────────────────────────────

const SLIDES: Array<{ label: string; title: string; Component: () => React.ReactNode }> = [
  { label: "Hero",          title: "SealedMind",                                                Component: Slide01 },
  { label: "Problem",       title: "AI has amnesia. And your data is naked.",                   Component: Slide02 },
  { label: "Why now",       title: "Two missing primitives. Both finally exist.",               Component: Slide03 },
  { label: "Three pillars", title: "Sealed. Portable. Provable.",                               Component: Slide04 },
  { label: "Operations",    title: "Three calls. Memory you own.",                              Component: Slide05 },
  { label: "Architecture",  title: "Six trust boundaries. Eight contracts.",                    Component: Slide06 },
  { label: "Threat model",  title: "Six adversaries. Six receipts.",                            Component: Slide07 },
  { label: "0G stack",      title: "Maximum-leverage demo of the 0G stack.",                    Component: Slide08 },
  { label: "Shipped",       title: "Ten things shipped. All on chain.",                         Component: Slide09 },
  { label: "Use cases",     title: "Six verticals where 'memory you own' isn't optional.",      Component: Slide10 },
  { label: "Collab",        title: "Three projects. One stack.",                                Component: Slide11 },
  { label: "Business",      title: "Four revenue streams. Path to $1M ARR.",                    Component: Slide12 },
  { label: "Traction",      title: "Live · on-chain · being composed on.",                      Component: Slide13 },
  { label: "Roadmap",       title: "From primitive to platform.",                               Component: Slide14 },
  { label: "Closing",       title: "The memory primitive for the agentic internet.",            Component: Slide15 },
];

import { Link } from "react-router-dom";

/**
 * /architecture — system diagram + privacy threat model.
 *
 * Two artefacts:
 *  1. Layered architecture diagram (SVG). Each node is a real, deployed
 *     thing — addresses + contract names match what's actually live.
 *  2. Threat model grid. For each adversary class, what they see + what
 *     specifically prevents the breach + which layer is responsible.
 *
 * Designed to be screenshot-able for the submission deck. Print-friendly
 * via the system's existing light palette.
 */

export default function Architecture() {
  return (
    <div className="relative">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1280px] px-8 pt-24 pb-16">
        <div className="eyebrow flex items-center gap-3">
          <span className="inline-block w-8 h-px bg-seal" />
          The system / shipped surface area
        </div>

        <h1 className="font-display mt-8 text-vellum text-[clamp(48px,7vw,104px)] leading-[0.9] tracking-[-0.04em] text-balance">
          A privacy primitive,{" "}
          <span className="font-display-italic text-seal glow-text-seal">
            drawn to scale.
          </span>
        </h1>

        <p className="font-display mt-10 text-vellum-dim text-[22px] leading-[1.45] max-w-[820px] text-balance">
          Every box below is a real, deployed component — every line is a
          flow that runs in production today. Click into any of them and
          you land on the source contract, the indexed tx, or the live
          repo. No hand-waving.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Pill>4 layers</Pill>
          <Pill>8 contracts on-chain</Pill>
          <Pill>1 TEE enclave</Pill>
          <Pill>~6 trust boundaries</Pill>
        </div>
      </section>

      {/* ── DIAGRAM ──────────────────────────────────────────── */}
      <Divider eyebrow="01 / System architecture" />

      <section className="relative mx-auto max-w-[1280px] px-8 py-16">
        <div className="grid lg:grid-cols-[1fr,320px] gap-10 items-start">
          <div className="terminal-frame p-6 md:p-8 bg-ink overflow-x-auto">
            <ArchitectureDiagram />
          </div>

          <div className="space-y-5 lg:sticky lg:top-24">
            <Legend
              swatch="seal"
              title="Trust boundary"
              body="Anything inside this dashed border can read raw plaintext. Crossing one means data is encrypted, attested, or proven."
            />
            <Legend
              swatch="rune"
              title="On-chain artifact"
              body="Permanent state on 0G Chain. Capability grants, access logs, NFT ownership — all source-verified."
            />
            <Legend
              swatch="ember"
              title="TEE-attested compute"
              body="Qwen 2.5 7B running in Intel TDX + H100 confidential GPU. Every inference returns a signed attestation hash."
            />
          </div>
        </div>
      </section>

      {/* ── THREAT MODEL ─────────────────────────────────────── */}
      <Divider eyebrow="02 / Privacy threat model" />

      <section className="relative mx-auto max-w-[1280px] px-8 py-16">
        <h2 className="font-display text-vellum text-[clamp(40px,5vw,72px)] leading-[0.95] tracking-[-0.03em] max-w-[920px] text-balance">
          Six adversaries.{" "}
          <span className="font-display-italic text-seal-deep">
            Six receipts.
          </span>
        </h2>

        <p className="mt-8 text-vellum-dim text-[16px] leading-[1.6] max-w-[820px]">
          Most "private AI memory" pitches stop at <em>the database is
          encrypted</em>. SealedMind is built so that the rational answer
          to <em>what could go wrong?</em> always points at math, not at
          policy.
        </p>

        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {THREATS.map((t) => (
            <ThreatCard key={t.adversary} {...t} />
          ))}
        </div>
      </section>

      {/* ── DATA FLOW ────────────────────────────────────────── */}
      <Divider eyebrow="03 / What happens on a single remember()" />

      <section className="relative mx-auto max-w-[1280px] px-8 py-16">
        <div className="grid md:grid-cols-[280px,1fr] gap-12">
          <div>
            <h2 className="font-display text-vellum text-[44px] leading-[0.95] tracking-[-0.03em]">
              One trace, six trust boundaries crossed.
            </h2>
            <p className="mt-6 text-vellum-dim text-[15px] leading-[1.6]">
              Each step shows what is in flight, who can read it at that
              instant, and the chainscan or repo proof.
            </p>
          </div>
          <div className="space-y-3">
            {FLOW_STEPS.map((s, i) => (
              <FlowStep key={s.title} index={i + 1} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1280px] px-8 py-32 text-center">
        <p className="font-display-italic text-[clamp(28px,4.5vw,56px)] leading-[1.15] text-vellum text-balance">
          Privacy isn't a label.
          <br />
          <span className="text-seal glow-text-seal">
            It's a graph of things you can prove.
          </span>
        </p>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link to="/demo" className="btn-seal">
            Run the live demo
            <span>→</span>
          </Link>
          <Link to="/pitch" className="btn-ghost">
            Read the pitch
          </Link>
          <a
            href="https://github.com/SealedMind/SealedMindMonoRepo/blob/main/OVERVIEW.md"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            Integration guide ↗
          </a>
        </div>
      </section>
    </div>
  );
}

// ─── DIAGRAM ────────────────────────────────────────────────

function ArchitectureDiagram() {
  // Coordinates are designed for an 1100×640 viewport then scale.
  // Keeping everything in raw SVG so it renders pixel-crisp at any size
  // and screenshots cleanly for the submission deck.
  const W = 1100;
  const H = 640;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className="block"
      role="img"
      aria-label="SealedMind system architecture diagram"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#06B6D4" />
        </marker>
        <marker
          id="arrow-rune"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#8B5CF6" />
        </marker>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="rgba(6, 182, 212, 0.05)"
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <rect width={W} height={H} fill="url(#grid)" />

      {/* Trust boundary — the user's wallet enclave */}
      <BoundaryLabel x={20} y={28} label="Boundary 1 — User wallet" />
      <rect
        x={20}
        y={40}
        width={210}
        height={120}
        fill="rgba(6, 182, 212, 0.04)"
        stroke="#06B6D4"
        strokeOpacity="0.5"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        rx="2"
      />
      <Node x={40} y={66} w={170} h={70} title="MetaMask" subtitle="EOA · master key" tag="signs SIWE & capability EIP-712" tone="seal" />

      {/* Trust boundary 2 — client (browser) */}
      <BoundaryLabel x={260} y={28} label="Boundary 2 — Browser (client)" />
      <rect
        x={260}
        y={40}
        width={300}
        height={120}
        fill="rgba(6, 182, 212, 0.04)"
        stroke="#06B6D4"
        strokeOpacity="0.5"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        rx="2"
      />
      <Node x={280} y={66} w={260} h={70} title="sealedmind.vercel.app" subtitle="React + viem + wagmi" tag="key derivation, AttestationCard verify" tone="seal" />

      {/* Trust boundary 3 — backend operator (Railway) */}
      <BoundaryLabel x={590} y={28} label="Boundary 3 — Backend operator (cannot read plaintext)" />
      <rect
        x={590}
        y={40}
        width={490}
        height={250}
        fill="rgba(245, 158, 11, 0.04)"
        stroke="#F59E0B"
        strokeOpacity="0.45"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        rx="2"
      />
      <Node x={610} y={66} w={210} h={70} title="MemoryEngine" subtitle="ts · per-mind isolated" tag="encrypt → upload → emit log" tone="seal" />
      <Node x={840} y={66} w={220} h={70} title="TwoPassExtract" subtitle="regex → TEE-LLM fallback" tag="zero-shot fact distillation" tone="seal" />

      <Node x={610} y={170} w={210} h={70} title="CapabilityEnforcer" subtitle="reads on-chain registry" tag="403 unless caller has cap" tone="seal" />
      <Node x={840} y={170} w={220} h={70} title="OperatorAuth" subtitle="sm_op_* + rate-limit" tag="bearer token + token-bucket" tone="seal" />

      {/* Lower row — 0G stack (separate trust domains) */}
      <BoundaryLabel x={20} y={328} label="Boundary 4 — 0G Storage (encrypted at rest)" />
      <rect
        x={20}
        y={340}
        width={300}
        height={260}
        fill="rgba(6, 182, 212, 0.04)"
        stroke="#06B6D4"
        strokeOpacity="0.4"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        rx="2"
      />
      <Node x={40} y={368} w={260} h={70} title="0G Storage Indexer" subtitle="erasure-coded blobs" tag="AES-256-GCM ciphertext only" tone="seal" />
      <Node x={40} y={462} w={260} h={120} title="Encrypted memory blobs" subtitle="indexed by rootHash" tag={"keys never leave\nthe browser"} tone="seal" multiline />

      <BoundaryLabel x={350} y={328} label="Boundary 5 — TEE enclave (Intel TDX + H100)" />
      <rect
        x={350}
        y={340}
        width={300}
        height={260}
        fill="rgba(245, 158, 11, 0.04)"
        stroke="#F59E0B"
        strokeOpacity="0.5"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        rx="2"
      />
      <Node x={370} y={368} w={260} h={70} title="0G Compute broker" subtitle="ZG-Serving SDK" tag="returns chatId + attestation" tone="ember" />
      <Node x={370} y={462} w={260} h={120} title="Qwen 2.5 7B in TDX" subtitle="confidential GPU pass-through" tag={"prompt + reply sealed,\nremote-attested"} tone="ember" multiline />

      <BoundaryLabel x={680} y={328} label="Boundary 6 — 0G Chain 16602 (public, immutable)" />
      <rect
        x={680}
        y={340}
        width={400}
        height={260}
        fill="rgba(139, 92, 246, 0.04)"
        stroke="#8B5CF6"
        strokeOpacity="0.5"
        strokeDasharray="4 4"
        strokeWidth="1.5"
        rx="2"
      />
      <Node x={700} y={368} w={360} h={50} title="SealedMindNFT" subtitle="ERC-7857 iNFT" tag="0xb6dB…05c1" tone="rune" small />
      <Node x={700} y={426} w={360} h={50} title="CapabilityRegistry" subtitle="grant / revoke / hasCap" tag="0xeb2F…fa45" tone="rune" small />
      <Node x={700} y={484} w={360} h={50} title="MemoryAccessLog" subtitle="immutable audit trail" tag="0xB085…4482" tone="rune" small />
      <Node x={700} y={542} w={360} h={42} title="+ 5 supporting contracts" subtitle="all source-verified on chainscan" tag="" tone="rune" small />

      {/* Connection lines */}
      <Edge x1={210} y1={100} x2={280} y2={100} />
      <Edge x1={540} y1={100} x2={610} y2={100} />
      <Edge x1={715} y1={136} x2={715} y2={170} />
      <Edge x1={950} y1={136} x2={950} y2={170} />

      <Edge x1={715} y1={240} x2={170} y2={368} curve />
      <Edge x1={820} y1={240} x2={500} y2={368} curve />
      <Edge x1={950} y1={240} x2={500} y2={368} curve />
      <Edge x1={950} y1={240} x2={880} y2={393} curve tone="ember" />

      <Edge x1={715} y1={240} x2={880} y2={393} curve tone="rune" />
      <Edge x1={715} y1={240} x2={880} y2={451} curve tone="rune" />
      <Edge x1={715} y1={240} x2={880} y2={509} curve tone="rune" />
    </svg>
  );
}

function Node({
  x, y, w, h, title, subtitle, tag, tone, multiline, small,
}: {
  x: number; y: number; w: number; h: number;
  title: string; subtitle: string; tag: string;
  tone: "seal" | "rune" | "ember";
  multiline?: boolean;
  small?: boolean;
}) {
  const stroke = tone === "seal" ? "#06B6D4" : tone === "rune" ? "#8B5CF6" : "#F59E0B";
  const fill   = tone === "seal" ? "rgba(6,182,212,0.06)" : tone === "rune" ? "rgba(139,92,246,0.06)" : "rgba(245,158,11,0.06)";
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth="1.2" rx="1" />
      <text x={x + 12} y={y + 22} fontFamily="Fraunces, serif" fontSize={small ? 14 : 17} fill="#0A3A4A" fontWeight="600">{title}</text>
      <text x={x + 12} y={y + 39} fontFamily="JetBrains Mono, monospace" fontSize={9} letterSpacing="1.5" fill="#1A6070">{subtitle.toUpperCase()}</text>
      {tag && !multiline && (
        <text x={x + 12} y={y + h - 12} fontFamily="JetBrains Mono, monospace" fontSize={10} fill="#5A9AAA">{tag}</text>
      )}
      {tag && multiline && (
        tag.split("\n").map((line, i) => (
          <text key={i} x={x + 12} y={y + 60 + i * 14} fontFamily="JetBrains Mono, monospace" fontSize={10} fill="#5A9AAA">{line}</text>
        ))
      )}
    </g>
  );
}

function Edge({
  x1, y1, x2, y2, curve, tone = "seal",
}: { x1: number; y1: number; x2: number; y2: number; curve?: boolean; tone?: "seal" | "rune" | "ember" }) {
  const stroke = tone === "seal" ? "#06B6D4" : tone === "rune" ? "#8B5CF6" : "#F59E0B";
  const marker = tone === "rune" ? "url(#arrow-rune)" : "url(#arrow)";
  if (!curve) {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="1.2" markerEnd={marker} opacity="0.7" />;
  }
  // Cubic bezier with vertical pull-down — feels architectural, not random.
  const midY = (y1 + y2) / 2;
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
      stroke={stroke}
      strokeWidth="1.2"
      fill="none"
      markerEnd={marker}
      opacity="0.6"
    />
  );
}

function BoundaryLabel({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <text x={x} y={y} fontFamily="JetBrains Mono, monospace" fontSize={9} letterSpacing="1.5" fill="#0A3A4A" fontWeight="600">
      {label.toUpperCase()}
    </text>
  );
}

// ─── THREAT MODEL ───────────────────────────────────────────

interface Threat {
  adversary: string;
  position: string;
  sees: string;
  defeated_by: string;
  layer: string;
}

const THREATS: Threat[] = [
  {
    adversary: "Honest-but-curious backend operator",
    position: "Has root on the Railway container.",
    sees: "Ciphertext blobs and CIDs only. Cannot decrypt — keys are derived in the user's browser from a SIWE-signed challenge.",
    defeated_by: "Per-user master key derivation. Server-side encryption keys are never persisted; KEY_DERIVATION_SECRET only seeds the per-user HKDF.",
    layer: "Encryption boundary",
  },
  {
    adversary: "Malicious 0G storage node",
    position: "Hosts a shard of one user's blob.",
    sees: "AES-256-GCM ciphertext + an opaque rootHash. No filename, no metadata, no plaintext.",
    defeated_by: "Client-side AES-256-GCM with user-derived key. Storage layer is treated as untrusted by design.",
    layer: "0G Storage shards",
  },
  {
    adversary: "Compromised inference host",
    position: "Operates the GPU node that serves the LLM.",
    sees: "Nothing — prompt and reply enter and leave Intel TDX + H100 confidential GPU. Memory is encrypted in-flight.",
    defeated_by: "TEE remote attestation on every chat. AttestationCard + /v1/attestations/verify lets the user re-check the enclave hash.",
    layer: "TEE enclave",
  },
  {
    adversary: "Capability bearer gone rogue",
    position: "Was granted recall access, now over-uses it.",
    sees: "Only the shards their capability covers — and every read is logged on-chain.",
    defeated_by: "On-chain CapabilityRegistry with revokeCapability(). Owner sees the abuse in MemoryAccessLog and revokes in one tx.",
    layer: "Capability + audit log",
  },
  {
    adversary: "Sealing-key extraction attempt",
    position: "Attacker steals the operator's PRIVATE_KEY.",
    sees: "Can mint MemoryAccessLog entries and pay gas — cannot decrypt any user's memories. The ops wallet is a relayer, not a key custodian.",
    defeated_by: "Hard separation: operator wallet handles only on-chain logging + gas; user master keys live in the user's browser.",
    layer: "Trust separation",
  },
  {
    adversary: "Stolen user wallet",
    position: "Attacker has the user's seed phrase.",
    sees: "Everything the user sees — same as any wallet compromise.",
    defeated_by: "Recovery is a wallet-layer concern. SealedMind's role: revoke shared capabilities the moment the user notices, in a single tx.",
    layer: "User boundary (out of scope)",
  },
];

function ThreatCard({ adversary, position, sees, defeated_by, layer }: Threat) {
  return (
    <article className="terminal-frame hairline-seal p-6 bg-ink/80 flex flex-col h-full">
      <header>
        <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-seal-deep">
          {layer}
        </div>
        <h3 className="font-display text-vellum text-[24px] leading-[1.1] mt-2">
          {adversary}
        </h3>
        <p className="text-vellum-mute text-[12px] italic mt-2">{position}</p>
      </header>

      <dl className="mt-5 space-y-4 flex-1">
        <div>
          <dt className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-dim">
            What they actually see
          </dt>
          <dd className="text-vellum text-[14px] leading-[1.55] mt-1">{sees}</dd>
        </div>
        <div className="pt-4 border-t border-vellum/5">
          <dt className="font-mono text-[9px] tracking-[0.22em] uppercase text-seal">
            ↳ Defeated by
          </dt>
          <dd className="text-vellum text-[14px] leading-[1.55] mt-1">{defeated_by}</dd>
        </div>
      </dl>
    </article>
  );
}

// ─── FLOW ───────────────────────────────────────────────────

interface Flow {
  title: string;
  in_flight: string;
  who_can_read: string;
  proof: string;
}

const FLOW_STEPS: Flow[] = [
  {
    title: "1 · User types in the dashboard",
    in_flight: "Plaintext memory string in the browser DOM.",
    who_can_read: "Only the user's own browser tab.",
    proof: "frontend/src/pages/Dashboard.tsx",
  },
  {
    title: "2 · Browser derives the per-mind key",
    in_flight: "A SIWE signature → HKDF → AES-256 master key.",
    who_can_read: "Only the wallet that signed the SIWE challenge.",
    proof: "lib/crypto.ts — derived in-browser, never sent",
  },
  {
    title: "3 · Backend two-pass extracts the facts",
    in_flight: "Plaintext leaves the browser over TLS, hits the regex fast-path; only ambiguous cases go to TEE-LLM fallback.",
    who_can_read: "Backend, transiently. Discarded after extraction. Not persisted plaintext.",
    proof: "backend/src/services/memoryEngine.ts — two-pass logic",
  },
  {
    title: "4 · Encrypt, then upload to 0G Storage",
    in_flight: "AES-256-GCM ciphertext blob + rootHash receipt.",
    who_can_read: "Storage nodes hold only ciphertext. RootHash is public; payload isn't.",
    proof: "chainscan-galileo.0g.ai/tx/<rootHash>",
  },
  {
    title: "5 · MemoryAccessLog.logAccess fires (background)",
    in_flight: "(mindId, op, attestationHash, storageCID) on chain.",
    who_can_read: "Public — by design. Owner watches their own ledger.",
    proof: "0xB085…4482 on 0G testnet",
  },
  {
    title: "6 · AttestationCard renders chainscan link",
    in_flight: "tx hash → /v1/attestations/verify → patched record returned.",
    who_can_read: "Anyone with the chatId can independently re-verify.",
    proof: "frontend/src/components/AttestationCard.tsx",
  },
];

function FlowStep({ index, title, in_flight, who_can_read, proof }: Flow & { index: number }) {
  return (
    <div className="grid grid-cols-[40px,1fr] gap-4 items-start">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-seal pt-1">
        {String(index).padStart(2, "0")}
      </div>
      <div className="hairline bg-ink/70 p-5">
        <div className="font-display text-vellum text-[18px] leading-[1.2]">{title}</div>
        <dl className="mt-3 grid sm:grid-cols-3 gap-3 text-[12px]">
          <DT label="In flight" value={in_flight} />
          <DT label="Who can read" value={who_can_read} />
          <DT label="Proof" value={proof} mono />
        </dl>
      </div>
    </div>
  );
}

function DT({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-dim">
        {label}
      </dt>
      <dd className={`mt-1 text-vellum-dim leading-[1.5] ${mono ? "font-mono text-[11px] text-seal-deep" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

// ─── shared bits ────────────────────────────────────────────

function Divider({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="mx-auto max-w-[1280px] px-8">
      <div className="eyebrow flex items-center gap-3 py-2 border-t border-vellum/10">
        <span className="inline-block w-8 h-px bg-seal" />
        {eyebrow}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 hairline-seal font-mono text-[10px] tracking-[0.22em] uppercase text-seal-deep">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-seal anim-pulse-seal" />
      {children}
    </span>
  );
}

function Legend({ swatch, title, body }: { swatch: "seal" | "rune" | "ember"; title: string; body: string }) {
  const dot = swatch === "seal" ? "bg-seal" : swatch === "rune" ? "bg-rune" : "bg-ember";
  return (
    <div className="hairline p-4 bg-ink/70">
      <div className="flex items-center gap-3">
        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum">
          {title}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-vellum-dim leading-[1.55]">{body}</p>
    </div>
  );
}

import { Link } from "react-router-dom";
import MindSeal from "../components/MindSeal";

export default function Landing() {
  return (
    <div className="relative">
      {/* ─── HERO ─────────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1440px] px-8 pt-24 pb-40">
        <div className="grid grid-cols-12 gap-8 items-center">
          {/* Left — editorial headline */}
          <div className="col-span-12 lg:col-span-7 relative">
            <div className="eyebrow fade-up flex items-center gap-3">
              <span className="inline-block w-8 h-px bg-seal" />
              001 / Encrypted memory for AI
            </div>

            <h1 className="font-display fade-up-1 mt-8 text-vellum text-[clamp(56px,9vw,148px)] leading-[0.85] tracking-[-0.04em] text-balance">
              Your AI<br />
              <span className="font-display-italic text-seal glow-text-seal">remembers</span>
              <br />
              everything.
            </h1>

            <p className="font-display fade-up-2 mt-10 text-vellum-dim text-[22px] leading-[1.4] max-w-[560px] text-balance">
              Nobody else can see it. You own it forever.
              An encrypted memory layer for AI agents — sealed inside hardware
              enclaves, anchored on-chain as an iNFT, portable across every model
              you'll ever use.
            </p>

            <div className="fade-up-3 mt-12 flex flex-wrap items-center gap-4">
              <Link to="/dashboard" className="btn-seal">
                Create your Mind
                <span>→</span>
              </Link>
              <a
                href="https://github.com/SealedMind/SealedMindMonoRepo"
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                Read the docs
              </a>
            </div>

            {/* Trust strip */}
            <div className="fade-up-4 mt-16 flex flex-wrap items-center gap-x-10 gap-y-4 text-vellum-mute font-mono text-[10px] tracking-[0.22em] uppercase">
              <span>⬡ Built on 0G</span>
              <span>↳ ERC-7857 iNFT</span>
              <span>↳ Intel TDX + H100 TEE</span>
              <span>↳ Open source · MIT</span>
            </div>
          </div>

          {/* Right — colossal floating Mind Seal */}
          <div className="col-span-12 lg:col-span-5 relative flex justify-center lg:justify-end fade-up-3">
            <div className="relative">
              <MindSeal size={460} />
              {/* Floating orbital labels */}
              <div className="absolute -top-4 -left-12 font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute opacity-80">
                ▸ AES-256-GCM
              </div>
              <div className="absolute top-1/3 -right-16 font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute opacity-80">
                ▸ HNSW vector index
              </div>
              <div className="absolute bottom-8 -left-20 font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute opacity-80">
                ▸ 0G Storage
              </div>
              <div className="absolute -bottom-2 right-4 font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute opacity-80">
                ▸ TEE attestation
              </div>
            </div>
          </div>
        </div>

        {/* Coordinates marker — bottom right of hero */}
        <div className="absolute bottom-12 right-8 font-mono text-[10px] text-vellum-mute tracking-[0.22em] uppercase">
          0G/16602 · 35.6762°N 139.6503°E
        </div>
      </section>

      {/* ─── DIVIDER ─────────────────────────────────── */}
      <div className="mx-auto max-w-[1440px] px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-vellum/15 to-transparent" />
      </div>

      {/* ─── PROBLEM / TENSION ──────────────────────── */}
      <section className="relative mx-auto max-w-[1440px] px-8 py-32">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-4">
            <div className="eyebrow flex items-center gap-3">
              <span className="inline-block w-8 h-px bg-seal" />
              002 / The problem
            </div>
            <h2 className="font-display mt-6 text-[56px] leading-[0.95] tracking-tight text-vellum text-balance">
              800 million<br />confessions a day.
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-7 lg:col-start-6 self-end">
            <p className="font-display text-vellum-dim text-[22px] leading-[1.5] text-balance">
              People pour their secrets into AI — therapy sessions, business
              strategy, medical questions, raw confessions. The AI forgets it
              all next session. Or worse: the platform remembers, owns it,
              reads it, and when it shuts down, it's gone forever.
            </p>
            <p className="font-display-italic text-seal text-[22px] leading-[1.5] mt-6">
              SealedMind ends both problems.
            </p>
          </div>
        </div>
      </section>

      {/* ─── PILLARS ──────────────────────────────── */}
      <section className="relative mx-auto max-w-[1440px] px-8 py-24">
        <div className="grid grid-cols-12 gap-6">
          {[
            {
              num: "01",
              title: "Sealed",
              desc: "Every memory is encrypted with a key generated inside a hardware enclave. The plaintext never leaves Intel TDX + NVIDIA H100 TEE. Not even we can read it.",
              tag: "AES-256-GCM",
            },
            {
              num: "02",
              title: "Permanent",
              desc: "Memories live on 0G Storage — distributed, content-addressed, censorship-resistant. They survive any company, any model, any decade.",
              tag: "0G Storage",
            },
            {
              num: "03",
              title: "Yours",
              desc: "Each Mind is an ERC-7857 iNFT. Transferable, sellable, inheritable. You hold the keys. You hold the memory. You hold the asset.",
              tag: "ERC-7857",
            },
          ].map((pillar) => (
            <div
              key={pillar.num}
              className="col-span-12 md:col-span-4 relative p-10 hairline bg-ink-2/30 grain group hover:bg-ink-2/60 transition-colors duration-500"
            >
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal mb-6">
                {pillar.num} / {pillar.tag}
              </div>
              <h3 className="font-display text-[44px] leading-none text-vellum group-hover:text-seal transition-colors duration-500">
                {pillar.title}
              </h3>
              <p className="font-sans mt-6 text-vellum-dim text-[15px] leading-[1.7] text-balance">
                {pillar.desc}
              </p>
              <div className="mt-10 h-px bg-gradient-to-r from-seal/40 via-seal/10 to-transparent" />
              <div className="mt-4 font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">
                ⬡ Verified on Galileo testnet
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS — TERMINAL RECEIPT ────── */}
      <section className="relative mx-auto max-w-[1440px] px-8 py-32">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-5">
            <div className="eyebrow flex items-center gap-3">
              <span className="inline-block w-8 h-px bg-seal" />
              003 / How it works
            </div>
            <h2 className="font-display mt-6 text-[64px] leading-[0.95] tracking-tight text-vellum text-balance">
              Four steps.<br />
              <span className="font-display-italic text-seal">One sealed life.</span>
            </h2>
            <p className="mt-8 text-vellum-dim text-[16px] leading-[1.7] max-w-[440px]">
              Connect a wallet. Mint a Mind. Speak to it. Watch the receipts
              roll in. Every memory carries a TEE attestation, a 0G Storage
              CID, and a transaction hash on chain.
            </p>
          </div>

          <div className="col-span-12 lg:col-span-7">
            <div className="terminal-frame p-8 font-mono text-[12px] leading-[1.9] text-vellum">
              {/* terminal header */}
              <div className="flex items-center justify-between mb-6 -mx-8 -mt-8 px-8 py-3 border-b border-vellum/10 bg-ink/60">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-crimson" />
                  <span className="w-2 h-2 rounded-full bg-ember" />
                  <span className="w-2 h-2 rounded-full bg-seal" />
                </div>
                <span className="text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
                  ~/sealedmind/session.log
                </span>
                <span className="text-[10px] text-vellum-mute">⬡ TEE</span>
              </div>

              <div className="text-vellum-mute">$ sealedmind connect</div>
              <div className="text-seal">  ✓ wallet linked · 0xA2…f1c</div>
              <div className="text-vellum-mute mt-3">$ sealedmind mint --name "Personal Memory"</div>
              <div className="text-seal">  ✓ minted iNFT #42 on 0G chain 16602</div>
              <div className="text-vellum-mute">  tx 0x4f8…ab2 · gas 142k · 0.0021 0G</div>
              <div className="text-vellum-mute mt-3">$ sealedmind remember "I prefer aggressive trading strategies"</div>
              <div className="text-seal">  ✓ extracted 1 fact · embedded · indexed</div>
              <div className="text-rune">  ⬡ TEE attest 0xb91…cd4 · Intel TDX</div>
              <div className="text-seal">  ✓ encrypted · stored · CID 0x7e2…910</div>
              <div className="text-vellum-mute mt-3">$ sealedmind recall "what is my risk tolerance?"</div>
              <div className="text-vellum">  → "You prefer aggressive trading strategies."</div>
              <div className="text-rune">  ⬡ TEE attest 0xc02…71a · 1 memory retrieved</div>
              <div className="text-vellum-mute mt-3">
                $ sealedmind grant calendar-agent --shard work --read-only
              </div>
              <div className="text-seal">  ✓ capability granted · expires 2026-06-01</div>
              <div className="text-vellum-mute mt-4 flex items-center">
                $ <span className="anim-blink ml-1 inline-block w-[8px] h-[14px] bg-seal" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── METRICS STRIP ──────────────────────── */}
      <section className="relative mx-auto max-w-[1440px] px-8 py-24">
        <div className="hairline bg-ink-2/30 px-12 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { num: "256-bit", lbl: "AES-GCM seal" },
              { num: "16602", lbl: "Galileo chain" },
              { num: "ERC-7857", lbl: "iNFT standard" },
              { num: "∞", lbl: "Memories per Mind" },
            ].map((m) => (
              <div key={m.lbl}>
                <div className="font-display text-[64px] leading-none text-seal glow-text-seal">
                  {m.num}
                </div>
                <div className="mt-3 font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
                  {m.lbl}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1440px] px-8 py-40 text-center">
        <div className="eyebrow flex items-center justify-center gap-3">
          <span className="inline-block w-8 h-px bg-seal" />
          004 / Begin
          <span className="inline-block w-8 h-px bg-seal" />
        </div>
        <h2 className="font-display mt-8 text-[clamp(56px,8vw,128px)] leading-[0.85] tracking-[-0.03em] text-vellum text-balance">
          Seal something<br />
          <span className="font-display-italic text-seal glow-text-seal">worth keeping.</span>
        </h2>
        <div className="mt-14 flex justify-center">
          <Link to="/dashboard" className="btn-seal">
            Enter the vault
            <span>→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

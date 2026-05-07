import { Link } from "react-router-dom";

export default function Pitch() {
  return (
    <div className="relative">
      {/* ─── HERO ──────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1280px] px-8 pt-24 pb-32">
        <div className="eyebrow fade-up flex items-center gap-3">
          <span className="inline-block w-8 h-px bg-seal" />
          The pitch · 90-second read
        </div>

        <h1 className="font-display fade-up-1 mt-8 text-vellum text-[clamp(48px,7vw,112px)] leading-[0.9] tracking-[-0.04em] text-balance">
          Memory is the{" "}
          <span className="font-display-italic text-seal glow-text-seal">moat</span>{" "}
          for AI.
        </h1>

        <p className="font-display fade-up-2 mt-10 text-vellum-dim text-[22px] leading-[1.45] max-w-[780px] text-balance">
          Every useful AI agent — your coding assistant, your therapist
          bot, your trading copilot — gets smarter with memory. But today
          that memory sits unencrypted on someone else's server, indexed
          under a single shared key, locked to one platform.
        </p>

        <p className="font-display fade-up-3 mt-6 text-vellum text-[22px] leading-[1.45] max-w-[780px] text-balance">
          <span className="text-seal-deep font-bold">SealedMind</span> is the
          privacy primitive for AI memory. Encrypted under a key{" "}
          <em className="font-display-italic">your wallet</em> controls.
          Sharable across agents through an on-chain capability you can
          revoke any time. Sensitive reads run inside Intel TDX so even
          the inference is verifiable.
        </p>

        <div className="fade-up-4 mt-12 flex flex-wrap items-center gap-4">
          <Link to="/demo" className="btn-seal">
            Try the live demo
            <span>→</span>
          </Link>
          <a
            href="https://github.com/SealedMind/SealedMindMonoRepo/blob/main/OVERVIEW.md"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            Read the integration guide
          </a>
        </div>
      </section>

      <Divider eyebrow="001 / Why we're building this" />

      {/* ─── WHY ───────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1280px] px-8 py-24">
        <blockquote className="font-display-italic text-[28px] md:text-[36px] leading-[1.25] text-vellum-dim text-balance border-l-2 border-seal pl-8">
          The next billion-dollar AI app isn't a model. It's the memory
          layer underneath it.
        </blockquote>

        <div className="mt-14 grid md:grid-cols-2 gap-10 max-w-[960px]">
          <p className="text-vellum text-[16px] leading-[1.7]">
            Talk to anyone building serious agents — the bottleneck isn't
            intelligence, it's <strong>continuity</strong>. Without memory,
            every conversation starts from zero. With memory, your AI
            knows your habits, history, preferences. And that's exactly
            the data you can't afford to leak.
          </p>
          <p className="text-vellum text-[16px] leading-[1.7]">
            Today's options are bad. <strong>Pinecone</strong>?
            Centralized. <strong>ChromaDB</strong>? Local-only.{" "}
            <strong>0G Memory</strong>? Powerful — but its own code flags
            the user-secrets backup as plaintext-unsafe and has no
            primitive for sharing memory between agents.
          </p>
        </div>

        <p className="mt-14 text-vellum-dim font-display text-[28px] leading-[1.3] text-balance max-w-[780px]">
          We're building the layer that fixes all three.
        </p>
      </section>

      <Divider eyebrow="002 / Not a hackathon project" />

      {/* ─── PRODUCT, NOT HACKATHON ─────────────────────────────── */}
      <section className="relative mx-auto max-w-[1280px] px-8 py-24">
        <h2 className="font-display text-vellum text-[clamp(40px,5vw,72px)] leading-[0.95] tracking-[-0.03em] text-balance">
          The hackathon was the catalyst.{" "}
          <span className="font-display-italic text-seal">
            Not the destination.
          </span>
        </h2>

        <div className="mt-12 grid md:grid-cols-3 gap-8 max-w-[1100px]">
          <Stat label="Contracts on 0G Mainnet" value="4" detail="Verifier · NFT · Capability · Audit" />
          <Stat label="LLM brains in the demo" value="2" detail="Claude orchestration + Qwen-in-TDX" />
          <Stat label="Project already integrating" value="1" detail="0G ecosystem · in conversation w/ more" />
        </div>

        <p className="mt-14 max-w-[780px] text-vellum text-[18px] leading-[1.7]">
          In the past two weeks we've shipped four contracts to 0G
          mainnet, a TEE-attested inference gateway, a Python addon for
          0G Memory, an SDK, and a working two-agent demo. We've talked
          to devs across Discord and Twitter — the response has been the
          same every time:{" "}
          <em className="font-display-italic text-seal-deep">
            "this is the missing piece."
          </em>
        </p>

        <p className="mt-6 max-w-[780px] text-vellum text-[18px] leading-[1.7]">
          One project building in the 0G ecosystem has{" "}
          <strong>already started using SealedMind as their memory layer</strong>.
          More are in conversation. The thesis is right: every AI agent
          platform needs this, and nobody else is building it as a
          primitive.
        </p>
      </section>

      <Divider eyebrow="003 / How anyone uses it" />

      {/* ─── INTEGRATION PATHS ──────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1280px] px-8 py-24">
        <h2 className="font-display text-vellum text-[clamp(40px,5vw,72px)] leading-[0.95] tracking-[-0.03em] text-balance">
          Three integration paths.{" "}
          <span className="font-display-italic text-seal">Pick the level that fits.</span>
        </h2>

        <div className="mt-14 grid lg:grid-cols-3 gap-6">
          <Path
            badge="Path A"
            badgeColor="seal"
            title="Drop into 0G Memory"
            duration="One line"
            body={
              <>
                Already on{" "}
                <code className="font-mono text-seal-deep">
                  0gfoundation/0g-memory
                </code>
                ?
              </>
            }
            code={`pip install evermemos-sealedmind
export KV_STORAGE_TYPE=sealedmind`}
            outcome="Encrypted writes, blinded local index, encrypted backup. Zero code changes."
          />
          <Path
            badge="Path B"
            badgeColor="rune"
            title="Use our primitives"
            duration="Any stack"
            body={
              <>
                Building on a different framework? Call our{" "}
                <strong>CapabilityRegistry</strong> from any web3 lib for
                on-chain memory sharing. Hit our{" "}
                <strong>Sealed Inference</strong> gateway for TEE-attested
                LLM calls. Cherry-pick.
              </>
            }
            code={`registry.grantCapability(
  mindId, "fitness",
  doctor, true, expiry
)`}
            outcome="Permissionless contracts on 0G mainnet. No SDK required."
          />
          <Path
            badge="Path C"
            badgeColor="ember"
            title="Full hosted stack"
            duration="3 lines"
            body={
              <>
                Encrypted storage + capability management + TEE inference,
                all behind one TypeScript client. SIWE login, three lines,
                your agent has a private memory.
              </>
            }
            code={`import { SealedMind } from "@sealedmind/sdk";
const client = new SealedMind();
await client.login(signer);`}
            outcome="@sealedmind/sdk on npm. Hosted backend on Railway."
          />
        </div>
      </section>

      <Divider eyebrow="004 / Shipped, not pitched" />

      {/* ─── PROOF ──────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1280px] px-8 py-24">
        <h2 className="font-display text-vellum text-[clamp(40px,5vw,72px)] leading-[0.95] tracking-[-0.03em] text-balance">
          What makes this real.
        </h2>

        <div className="mt-14 grid md:grid-cols-2 gap-x-12 gap-y-6 max-w-[1100px]">
          <Proof text="Four contracts deployed on 0G mainnet (chainId 16661) and testnet" />
          <Proof text="Live TEE inference — Qwen 2.5 7B in Intel TDX + NVIDIA H100, every reply attested" />
          <Proof text="Real on-chain capability flow — grant in one tx, revoke in another, instant enforcement" />
          <Proof text="Working drop-in addon for 0G Memory, validated end-to-end against the production repo" />
          <Proof text="Two real LLM brains in the demo — Claude orchestrating + Qwen-in-TDX processing inside the enclave" />
          <Proof text="First external project already integrating in the 0G ecosystem" />
        </div>

        <p className="mt-14 font-display text-[28px] md:text-[36px] text-vellum-dim leading-[1.25] text-balance max-w-[780px]">
          Open the live demo and grant a capability yourself.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link to="/demo" className="btn-seal">
            Live demo
            <span>→</span>
          </Link>
          <Link to="/dashboard" className="btn-ghost">
            Mint a Mind
          </Link>
          <a
            href="https://chainscan.0g.ai/address/0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            CapabilityRegistry on chain
          </a>
        </div>
      </section>

      {/* ─── CLOSER ─────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-[1280px] px-8 py-32 text-center">
        <p className="font-display-italic text-[clamp(32px,5vw,64px)] leading-[1.15] text-vellum text-balance">
          Your AI's memory should belong to you.
          <br />
          <span className="text-seal glow-text-seal">
            SealedMind makes that the default.
          </span>
        </p>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────── Sub-components

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

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="terminal-frame p-6">
      <div className="font-display text-seal text-[64px] leading-none">{value}</div>
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-dim mt-3">
        {label}
      </div>
      <div className="text-vellum-mute text-[13px] mt-2">{detail}</div>
    </div>
  );
}

function Path({
  badge,
  badgeColor,
  title,
  duration,
  body,
  code,
  outcome,
}: {
  badge: string;
  badgeColor: "seal" | "rune" | "ember";
  title: string;
  duration: string;
  body: React.ReactNode;
  code: string;
  outcome: string;
}) {
  const ringClass =
    badgeColor === "seal"
      ? "hairline-seal"
      : badgeColor === "rune"
      ? "hairline-rune"
      : "hairline";
  const accent =
    badgeColor === "seal"
      ? "text-seal"
      : badgeColor === "rune"
      ? "text-rune"
      : "text-ember";
  return (
    <div className={`terminal-frame ${ringClass} p-6 flex flex-col gap-5 h-full`}>
      <div className="flex items-center justify-between">
        <span className={`font-mono text-[10px] tracking-[0.22em] uppercase ${accent}`}>
          {badge}
        </span>
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
          {duration}
        </span>
      </div>
      <h3 className="font-display text-vellum text-[28px] leading-[1.05]">{title}</h3>
      <p className="text-vellum-dim text-[14px] leading-[1.55] flex-1">{body}</p>
      <pre className="font-mono text-[11px] text-vellum bg-ink-2 p-3 hairline overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <p className={`font-mono text-[10px] tracking-[0.18em] uppercase ${accent}`}>
        ↳ {outcome}
      </p>
    </div>
  );
}

function Proof({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-block mt-2 w-2 h-2 bg-seal rounded-full anim-pulse-seal flex-shrink-0" />
      <p className="text-vellum text-[15px] leading-[1.55]">{text}</p>
    </div>
  );
}

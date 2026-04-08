import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "../lib/auth";
import MindSeal from "../components/MindSeal";
import type { Mind } from "@sealedmind/sdk";

export default function Dashboard() {
  const { isConnected, isAuthenticated, login, loading, error, client, address } =
    useAuth();
  const [minds, setMinds] = useState<Mind[]>([]);
  const [fetching, setFetching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    setFetching(true);
    client
      .listMinds()
      .then((res) => setMinds(res.minds || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [isAuthenticated, client]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await client.createMind(name.trim());
      const res = await client.listMinds();
      setMinds(res.minds || []);
      setName("");
    } finally {
      setCreating(false);
    }
  };

  // Unauthenticated states
  if (!isConnected) {
    return (
      <Gate
        eyebrow="001 / Connect"
        title={
          <>
            Connect a wallet to<br />
            <span className="font-display-italic text-seal">claim your Mind.</span>
          </>
        }
        body="The vault is gated by your private key. Your wallet is the only thing that can unseal it."
      >
        <ConnectButton />
      </Gate>
    );
  }

  if (!isAuthenticated) {
    return (
      <Gate
        eyebrow="002 / Sign in"
        title={
          <>
            Sign the seal to<br />
            <span className="font-display-italic text-seal">prove the wallet is yours.</span>
          </>
        }
        body="A SIWE signature gives you a session token. Nothing on chain — just a cryptographic handshake."
      >
        <button className="btn-seal" disabled={loading} onClick={() => login()}>
          {loading ? "Sealing…" : "Sign-In with Ethereum"}
          <span>→</span>
        </button>
        {error && <p className="font-mono text-[11px] text-crimson mt-4">{error}</p>}
      </Gate>
    );
  }

  // Authenticated dashboard
  return (
    <div className="relative mx-auto max-w-[1440px] px-8 py-16">
      {/* Header */}
      <div className="grid grid-cols-12 gap-8 items-end mb-16">
        <div className="col-span-12 lg:col-span-7">
          <div className="eyebrow flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-seal" />
            Vault · {address?.slice(0, 6)}…{address?.slice(-4)}
          </div>
          <h1 className="font-display mt-6 text-[88px] leading-[0.85] tracking-[-0.03em] text-vellum">
            My Minds
          </h1>
          <p className="mt-6 text-vellum-dim text-[16px] max-w-[520px] leading-[1.7]">
            Each Mind is an encrypted memory vault, anchored on chain as an
            ERC-7857 iNFT. Sealed inside TEE. Owned by you.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 lg:items-end">
          <div className="hairline-seal bg-ink-2/60 p-5 w-full lg:max-w-[420px]">
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute mb-3">
              Forge a new Mind
            </div>
            <div className="flex gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "Personal Memory"'
                className="flex-1 bg-ink border border-vellum/10 px-4 py-3 font-mono text-[12px] text-vellum placeholder:text-vellum-mute focus:border-seal focus:outline-none"
              />
              <button
                className="btn-seal"
                disabled={creating || !name.trim()}
                onClick={handleCreate}
              >
                {creating ? "…" : "Mint"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Minds grid */}
      {fetching ? (
        <div className="font-mono text-[11px] text-vellum-mute uppercase tracking-[0.22em]">
          ▸ Loading vault…
        </div>
      ) : minds.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {minds.map((mind, i) => (
            <MindCard key={mind.id || i} mind={mind} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function MindCard({ mind, index }: { mind: Mind; index: number }) {
  const id = mind.id || `mind-${index + 1}`;
  return (
    <div className="col-span-12 md:col-span-6 xl:col-span-4 group relative hairline bg-ink-2/40 grain p-8 transition-all duration-500 hover:hairline-seal hover:bg-ink-2/70">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal">
            Mind · #{String(index + 1).padStart(3, "0")}
          </div>
          <div className="font-display text-[32px] leading-none mt-3 text-vellum group-hover:text-seal transition-colors">
            {mind.name || "Unnamed"}
          </div>
        </div>
        <MindSeal size={56} active={false} />
      </div>

      <div className="space-y-2 font-mono text-[11px] text-vellum-dim">
        <div className="flex justify-between">
          <span className="text-vellum-mute">memories</span>
          <span className="text-vellum">{mind.memoryCount ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-vellum-mute">shards</span>
          <span className="text-vellum">{mind.shards?.length ?? 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-vellum-mute">created</span>
          <span className="text-vellum">
            {mind.createdAt
              ? new Date(mind.createdAt).toLocaleDateString()
              : "—"}
          </span>
        </div>
      </div>

      {/* Memory bar */}
      <div className="mt-6">
        <div className="h-px bg-vellum/10 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-seal anim-pulse-seal"
            style={{ width: `${Math.min(100, (mind.memoryCount ?? 0) * 5)}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 grid grid-cols-2 gap-3">
        <Link
          to={`/mind/${id}/chat`}
          className="text-center font-mono text-[10px] tracking-[0.22em] uppercase py-3 border border-vellum/15 hover:border-seal hover:text-seal transition-colors"
        >
          Open ↗
        </Link>
        <Link
          to={`/mind/${id}/sharing`}
          className="text-center font-mono text-[10px] tracking-[0.22em] uppercase py-3 border border-vellum/15 hover:border-rune hover:text-rune transition-colors"
        >
          Share ⬡
        </Link>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="hairline bg-ink-2/30 grain p-20 text-center">
      <div className="flex justify-center mb-8">
        <MindSeal size={140} variant="rune" />
      </div>
      <div className="font-display text-[42px] leading-tight text-vellum">
        The vault is silent.
      </div>
      <p className="font-display-italic text-rune text-[22px] mt-3">
        Forge your first Mind above.
      </p>
      <p className="font-sans text-vellum-dim text-[14px] mt-6 max-w-[420px] mx-auto leading-relaxed">
        A Mind is born sealed. Once you start speaking to it, every memory
        will be encrypted, indexed, and bound to your wallet — forever.
      </p>
    </div>
  );
}

function Gate({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto max-w-[1440px] px-8 py-32">
      <div className="grid grid-cols-12 gap-12 items-center">
        <div className="col-span-12 lg:col-span-7">
          <div className="eyebrow flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-seal" />
            {eyebrow}
          </div>
          <h1 className="font-display mt-8 text-[clamp(56px,8vw,112px)] leading-[0.88] tracking-[-0.03em] text-vellum text-balance">
            {title}
          </h1>
          <p className="mt-8 text-vellum-dim text-[18px] max-w-[520px] leading-[1.6]">
            {body}
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-6">{children}</div>
        </div>
        <div className="col-span-12 lg:col-span-5 flex justify-center lg:justify-end">
          <MindSeal size={380} />
        </div>
      </div>
    </div>
  );
}

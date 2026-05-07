import { useEffect, useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SiweMessage } from "siwe";

const BACKEND =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "https://sealedmind-backend-production.up.railway.app";

type SnippetLang = "curl" | "js" | "py-sdk" | "py-addon";

export default function Developer() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [tab, setTab] = useState<SnippetLang>("js");

  // Restore from localStorage so refresh doesn't lose the key
  useEffect(() => {
    if (!address) return;
    const cached = localStorage.getItem(`sm_apikey:${address.toLowerCase()}`);
    if (cached) setApiKey(cached);
  }, [address]);

  async function issueKey() {
    if (!address) return;
    setIssuing(true);
    setError(null);
    try {
      // 1. Get SIWE nonce
      const nonceR = await fetch(`${BACKEND}/v1/auth/nonce`);
      if (!nonceR.ok) throw new Error("could not fetch SIWE nonce");
      const { nonce } = await nonceR.json();

      // 2. Build SIWE message
      const siwe = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to SealedMind to issue a developer API key.",
        uri: window.location.origin,
        version: "1",
        chainId: chainId ?? 16602,
        nonce,
      });
      const message = siwe.prepareMessage();

      // 3. Sign
      const signature = await signMessageAsync({ message });

      // 4. Login → bearer token
      const loginR = await fetch(`${BACKEND}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!loginR.ok) {
        const t = await loginR.text();
        throw new Error(`login failed: ${t}`);
      }
      const { token } = await loginR.json();

      // 5. Issue API key
      const keyR = await fetch(`${BACKEND}/v1/auth/apikey`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!keyR.ok) {
        const t = await keyR.text();
        throw new Error(`apikey failed: ${t}`);
      }
      const { apiKey: newKey } = await keyR.json();
      setApiKey(newKey);
      localStorage.setItem(`sm_apikey:${address.toLowerCase()}`, newKey);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="relative mx-auto max-w-[1280px] px-8 py-16">
      <div className="eyebrow flex items-center gap-3">
        <span className="inline-block w-8 h-px bg-seal" />
        Developer · API access
      </div>

      <h1 className="font-display mt-8 text-vellum text-[clamp(40px,5vw,72px)] leading-[0.95] tracking-[-0.03em] text-balance">
        Get an API key in{" "}
        <span className="font-display-italic text-seal">two clicks</span>.
      </h1>

      <p className="font-display mt-8 text-vellum-dim text-[18px] leading-[1.5] max-w-[720px]">
        Sign in with your wallet, get a long-lived <code>sm_*</code> key, paste
        the snippet of your choice. Your memories are encrypted client-side
        before they ever reach our backend — the API key is just for routing
        and rate-limiting.
      </p>

      <div className="mt-12 grid lg:grid-cols-2 gap-8">
        <KeyPanel
          isConnected={isConnected}
          address={address}
          apiKey={apiKey}
          issuing={issuing}
          error={error}
          onIssue={issueKey}
        />
        <SnippetPanel
          tab={tab}
          setTab={setTab}
          apiKey={apiKey}
          backendUrl={BACKEND}
        />
      </div>

      <CapabilitiesSection backendUrl={BACKEND} />
      <PolicySection />
    </div>
  );
}

// ──────────────────────────────────────── Key panel

function KeyPanel({
  isConnected, address, apiKey, issuing, error, onIssue,
}: {
  isConnected: boolean;
  address: `0x${string}` | undefined;
  apiKey: string | null;
  issuing: boolean;
  error: string | null;
  onIssue: () => void;
}) {
  return (
    <div className="terminal-frame p-8">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal">
        Step 1 — your key
      </div>

      {!isConnected ? (
        <>
          <p className="mt-4 text-vellum text-[15px] leading-[1.6]">
            Connect a wallet, sign a SIWE message, get an API key bound to your
            address.
          </p>
          <div className="mt-8">
            <ConnectButton showBalance={false} />
          </div>
        </>
      ) : !apiKey ? (
        <>
          <p className="mt-4 text-vellum text-[15px] leading-[1.6]">
            Connected as <code className="text-seal-deep">{address?.slice(0, 6)}…{address?.slice(-4)}</code>.
            Click below to sign and issue your key.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={onIssue}
              disabled={issuing}
              className={`btn-seal ${issuing ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {issuing ? "Signing…" : "Sign & issue API key"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 text-vellum text-[15px] leading-[1.6]">
            Your key is below. <strong>Save it now</strong> — the backend won't
            re-show it. Treat it like a password; rotating means signing a new
            SIWE message from this address.
          </p>
          <div className="mt-6">
            <CopyableField label="API key" value={apiKey} />
          </div>
          <div className="mt-4 hairline-rune p-3 font-mono text-[10px] text-rune-deep leading-[1.6]">
            Don't ship this in client-side JS. Use a server proxy or a session
            token. The key authorises encrypted writes on your behalf.
          </div>
        </>
      )}

      {error && (
        <div className="mt-4 hairline-rune p-3 font-mono text-[11px] text-crimson">
          {error}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────── Snippet panel

function SnippetPanel({
  tab, setTab, apiKey, backendUrl,
}: {
  tab: SnippetLang;
  setTab: (t: SnippetLang) => void;
  apiKey: string | null;
  backendUrl: string;
}) {
  const key = apiKey ?? "<paste your sm_* key here>";

  const snippets = useMemo<Record<SnippetLang, { title: string; sub: string; code: string }>>(() => ({
    curl: {
      title: "curl",
      sub: "Hit any endpoint directly",
      code: `curl -X POST ${backendUrl}/v1/inference/chat \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Summarize this memory in one sentence: ..."}
    ],
    "maxTokens": 256
  }'`,
    },
    js: {
      title: "TypeScript / JavaScript",
      sub: "@sealedmind/sdk",
      code: `// npm install @sealedmind/sdk
import { SealedMind } from "@sealedmind/sdk";

const client = new SealedMind({
  apiUrl: "${backendUrl}",
  apiKey: "${key}",
});

// Create a Mind (mints an iNFT for the wallet bound to the key)
const { mind } = await client.createMind("my-agent");

// Store a memory — encrypted before upload
await client.remember(mind.id, {
  content: "User prefers vegetarian meals",
  shard: "preferences",
});

// Recall — TEE-attested response
const { answer, attestation } = await client.recall(mind.id, {
  query: "What do I prefer to eat?",
});

console.log(answer);
console.log("attested in:", attestation.enclave);`,
    },
    "py-sdk": {
      title: "Python — generic agent",
      sub: "pip install sealedmind",
      code: `# pip install sealedmind
from sealedmind import SealedMind

client = SealedMind(
    api_url="${backendUrl}",
    api_key="${key}",
)

# Create a Mind
mind = await client.create_mind("my-agent")

# Store a memory
await client.remember(mind.id, content="User runs 8km in 45 min on Mondays")

# Recall — TEE-attested
result = await client.recall(mind.id, query="What's my running pace?")
print(result.answer)
print("attested:", result.attestation.enclave)`,
    },
    "py-addon": {
      title: "Python — 0G Memory addon",
      sub: "pip install evermemos-sealedmind",
      code: `# Already running 0G Memory? Use the drop-in addon.
# pip install evermemos-sealedmind

# Then in your environment:
#
#   export MEMSYS_ENTRYPOINTS_FILTER=core,sealedmind
#   export KV_STORAGE_TYPE=sealedmind
#   export SEALEDMIND_BACKUP_KEY=<32-byte hex from your wallet>
#
# Your existing memory.put / memory.get calls now route through
# AES-256-GCM envelopes on 0G Storage with HMAC-blinded keys —
# no code changes.

# (Optional) Use the API key for the TEE inference gateway:
#   export SEALEDMIND_INFERENCE_API_KEY=${key}
#
from memsys.memory import Memory
mem = Memory()
await mem.put("episodic_memories:run-2026-04-30",
              '{"content": "8km in 45 min", "shard": "fitness"}')`,
    },
  }), [key, backendUrl]);

  const current = snippets[tab];

  return (
    <div className="terminal-frame p-0 overflow-hidden">
      <div className="px-6 pt-6">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal">
          Step 2 — paste & ship
        </div>
        <h3 className="font-display text-vellum text-[24px] mt-2">{current.title}</h3>
        <div className="font-mono text-[11px] text-vellum-mute mt-1">{current.sub}</div>
      </div>

      <div className="mt-4 px-6 flex gap-2 border-b border-vellum/10">
        {(Object.keys(snippets) as SnippetLang[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`pb-3 px-3 font-mono text-[10px] tracking-[0.22em] uppercase transition-colors ${
              k === tab
                ? "text-seal border-b border-seal"
                : "text-vellum-mute hover:text-vellum-dim"
            }`}
          >
            {snippets[k].title.replace(/^Python.*/, "Python") + (k === "py-addon" ? " · addon" : k === "py-sdk" ? " · SDK" : "")}
          </button>
        ))}
      </div>

      <div className="relative">
        <pre className="font-mono text-[12px] text-vellum bg-ink-2 p-6 overflow-x-auto whitespace-pre leading-[1.7]">
          {current.code}
        </pre>
        <CopyButton text={current.code} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────── Capabilities

function CapabilitiesSection({ backendUrl }: { backendUrl: string }) {
  return (
    <section className="mt-20">
      <div className="eyebrow flex items-center gap-3 mb-4">
        <span className="inline-block w-8 h-px bg-seal" />
        Endpoint reference
      </div>
      <h2 className="font-display text-vellum text-[clamp(28px,3.5vw,48px)] leading-[1.05]">
        What you can hit with this key.
      </h2>

      <div className="mt-10 grid md:grid-cols-2 gap-5 max-w-[1100px]">
        <Endpoint method="POST" path="/v1/minds" desc="Create a Mind. Mints an iNFT for the bound wallet." />
        <Endpoint method="GET"  path="/v1/minds" desc="List your Minds." />
        <Endpoint method="POST" path="/v1/minds/:id/remember" desc="Store an encrypted memory." />
        <Endpoint method="POST" path="/v1/minds/:id/recall" desc="RAG over your memory in TEE." />
        <Endpoint method="POST" path="/v1/minds/:id/capabilities" desc="Grant another wallet read access to a shard." />
        <Endpoint method="DELETE" path="/v1/minds/:id/capabilities/:capId" desc="Revoke a capability — instantly enforced on chain." />
        <Endpoint method="GET"  path="/v1/minds/:id/audit" desc="Read the on-chain MemoryAccessLog for this Mind." />
        <Endpoint method="POST" path="/v1/inference/chat" desc="Generic Qwen 2.5 7B in Intel TDX. Rate-limited per key." />
      </div>

      <div className="mt-8 font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
        base url: <span className="text-vellum-dim">{backendUrl}</span>
      </div>
    </section>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colour =
    method === "POST"   ? "text-seal" :
    method === "DELETE" ? "text-crimson" :
                          "text-rune";
  return (
    <div className="terminal-frame p-4 flex items-start gap-4">
      <span className={`font-mono text-[10px] tracking-[0.18em] uppercase ${colour} mt-1 flex-shrink-0`}>
        {method}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[12px] text-vellum break-all">{path}</div>
        <div className="text-vellum-dim text-[12px] leading-[1.5] mt-1">{desc}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────── Policy

function PolicySection() {
  return (
    <section className="mt-20 max-w-[900px]">
      <div className="eyebrow flex items-center gap-3 mb-4">
        <span className="inline-block w-8 h-px bg-seal" />
        Limits & policy
      </div>
      <ul className="space-y-3 text-vellum text-[14px] leading-[1.6]">
        <li>• Rate limit: <strong>30 requests / 60s per key</strong> on <code>/v1/inference/chat</code>. Other endpoints are looser. Need more? DM us.</li>
        <li>• Storage costs: writes pay 0G testnet gas via the SealedMind operator wallet. Per-key storage quotas are in flight.</li>
        <li>• Capability events are public on chain — that's the design. Memory contents stay encrypted client-side; only the capability record + access-log entries are public.</li>
        <li>• Rotating: connect the same wallet → click "Sign & issue API key" again. The new key replaces the old in the dashboard; the old key keeps working (revocation UI coming next sprint).</li>
        <li>• MIT-licensed everything: <code>github.com/SealedMind/SealedMindMonoRepo</code></li>
      </ul>
    </section>
  );
}

// ──────────────────────────────────────── Bits

function CopyableField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute mb-1">
        {label}
      </div>
      <div className="relative">
        <code className="block font-mono text-[12px] text-vellum bg-ink-2 px-4 py-3 hairline break-all pr-20">
          {value}
        </code>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="absolute top-3 right-3 font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1 hairline-seal text-seal hover:bg-seal hover:text-white transition-colors"
    >
      {done ? "Copied ✓" : "Copy"}
    </button>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";

type PathKey = "addon" | "contracts" | "sdk" | "cherry";

export default function Docs() {
  const [tab, setTab] = useState<PathKey>("addon");
  return (
    <div className="relative mx-auto max-w-[1280px] px-8 py-16">
      <header className="mb-12">
        <div className="eyebrow flex items-center gap-3">
          <span className="inline-block w-8 h-px bg-seal" />
          Docs · everything you need to integrate
        </div>
        <h1 className="font-display mt-8 text-vellum text-[clamp(40px,5vw,72px)] leading-[0.95] tracking-[-0.03em]">
          Build with{" "}
          <span className="font-display-italic text-seal">SealedMind</span>.
        </h1>
        <p className="font-display mt-6 text-vellum-dim text-[18px] leading-[1.5] max-w-[760px]">
          Three integration paths, every endpoint, every contract, ABIs and
          addresses. Pick the level that fits and ship.
        </p>
      </header>

      <Tabs tab={tab} setTab={setTab} />
      <div className="mt-10">
        {tab === "addon" && <PathAddon />}
        {tab === "contracts" && <PathContracts />}
        {tab === "sdk" && <PathSDK />}
        {tab === "cherry" && <PathCherry />}
      </div>

      <Section title="Deployed contracts" eyebrow="addresses · live forever">
        <ContractsTable />
      </Section>

      <Section title="API reference" eyebrow="hosted backend">
        <ApiTable />
      </Section>

      <Section title="Need an API key?" eyebrow="self-serve">
        <p className="text-vellum text-[15px] leading-[1.7] max-w-[720px]">
          Connect your wallet on the{" "}
          <Link to="/developer" className="text-seal hover:underline">
            developer page
          </Link>
          , sign a SIWE message, copy your <code>sm_*</code> key. Same key
          works for the SDK, the addon, and direct curl calls.
        </p>
      </Section>

      <Footer />
    </div>
  );
}

// ───────────────────────────────────────────── Tabs

function Tabs({ tab, setTab }: { tab: PathKey; setTab: (k: PathKey) => void }) {
  const items: { key: PathKey; label: string; sub: string }[] = [
    { key: "addon",     label: "Path A · 0G Memory addon",   sub: "Already on 0gfoundation/0g-memory" },
    { key: "sdk",       label: "Path B · Hosted SDK",         sub: "Any agent stack, three lines" },
    { key: "contracts", label: "Path C · Direct contracts",  sub: "Permissionless, zero deps on us" },
    { key: "cherry",    label: "Cherry-pick",                 sub: "Just one piece" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => setTab(it.key)}
          className={`text-left p-4 transition-colors ${
            tab === it.key
              ? "terminal-frame hairline-seal glow-seal"
              : "terminal-frame hover:hairline-seal"
          }`}
        >
          <div
            className={`font-mono text-[10px] tracking-[0.22em] uppercase ${
              tab === it.key ? "text-seal" : "text-vellum-mute"
            }`}
          >
            {it.label}
          </div>
          <div className="text-vellum text-[13px] mt-2 leading-[1.4]">{it.sub}</div>
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────── Path A

function PathAddon() {
  return (
    <Card title="Path A — drop into 0G Memory" tone="seal">
      <p className="text-vellum text-[15px] leading-[1.7]">
        For projects already running{" "}
        <a
          href="https://github.com/0gfoundation/0g-memory"
          target="_blank" rel="noreferrer"
          className="text-seal hover:underline"
        >
          0gfoundation/0g-memory (EverMemOS)
        </a>
        . Three env vars and you're done — no code changes.
      </p>
      <Code lang="bash">{`pip install evermemos-sealedmind`}</Code>
      <Code lang="bash">{`export MEMSYS_ENTRYPOINTS_FILTER=core,sealedmind
export KV_STORAGE_TYPE=sealedmind
export SEALEDMIND_BACKUP_KEY=<32-byte hex master key>`}</Code>
      <p className="text-vellum-dim text-[13px] leading-[1.6]">
        Your existing <code>memory.put / memory.get</code> calls now route through
        AES-256-GCM envelopes on 0G Storage with HMAC-blinded keys. The
        plaintext <code>user_secrets_backup.json</code> is replaced with an
        encrypted envelope. Capability sharing is opt-in via{" "}
        <code>SEALEDMIND_CAPABILITY_TOKEN</code>.
      </p>
      <Mini title="What's overridden">
        <Pill>SealedMindKVStorage → KVStorageInterface</Pill>
        <Pill>WalletVault → UserSecretBackup</Pill>
        <Pill>CapabilityClient (new)</Pill>
        <Pill>UserAware variant for SERVER_MODE</Pill>
      </Mini>
      <DocLink href="https://pypi.org/project/evermemos-sealedmind/">
        evermemos-sealedmind on PyPI →
      </DocLink>
    </Card>
  );
}

// ───────────────────────────────────────────── Path B

function PathSDK() {
  return (
    <>
      <Card title="Path B — Hosted SDK" tone="seal">
        <p className="text-vellum text-[15px] leading-[1.7]">
          For any agent stack — TypeScript, Python, custom. Three lines and
          your agent has a private memory backed by encrypted 0G storage and
          on-chain capabilities.
        </p>
        <SubTabs />
      </Card>
    </>
  );
}

function SubTabs() {
  const [k, setK] = useState<"ts" | "py" | "curl">("ts");
  return (
    <>
      <div className="mt-2 flex gap-2 border-b border-vellum/10">
        {([
          ["ts", "TypeScript / @sealedmind/sdk"],
          ["py", "Python / sealedmind"],
          ["curl", "curl"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setK(key)}
            className={`pb-3 px-3 font-mono text-[10px] tracking-[0.22em] uppercase transition-colors ${
              k === key
                ? "text-seal border-b border-seal"
                : "text-vellum-mute hover:text-vellum-dim"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {k === "ts" && (
        <Code lang="ts">{`npm install @sealedmind/sdk

import { SealedMind } from "@sealedmind/sdk";

const client = new SealedMind({
  apiUrl: "https://sealedmind-backend-production.up.railway.app",
  apiKey: "sm_...",
});

const { mind } = await client.createMind("my-agent");

await client.remember(mind.id, {
  content: "User prefers vegetarian meals",
  shard: "preferences",
});

const result = await client.recall(mind.id, {
  query: "What does the user prefer to eat?",
});

console.log(result.answer);
console.log("attested in:", result.attestation.enclave);`}</Code>
      )}
      {k === "py" && (
        <Code lang="python">{`pip install sealedmind

from sealedmind import SealedMind

client = SealedMind(api_key="sm_...")

mind = await client.create_mind("my-agent")

await client.remember(mind.id, content="User runs 8km in 45 min")

result = await client.recall(mind.id, query="What's my pace?")
print(result.answer)
print("attested:", result.attestation.enclave)

await client.aclose()`}</Code>
      )}
      {k === "curl" && (
        <Code lang="bash">{`curl -X POST https://sealedmind-backend-production.up.railway.app/v1/inference/chat \\
  -H "Authorization: Bearer sm_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "user", "content": "Summarize my recent activity"}],
    "maxTokens": 256
  }'`}</Code>
      )}
    </>
  );
}

// ───────────────────────────────────────────── Path C

function PathContracts() {
  return (
    <Card title="Path C — Use the contracts directly" tone="rune">
      <p className="text-vellum text-[15px] leading-[1.7]">
        Bring your own storage. Bring your own LLM. Use SealedMind's{" "}
        <code>CapabilityRegistry</code> as the on-chain primitive for revocable,
        time-bound, scope-limited memory sharing between agents. Permissionless,
        immutable, callable from any web3 library.
      </p>
      <Code lang="python">{`from web3 import Web3
import json

CAPABILITY_REGISTRY = "0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45"  # mainnet
w3 = Web3(Web3.HTTPProvider("https://evmrpc.0g.ai"))
registry = w3.eth.contract(
    address=CAPABILITY_REGISTRY,
    abi=json.load(open("CapabilityRegistry.abi.json")),
)

# Patient grants doctor read-only access to "fitness" shard, 30 days
tx = registry.functions.grantCapability(
    mind_id, "fitness", doctor_address, True, expiry_unix
).build_transaction({...})

# At read time, gateway verifies on chain
ok = registry.functions.verifyCapability(cap_id, doctor_address).call()
# True until owner calls revokeCapability(cap_id)`}</Code>
      <DocLink href="https://github.com/SealedMind/SealedMindMonoRepo/blob/main/contracts/contracts/CapabilityRegistry.sol">
        CapabilityRegistry.sol on GitHub →
      </DocLink>
    </Card>
  );
}

// ───────────────────────────────────────────── Cherry-pick

function PathCherry() {
  const items: [string, string, string][] = [
    ["TEE-attested LLM only", "POST /v1/inference/chat", "Qwen 2.5 7B in Intel TDX. Auth + rate-limited. Get a key from /developer."],
    ["On-chain capability sharing", "CapabilityRegistry contract", "Grant / verify / revoke between agents. No SDK required."],
    ["Encrypted KV storage as a Python lib", "from evermemos_sealedmind import SealedMindKVStorage", "Standalone, works outside 0G Memory too."],
    ["ERC-7857 iNFT for agent memory", "SealedMindNFT contract", "Memory ownership as a transferable asset."],
    ["Verifiable memory access log", "MemoryAccessLog contract", "Immutable on-chain audit of every read/write/share."],
    ["TypeScript SDK", "npm install @sealedmind/sdk", "Wraps the hosted backend."],
    ["Python SDK", "pip install sealedmind", "Same shape as the TS SDK."],
  ];
  return (
    <Card title="Cherry-pick — just one piece" tone="seal">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute border-b border-vellum/10">
              <th className="py-2 pr-4">What you want</th>
              <th className="py-2 pr-4">What you call</th>
              <th className="py-2 pr-4">Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map(([want, call, notes]) => (
              <tr key={call} className="border-b border-vellum/5">
                <td className="py-3 pr-4 text-vellum">{want}</td>
                <td className="py-3 pr-4 font-mono text-[12px] text-seal-deep">{call}</td>
                <td className="py-3 pr-4 text-vellum-dim">{notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ───────────────────────────────────────────── Contracts table

function ContractsTable() {
  const networks: {
    name: string; chainId: number; explorer: string;
    addresses: { contract: string; addr: string }[];
  }[] = [
    {
      name: "0G Mainnet", chainId: 16661, explorer: "https://chainscan.0g.ai",
      addresses: [
        { contract: "Verifier",           addr: "0x6D5B3B81119F78366B767DB81C2dd6625d5648Af" },
        { contract: "SealedMindNFT",      addr: "0x091CfC4b9E6FF0026F384b8c4664B8C03Af21EA6" },
        { contract: "CapabilityRegistry", addr: "0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45" },
        { contract: "MemoryAccessLog",    addr: "0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad" },
      ],
    },
    {
      name: "0G Testnet (Galileo)", chainId: 16602, explorer: "https://chainscan-galileo.0g.ai",
      addresses: [
        { contract: "Verifier",           addr: "0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd" },
        { contract: "SealedMindNFT",      addr: "0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7" },
        { contract: "CapabilityRegistry", addr: "0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66" },
        { contract: "MemoryAccessLog",    addr: "0xB085F48c98E8878ACA88460B37653cC8d2E24482" },
      ],
    },
  ];
  return (
    <div className="space-y-8">
      {networks.map((n) => (
        <div key={n.chainId} className="terminal-frame p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display text-vellum text-[20px]">{n.name}</div>
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute mt-1">
                chainId {n.chainId}
              </div>
            </div>
            <a
              href={n.explorer}
              target="_blank" rel="noreferrer"
              className="font-mono text-[11px] tracking-[0.18em] uppercase text-seal-deep hover:underline"
            >
              {n.explorer.replace("https://", "")} →
            </a>
          </div>
          <div className="space-y-2">
            {n.addresses.map((a) => (
              <div key={a.addr} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-vellum/5">
                <div className="font-mono text-[12px] text-vellum">{a.contract}</div>
                <a
                  href={`${n.explorer}/address/${a.addr}`}
                  target="_blank" rel="noreferrer"
                  className="font-mono text-[12px] text-seal-deep hover:underline break-all"
                >
                  {a.addr}
                </a>
              </div>
            ))}
          </div>
          <div className="mt-3 font-mono text-[10px] tracking-[0.18em] uppercase text-vellum-mute">
            ✓ source-verified
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────── API table

function ApiTable() {
  const rows: [string, string, string][] = [
    ["POST",   "/v1/auth/nonce",                "Get a SIWE nonce (no auth)"],
    ["POST",   "/v1/auth/login",                "Verify SIWE message + signature → bearer token"],
    ["POST",   "/v1/auth/apikey",               "Issue a long-lived API key (sm_*) for the bound wallet"],
    ["POST",   "/v1/minds",                     "Create a Mind (mints iNFT, allocates engine)"],
    ["GET",    "/v1/minds",                     "List the caller's Minds"],
    ["POST",   "/v1/minds/:id/remember",        "Store an encrypted memory (TEE fact-extraction)"],
    ["POST",   "/v1/minds/:id/recall",          "Retrieve memories (TEE-attested RAG)"],
    ["POST",   "/v1/minds/:id/capabilities",    "Grant another wallet read access"],
    ["GET",    "/v1/minds/:id/capabilities",    "List active capabilities"],
    ["DELETE", "/v1/minds/:id/capabilities/:capId", "Revoke a capability (instant on chain)"],
    ["GET",    "/v1/minds/:id/audit",           "Read MemoryAccessLog entries"],
    ["GET",    "/v1/attestations/:hash",        "Lookup an attestation by hash"],
    ["POST",   "/v1/attestations/verify",       "Re-verify an attestation"],
    ["POST",   "/v1/inference/chat",            "Generic Qwen 2.5 7B in TDX chat. Auth required, rate-limited."],
  ];
  return (
    <div className="terminal-frame p-6 overflow-x-auto">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute mb-4">
        base · https://sealedmind-backend-production.up.railway.app
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute border-b border-vellum/10">
            <th className="py-2 pr-4">Method</th>
            <th className="py-2 pr-4">Path</th>
            <th className="py-2 pr-4">What</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([m, path, desc]) => (
            <tr key={path + m} className="border-b border-vellum/5">
              <td className={`py-2 pr-4 font-mono text-[11px] ${m === "POST" ? "text-seal" : m === "DELETE" ? "text-crimson" : "text-rune"}`}>
                {m}
              </td>
              <td className="py-2 pr-4 font-mono text-[12px] text-vellum break-all">{path}</td>
              <td className="py-2 pr-4 text-vellum-dim">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────────────────────────── Bits

function Section({
  title, eyebrow, children,
}: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="mt-20">
      <div className="eyebrow flex items-center gap-3 mb-3">
        <span className="inline-block w-8 h-px bg-seal" />
        {eyebrow}
      </div>
      <h2 className="font-display text-vellum text-[clamp(28px,3.5vw,48px)] leading-[1.05] mb-8">{title}</h2>
      {children}
    </section>
  );
}

function Card({
  title, tone, children,
}: { title: string; tone: "seal" | "rune"; children: React.ReactNode }) {
  const ring = tone === "seal" ? "hairline-seal" : "hairline-rune";
  return (
    <div className={`terminal-frame ${ring} p-8 space-y-6`}>
      <h3 className="font-display text-vellum text-[28px]">{title}</h3>
      {children}
    </div>
  );
}

function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <div className="relative">
      {lang && (
        <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute mb-1">
          {lang}
        </div>
      )}
      <pre className="font-mono text-[12px] text-vellum bg-ink-2 p-4 hairline overflow-x-auto whitespace-pre leading-[1.7]">
        {children}
      </pre>
    </div>
  );
}

function Mini({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1 hairline-seal text-seal">
      {children}
    </span>
  );
}

function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-block font-mono text-[11px] tracking-[0.18em] uppercase text-seal-deep hover:underline mt-2"
    >
      {children}
    </a>
  );
}

function Footer() {
  return (
    <div className="mt-24 grid md:grid-cols-3 gap-6 text-vellum-dim text-[13px] font-mono">
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute mb-2">source</div>
        <a className="hover:text-seal" href="https://github.com/SealedMind/SealedMindMonoRepo" target="_blank" rel="noreferrer">
          github.com/SealedMind/SealedMindMonoRepo
        </a>
      </div>
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute mb-2">long-form</div>
        <a className="hover:text-seal" href="https://github.com/SealedMind/SealedMindMonoRepo/blob/main/OVERVIEW.md" target="_blank" rel="noreferrer">
          OVERVIEW.md
        </a>
      </div>
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute mb-2">demo</div>
        <Link to="/demo" className="hover:text-seal">Live two-agent demo →</Link>
      </div>
    </div>
  );
}

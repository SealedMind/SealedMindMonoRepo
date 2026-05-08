import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { createPublicClient, http, type Address } from "viem";

/**
 * /access/:capId — landing page a recipient hits after the granter sends
 * them a share link. Reads the on-chain capability metadata directly,
 * confirms the connected wallet is the grantee, then offers the read flow.
 *
 * No backend dependency for the read itself — we go straight to the
 * chain via a public RPC. This works even if the SealedMind backend is
 * down: the recipient still sees the on-chain proof of the grant.
 */

const CAP_REGISTRY_ADDR = "0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66" as const; // testnet
const RPC_URL = "https://evmrpc-testnet.0g.ai";
const EXPLORER = "https://chainscan-galileo.0g.ai";

const CAP_ABI = [
  {
    name: "getCapability",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "capId", type: "bytes32" }],
    outputs: [
      { name: "mindId", type: "uint256" },
      { name: "shardName", type: "string" },
      { name: "grantee", type: "address" },
      { name: "readOnly", type: "bool" },
      { name: "expiry", type: "uint256" },
      { name: "revoked", type: "bool" },
      { name: "grantedAt", type: "uint256" },
    ],
  },
] as const;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

interface CapInfo {
  mindId: string;
  shardName: string;
  grantee: string;
  readOnly: boolean;
  expiry: number;       // unix seconds (0 = never)
  revoked: boolean;
  grantedAt: number;
}

type LoadState = "loading" | "ok" | "missing" | "error";

export default function Access() {
  const { capId } = useParams();
  const { address, isConnected } = useAccount();
  const [info, setInfo] = useState<CapInfo | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!capId) return;
    let cancelled = false;
    (async () => {
      try {
        const client = createPublicClient({ transport: http(RPC_URL) });
        const result = (await client.readContract({
          address: CAP_REGISTRY_ADDR as Address,
          abi: CAP_ABI,
          functionName: "getCapability",
          args: [capId as `0x${string}`],
        })) as readonly [bigint, string, Address, boolean, bigint, boolean, bigint];

        if (cancelled) return;
        const [mindId, shardName, grantee, readOnly, expiry, revoked, grantedAt] = result;

        // Empty capability returns mindId=0, grantee=0x0
        if (grantee.toLowerCase() === ZERO_ADDR) {
          setState("missing");
          return;
        }
        setInfo({
          mindId: mindId.toString(),
          shardName,
          grantee,
          readOnly,
          expiry: Number(expiry),
          revoked,
          grantedAt: Number(grantedAt),
        });
        setState("ok");
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e?.message ?? String(e));
          setState("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [capId]);

  // ── Loading ───────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <Wrap>
        <div className="font-mono text-[12px] text-vellum-mute uppercase tracking-[0.22em]">
          ▸ Resolving capability on chain…
        </div>
      </Wrap>
    );
  }

  // ── Missing capId ─────────────────────────────────────────────────
  if (state === "missing" || !info) {
    return (
      <Wrap eyebrow="404 / not found" title={<>This capability <span className="font-display-italic text-crimson">does not exist.</span></>}>
        <p className="text-vellum-dim text-[15px] leading-[1.7] max-w-[560px] mt-6">
          The capability id <code className="text-seal-deep">{capId}</code> isn't
          registered in our <code>CapabilityRegistry</code> on 0G testnet. The
          link may be malformed, or the capability was issued on a different
          network.
        </p>
        {errorMsg && (
          <div className="mt-6 hairline-rune p-4 font-mono text-[11px] text-crimson break-all">
            {errorMsg}
          </div>
        )}
      </Wrap>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <Wrap eyebrow="error" title={<>Couldn't read on-chain capability.</>}>
        <div className="hairline-rune p-4 font-mono text-[11px] text-crimson mt-6">
          {errorMsg}
        </div>
      </Wrap>
    );
  }

  // ── OK ────────────────────────────────────────────────────────────
  const expired = info.expiry !== 0 && Date.now() / 1000 >= info.expiry;
  const isRecipient =
    isConnected && address?.toLowerCase() === info.grantee.toLowerCase();

  return (
    <Wrap
      eyebrow="capability · shared with you"
      title={
        <>
          Read access to{" "}
          <span className="font-display-italic text-seal">{info.shardName}</span>
        </>
      }
    >
      <p className="text-vellum-dim text-[15px] leading-[1.7] max-w-[640px] mt-6">
        The owner of mind <code className="text-seal-deep">#{info.mindId}</code>{" "}
        granted you{" "}
        {info.readOnly ? "read-only" : "read-and-write"} access to the{" "}
        <code>{info.shardName}</code> shard. Every read goes through an on-chain
        verify against{" "}
        <a
          href={`${EXPLORER}/address/${CAP_REGISTRY_ADDR}`}
          target="_blank"
          rel="noreferrer"
          className="text-seal hover:underline"
        >
          CapabilityRegistry
        </a>
        . If the owner revokes, your next read fails immediately — no caching,
        no propagation delay.
      </p>

      {/* Capability card */}
      <div className="mt-10 terminal-frame hairline-seal p-6 max-w-[720px] space-y-3">
        <Row label="Capability id">
          <code className="text-seal-deep break-all">{capId}</code>
        </Row>
        <Row label="Mind id">{info.mindId}</Row>
        <Row label="Shard">{info.shardName}</Row>
        <Row label="Grantee (you)">
          <code className="break-all">{info.grantee}</code>
        </Row>
        <Row label="Permission">
          {info.readOnly ? "Read-only" : "Read & write"}
        </Row>
        <Row label="Granted at">
          {new Date(info.grantedAt * 1000).toLocaleString()}
        </Row>
        <Row label="Expires">
          {info.expiry === 0
            ? "Never (until revoked)"
            : new Date(info.expiry * 1000).toLocaleString()}
        </Row>
        <Row label="Status">
          {info.revoked ? (
            <span className="text-crimson">✗ Revoked on chain</span>
          ) : expired ? (
            <span className="text-ember">⏵ Expired</span>
          ) : (
            <span className="text-seal">✓ Valid</span>
          )}
        </Row>
      </div>

      {/* CTA / state-dependent block */}
      <div className="mt-10 max-w-[720px]">
        {info.revoked && (
          <Banner tone="crimson">
            This capability has been revoked by the owner. You can no longer
            access the data. Reach out to the owner if this was unexpected.
          </Banner>
        )}
        {!info.revoked && expired && (
          <Banner tone="ember">
            This capability has expired. Ask the owner to issue a new one.
          </Banner>
        )}
        {!info.revoked && !expired && !isConnected && (
          <div className="hairline-seal p-6">
            <p className="text-vellum text-[15px] leading-[1.6] mb-4">
              Connect the wallet that owns the grantee address{" "}
              <code className="text-seal-deep">
                {info.grantee.slice(0, 8)}…{info.grantee.slice(-4)}
              </code>
              {" "}to read the shared memories.
            </p>
            <ConnectButton showBalance={false} />
          </div>
        )}
        {!info.revoked && !expired && isConnected && !isRecipient && (
          <Banner tone="rune">
            You're connected as{" "}
            <code>
              {address?.slice(0, 8)}…{address?.slice(-4)}
            </code>{" "}
            but this capability was granted to{" "}
            <code>
              {info.grantee.slice(0, 8)}…{info.grantee.slice(-4)}
            </code>
            . Switch wallets to access.
          </Banner>
        )}
        {!info.revoked && !expired && isRecipient && (
          <div className="hairline-seal p-6 bg-seal/5">
            <p className="text-vellum text-[15px] leading-[1.6]">
              ✓ Verified on chain — you are the rightful grantee.
            </p>
            <p className="font-mono text-[11px] text-vellum-mute mt-3 leading-[1.6]">
              Recipient flow: paste this capability token into your agent (via
              the SealedMind SDK) and call <code>recall(mindId, ...)</code> with
              it. The backend verifies on-chain before returning data.
            </p>
            <pre className="mt-4 font-mono text-[12px] text-vellum bg-ink-2 p-4 hairline overflow-x-auto whitespace-pre">
{`import { SealedMind } from "@sealedmind/sdk";

const client = new SealedMind({ apiKey: "sm_..." });

const r = await client.recall("${info.mindId}", {
  query: "your question",
  shard: "${info.shardName}",
  capabilityToken: "${capId}",
});

console.log(r.answer);`}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-12 font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
        <Link to="/" className="hover:text-seal">← back to sealedmind</Link>
      </div>
    </Wrap>
  );
}

// ── helpers ────────────────────────────────────────────────────────

function Wrap({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1100px] px-8 py-16">
      {eyebrow && (
        <div className="eyebrow flex items-center gap-3">
          <span className="inline-block w-8 h-px bg-seal" />
          {eyebrow}
        </div>
      )}
      {title && (
        <h1 className="font-display mt-8 text-[clamp(40px,5vw,72px)] leading-[0.95] tracking-[-0.03em] text-vellum">
          {title}
        </h1>
      )}
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-vellum/5 pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute pt-1">
        {label}
      </span>
      <span className="font-mono text-[12px] text-vellum text-right max-w-[60%]">
        {children}
      </span>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "crimson" | "ember" | "rune";
  children: React.ReactNode;
}) {
  const cls =
    tone === "crimson" ? "hairline-rune text-crimson" :
    tone === "ember" ? "hairline-rune text-ember" :
    "hairline-rune text-rune-deep";
  return (
    <div className={`${cls} p-4 text-[14px] leading-[1.6]`}>{children}</div>
  );
}

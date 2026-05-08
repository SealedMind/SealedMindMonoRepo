import { useState } from "react";

/**
 * ShareModal — one-click capability grant flow.
 *
 * Used from /dashboard. Pops up, collects (recipient, shard, duration),
 * calls client.grantCapability, then shows the share link the user can
 * copy and send to the recipient.
 */
interface Props {
  mindId: string;
  shards: string[];
  client: any;          // SealedMind from @sealedmind/sdk
  onClose: () => void;
}

const DURATIONS = [
  { label: "7 days",  seconds: 7  * 24 * 3600 },
  { label: "30 days", seconds: 30 * 24 * 3600 },
  { label: "90 days", seconds: 90 * 24 * 3600 },
];

export default function ShareModal({ mindId, shards, client, onClose }: Props) {
  const [grantee, setGrantee] = useState("");
  const [shard, setShard] = useState(shards[0] ?? "general");
  const [duration, setDuration] = useState(DURATIONS[1].seconds);
  const [readOnly, setReadOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ capId: string; txHash?: string } | null>(null);
  const [copied, setCopied] = useState<"link" | "cap" | null>(null);

  const valid = /^0x[a-fA-F0-9]{40}$/.test(grantee.trim());

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await client.grantCapability(mindId, shard, grantee.trim(), {
        readOnly,
        expiry: Math.floor(Date.now() / 1000) + duration,
      });
      // SDK returns { capability: { capId, txHash, ... } } or the bare object
      const cap = (r as any)?.capability ?? r;
      setResult({ capId: cap.capId, txHash: cap.txHash });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, kind: "link" | "cap") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  const shareLink =
    result && typeof window !== "undefined"
      ? `${window.location.origin}/access/${result.capId}`
      : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-vellum/40 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="terminal-frame max-w-[560px] w-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {!result ? (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="eyebrow">Grant capability</div>
                <h2 className="font-display text-[28px] text-vellum mt-2 leading-tight">
                  Share <span className="font-display-italic text-seal">{shard}</span> shard
                </h2>
              </div>
              <button
                onClick={onClose}
                className="font-mono text-vellum-mute hover:text-vellum text-lg"
              >
                ✕
              </button>
            </div>

            {/* Recipient */}
            <div className="space-y-1 mb-5">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
                Recipient address
              </div>
              <input
                type="text"
                value={grantee}
                onChange={(e) => setGrantee(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 font-mono text-[13px] hairline bg-ink-2/70 text-vellum focus:hairline-seal focus:outline-none"
              />
              {grantee && !valid && (
                <div className="font-mono text-[11px] text-crimson mt-1">
                  not a valid 0x… address
                </div>
              )}
            </div>

            {/* Shard select */}
            {shards.length > 1 && (
              <div className="space-y-1 mb-5">
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
                  Shard
                </div>
                <select
                  value={shard}
                  onChange={(e) => setShard(e.target.value)}
                  className="w-full px-4 py-3 font-mono text-[13px] hairline bg-ink-2/70 text-vellum focus:hairline-seal focus:outline-none"
                >
                  {shards.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Duration radio */}
            <div className="mb-5">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute mb-2">
                Duration
              </div>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.seconds}
                    onClick={() => setDuration(d.seconds)}
                    className={`font-mono text-[11px] tracking-[0.18em] uppercase px-4 py-2 transition-colors ${
                      duration === d.seconds
                        ? "hairline-seal text-seal bg-seal/10"
                        : "hairline text-vellum-dim hover:hairline-seal hover:text-seal"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Permission */}
            <div className="mb-6">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute mb-2">
                Permission
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={readOnly}
                  onChange={(e) => setReadOnly(e.target.checked)}
                  className="w-4 h-4 accent-seal"
                />
                <span className="text-vellum text-[13px]">
                  Read-only{" "}
                  <span className="text-vellum-mute font-mono text-[11px]">
                    (recommended)
                  </span>
                </span>
              </label>
            </div>

            {/* On-chain note */}
            <div className="hairline-seal p-3 bg-seal/5 mb-6">
              <p className="font-mono text-[11px] text-vellum-dim leading-[1.6]">
                Issues an on-chain capability via{" "}
                <code className="text-seal-deep">CapabilityRegistry.grantCapability</code>.
                You can revoke any time. Approx. tx cost: <strong>~0.0002 0G</strong>.
              </p>
            </div>

            {error && (
              <div className="hairline-rune p-3 font-mono text-[11px] text-crimson mb-4">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="btn-ghost">Cancel</button>
              <button
                onClick={submit}
                disabled={!valid || busy}
                className={`btn-seal ${!valid || busy ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {busy ? "Signing…" : "Sign & Share"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="eyebrow text-seal">✓ Granted on chain</div>
                <h2 className="font-display text-[28px] text-vellum mt-2 leading-tight">
                  Send this to{" "}
                  <span className="font-display-italic text-seal">
                    {grantee.slice(0, 6)}…{grantee.slice(-4)}
                  </span>
                </h2>
              </div>
              <button
                onClick={onClose}
                className="font-mono text-vellum-mute hover:text-vellum text-lg"
              >
                ✕
              </button>
            </div>

            {/* Share link */}
            <div className="space-y-1 mb-5">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
                Share link
              </div>
              <div className="relative">
                <code className="block font-mono text-[12px] text-vellum bg-ink-2 px-4 py-3 hairline pr-20 break-all">
                  {shareLink}
                </code>
                <button
                  onClick={() => copy(shareLink, "link")}
                  className="absolute top-3 right-3 font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1 hairline-seal text-seal hover:bg-seal hover:text-white transition-colors"
                >
                  {copied === "link" ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Capability token */}
            <div className="space-y-1 mb-5">
              <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
                Capability token
              </div>
              <div className="relative">
                <code className="block font-mono text-[11px] text-vellum-dim bg-ink-2 px-4 py-3 hairline pr-20 break-all">
                  {result.capId}
                </code>
                <button
                  onClick={() => copy(result.capId, "cap")}
                  className="absolute top-3 right-3 font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-1 hairline text-vellum-dim hover:hairline-seal hover:text-seal transition-colors"
                >
                  {copied === "cap" ? "✓" : "Copy"}
                </button>
              </div>
            </div>

            {/* Tx + expiry meta */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6 font-mono text-[11px] text-vellum-mute">
              <span>
                expires:{" "}
                <span className="text-vellum-dim">
                  in {Math.round(duration / (24 * 3600))} days
                </span>
              </span>
              {result.txHash && (
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${result.txHash.startsWith("0x") ? result.txHash : "0x" + result.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-seal-deep hover:underline"
                >
                  ↳ view grant tx on chainscan
                </a>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={onClose} className="btn-seal">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

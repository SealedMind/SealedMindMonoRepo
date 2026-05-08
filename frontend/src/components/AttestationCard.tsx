import { useState } from "react";

/**
 * AttestationCard — full TEE attestation receipt with a "Verify Proof"
 * action. Drop into any place that displays a model response, including
 * /demo agent replies, /chat recall results, and /developer testing.
 *
 * Calls the deployed backend's POST /v1/attestations/verify to
 * independently re-verify the chatId against the attestation store. No
 * auth required for the verify endpoint.
 */

const VERIFY_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "https://sealedmind-backend-production.up.railway.app";

type VerifyState = "idle" | "verifying" | "valid" | "invalid" | "error";

interface Props {
  chatId?: string;
  enclave?: string;
  storageCID?: string;
  attestationValid?: boolean;
  /** Compact mode for inline placement in chat bubbles */
  compact?: boolean;
}

export default function AttestationCard({
  chatId,
  enclave = "Intel TDX",
  storageCID,
  attestationValid,
  compact = false,
}: Props) {
  const [verifyState, setVerifyState] = useState<VerifyState>("idle");
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!chatId) return null;

  async function handleVerify() {
    if (!chatId) return;
    setVerifyState("verifying");
    setVerifyMsg(null);
    try {
      const r = await fetch(`${VERIFY_URL}/v1/attestations/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: chatId }),
      });
      const data = await r.json();
      if (data.verified) {
        setVerifyState("valid");
        setVerifyMsg("On-chain re-verified · attestation chain intact");
      } else {
        setVerifyState("invalid");
        setVerifyMsg(data.reason ?? "Attestation could not be re-verified");
      }
    } catch (e) {
      setVerifyState("error");
      setVerifyMsg((e as Error).message);
    }
  }

  function handleCopy() {
    if (!chatId) return;
    navigator.clipboard.writeText(chatId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  // ── rendering bits ──────────────────────────────────────────────
  const dotColor =
    verifyState === "valid" ? "bg-seal anim-pulse-seal" :
    verifyState === "invalid" ? "bg-crimson" :
    verifyState === "error" ? "bg-ember" :
    attestationValid ? "bg-seal" : "bg-vellum-mute";

  const verifyButtonLabel =
    verifyState === "verifying" ? "Verifying…" :
    verifyState === "valid" ? "Verified ✓" :
    verifyState === "invalid" ? "Not verified" :
    verifyState === "error" ? "Retry" :
    "Verify Proof";

  const verifyButtonClass =
    verifyState === "valid"
      ? "text-seal hover:bg-seal hover:text-white"
      : verifyState === "invalid"
      ? "text-crimson"
      : "text-vellum-dim hover:text-seal";

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1 hairline-seal font-mono text-[10px] text-seal">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />
        TEE attested · {enclave}
        {chatId && (
          <span className="text-vellum-mute"> · {chatId.slice(0, 8)}…</span>
        )}
        <button
          onClick={handleVerify}
          disabled={verifyState === "verifying"}
          className={`ml-1 underline-offset-2 hover:underline ${verifyButtonClass}`}
        >
          [{verifyButtonLabel}]
        </button>
      </div>
    );
  }

  return (
    <div className="terminal-frame hairline-seal p-4 mt-3 max-w-[560px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
          <div>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal">
              TEE attested · {enclave}
            </div>
            <div className="font-mono text-[11px] text-vellum-dim mt-1">
              chatId:{" "}
              <button
                onClick={handleCopy}
                className="text-vellum hover:text-seal underline-offset-2 hover:underline"
              >
                {chatId.slice(0, 12)}…{chatId.slice(-6)} {copied && "✓ copied"}
              </button>
            </div>
            {storageCID && (
              <div className="font-mono text-[11px] text-vellum-dim mt-1">
                storage:{" "}
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${storageCID.startsWith("0x") ? storageCID : "0x" + storageCID}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-vellum hover:text-seal underline-offset-2 hover:underline"
                >
                  {storageCID.slice(0, 12)}…
                </a>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleVerify}
          disabled={verifyState === "verifying"}
          className={`font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2 hairline-seal whitespace-nowrap transition-colors ${verifyButtonClass} ${
            verifyState === "verifying" ? "opacity-60" : ""
          }`}
        >
          {verifyButtonLabel}
        </button>
      </div>
      {verifyMsg && (
        <div
          className={`mt-3 font-mono text-[11px] leading-[1.5] ${
            verifyState === "valid"
              ? "text-seal-deep"
              : verifyState === "invalid"
              ? "text-crimson"
              : "text-ember"
          }`}
        >
          → {verifyMsg}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import MindSeal from "./MindSeal";

/**
 * AttestationBadge — TEE attestation receipt.
 * Larger, breathing layout with copy-on-click for the chat ID.
 */
interface Props {
  verified?: boolean;
  chatId?: string;
  enclave?: string;
  className?: string;
}

export default function AttestationBadge({
  verified = true,
  chatId,
  enclave = "Intel TDX",
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!chatId) return;
    navigator.clipboard.writeText(chatId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 hairline-seal bg-ink-2/70 min-w-[280px] ${className}`}
      style={{ borderRadius: 0 }}
    >
      <MindSeal size={32} variant={verified ? "seal" : "rune"} />
      <div className="flex flex-col leading-snug min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">
            TEE Attestation
          </span>
          <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-vellum-mute">
            {enclave}
          </span>
        </div>
        <div className="font-mono text-[12px] text-seal flex items-center gap-2 mt-1">
          {verified ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-seal anim-pulse-seal" />
              Verified
            </>
          ) : (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-ember" />
              Pending
            </>
          )}
        </div>
        {chatId && (
          <button
            onClick={copy}
            title="Click to copy"
            className="mt-1 font-mono text-[10px] text-vellum-mute hover:text-seal text-left transition-colors truncate"
          >
            {copied ? "✓ copied" : `${chatId.slice(0, 12)}…${chatId.slice(-6)}`}
          </button>
        )}
      </div>
    </div>
  );
}

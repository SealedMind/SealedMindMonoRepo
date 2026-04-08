import MindSeal from "./MindSeal";

/**
 * AttestationBadge — small inline TEE attestation indicator.
 * Shows a tiny rotating Mind Seal + verified text + chat ID.
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
  return (
    <div
      className={`inline-flex items-center gap-3 px-3 py-2 hairline-seal bg-ink-2/60 ${className}`}
      style={{ borderRadius: 0 }}
    >
      <MindSeal size={22} variant={verified ? "seal" : "rune"} />
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-vellum-mute">
          TEE Attestation
        </span>
        <span className="font-mono text-[10px] text-seal flex items-center gap-1.5">
          {verified ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-seal anim-pulse-seal" />
              Verified · {enclave}
            </>
          ) : (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-ember" />
              Pending
            </>
          )}
        </span>
        {chatId && (
          <span className="font-mono text-[9px] text-vellum-mute mt-0.5 truncate max-w-[160px]">
            {chatId}
          </span>
        )}
      </div>
    </div>
  );
}

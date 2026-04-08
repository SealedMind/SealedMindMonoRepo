import { useState } from "react";

/**
 * CIDChip — readable, copyable 0G Storage CID badge.
 */
interface Props {
  cid: string;
  index?: number;
}

export default function CIDChip({ cid, index }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(cid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      onClick={copy}
      title={`Click to copy · ${cid}`}
      className="group flex items-center gap-3 px-4 py-3 hairline bg-ink-2/70 hover:hairline-seal hover:bg-ink-2 transition-all"
    >
      <div className="flex flex-col items-start leading-snug">
        <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">
          0G Storage CID {index !== undefined ? `· #${index + 1}` : ""}
        </span>
        <span className="font-mono text-[12px] text-seal mt-1 group-hover:glow-text-seal">
          {cid.slice(0, 10)}…{cid.slice(-8)}
        </span>
      </div>
      <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-vellum-mute group-hover:text-seal">
        {copied ? "✓" : "copy"}
      </span>
    </button>
  );
}

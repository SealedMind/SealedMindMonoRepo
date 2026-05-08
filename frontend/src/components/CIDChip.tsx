import { useState } from "react";

/**
 * CIDChip — readable, copyable, clickable 0G Storage CID badge.
 *
 * Click body  → copy
 * Click "view"→ open chainscan tx for the rootHash
 */
interface Props {
  cid: string;
  index?: number;
}

const EXPLORER = "https://chainscan-galileo.0g.ai";

export default function CIDChip({ cid, index }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const explorerUrl = `${EXPLORER}/tx/${cid.startsWith("0x") ? cid : "0x" + cid}`;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hairline bg-ink-2/70 hover:hairline-seal hover:bg-ink-2 transition-all">
      <div className="flex flex-col items-start leading-snug flex-1 min-w-0">
        <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-vellum-mute">
          0G Storage CID {index !== undefined ? `· #${index + 1}` : ""}
        </span>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[12px] text-seal mt-1 group-hover:glow-text-seal hover:underline underline-offset-2"
          title="Open on chainscan-galileo"
        >
          {cid.slice(0, 10)}…{cid.slice(-8)}
        </a>
      </div>
      <button
        onClick={copy}
        className="font-mono text-[9px] tracking-[0.18em] uppercase text-vellum-mute hover:text-seal px-2"
        title="Copy CID"
      >
        {copied ? "✓" : "copy"}
      </button>
    </div>
  );
}

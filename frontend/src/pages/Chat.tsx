import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import AttestationBadge from "../components/AttestationBadge";
import MindSeal from "../components/MindSeal";

type Turn = {
  id: string;
  role: "user" | "mind";
  content: string;
  attestation?: { chatId: string; verified: boolean; enclave: string };
  storageCIDs?: string[];
  retrieved?: number;
  mode?: "remember" | "recall";
};

export default function Chat() {
  const { id } = useParams();
  const { isAuthenticated, client } = useAuth();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"recall" | "remember">("recall");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  if (!isAuthenticated || !id) {
    return (
      <div className="mx-auto max-w-[1440px] px-8 py-32">
        <p className="font-mono text-[12px] text-vellum-mute uppercase tracking-[0.22em]">
          ▸ Authenticate from the{" "}
          <Link to="/dashboard" className="text-seal underline">
            dashboard
          </Link>{" "}
          first.
        </p>
      </div>
    );
  }

  const send = async () => {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setBusy(true);

    const userTurn: Turn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      mode,
    };
    setTurns((t) => [...t, userTurn]);

    try {
      if (mode === "remember") {
        const result = await client.remember(id, { content: text });
        setTurns((t) => [
          ...t,
          {
            id: `m-${Date.now()}`,
            role: "mind",
            content: `Sealed ${result.memories?.length ?? 0} ${
              result.memories?.length === 1 ? "memory" : "memories"
            }. ${
              result.memories?.[0]?.content
                ? `Extracted: "${result.memories[0].content}"`
                : ""
            }`,
            attestation: result.attestation,
            storageCIDs: result.memories?.map((m) => m.storageCID) || [],
            mode: "remember",
          },
        ]);
      } else {
        const result = await client.recall(id, { query: text, topK: 5 });
        setTurns((t) => [
          ...t,
          {
            id: `m-${Date.now()}`,
            role: "mind",
            content: result.answer || "(no answer returned)",
            attestation: result.attestation,
            retrieved: result.memories?.length ?? 0,
            mode: "recall",
          },
        ]);
      }
    } catch (err: any) {
      setTurns((t) => [
        ...t,
        {
          id: `e-${Date.now()}`,
          role: "mind",
          content: `// error · ${err?.message || "request failed"}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-12">
      {/* Top header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="eyebrow flex items-center gap-3">
            <span className="inline-block w-8 h-px bg-seal" />
            Mind · {id}
          </div>
          <h1 className="font-display mt-4 text-[64px] leading-none tracking-tight text-vellum">
            Console
          </h1>
        </div>
        <Link
          to="/dashboard"
          className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute hover:text-seal transition-colors"
        >
          ← Back to vault
        </Link>
      </div>

      {/* Terminal frame */}
      <div className="terminal-frame">
        {/* Chrome bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-vellum/10 bg-ink/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-crimson" />
            <span className="w-2.5 h-2.5 rounded-full bg-ember" />
            <span className="w-2.5 h-2.5 rounded-full bg-seal" />
          </div>
          <div className="flex items-center gap-3">
            <MindSeal size={18} />
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
              sealedmind ▸ {id} ▸ {mode}
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-seal flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-seal rounded-full anim-pulse-seal" />
            TEE live
          </span>
        </div>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="h-[60vh] overflow-y-auto p-8 space-y-6 font-mono text-[13px] leading-[1.7]"
        >
          {turns.length === 0 && (
            <div className="text-vellum-mute">
              <div className="mb-2">$ welcome to sealedmind console</div>
              <div className="mb-2">
                $ all I/O routes through Intel TDX + NVIDIA H100 enclave
              </div>
              <div className="mb-2">
                $ choose mode below — <span className="text-seal">recall</span>{" "}
                queries existing memories,{" "}
                <span className="text-rune">remember</span> stores new ones
              </div>
              <div className="mt-6 text-vellum-mute">
                <span className="anim-blink inline-block w-[8px] h-[14px] bg-seal align-middle" />
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="fade-up">
              {turn.role === "user" ? (
                <div>
                  <span className="text-vellum-mute">
                    $ {turn.mode === "remember" ? "remember" : "recall"} ▸{" "}
                  </span>
                  <span className="text-vellum">{turn.content}</span>
                </div>
              ) : (
                <div className="border-l border-seal/40 pl-4 py-1">
                  <div
                    className={`text-[11px] tracking-[0.18em] uppercase mb-2 ${
                      turn.mode === "remember" ? "text-rune" : "text-seal"
                    }`}
                  >
                    ⬡ Mind response
                  </div>
                  <div className="text-vellum text-[14px] leading-[1.7] font-sans">
                    {turn.content}
                  </div>

                  {/* Receipt */}
                  {(turn.attestation || turn.storageCIDs?.length || turn.retrieved !== undefined) && (
                    <div className="mt-4 flex flex-wrap items-start gap-3">
                      {turn.attestation && (
                        <AttestationBadge
                          verified={turn.attestation.verified}
                          chatId={turn.attestation.chatId}
                          enclave={turn.attestation.enclave}
                        />
                      )}
                      {turn.retrieved !== undefined && (
                        <div className="px-3 py-2 hairline bg-ink-2/60 font-mono text-[10px]">
                          <div className="text-vellum-mute uppercase tracking-[0.2em]">
                            Retrieved
                          </div>
                          <div className="text-vellum mt-0.5">
                            {turn.retrieved} memor
                            {turn.retrieved === 1 ? "y" : "ies"}
                          </div>
                        </div>
                      )}
                      {turn.storageCIDs?.slice(0, 2).map((cid, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 hairline bg-ink-2/60 font-mono text-[10px]"
                        >
                          <div className="text-vellum-mute uppercase tracking-[0.2em]">
                            0G CID
                          </div>
                          <div className="text-seal mt-0.5">
                            {cid.slice(0, 10)}…{cid.slice(-6)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="text-vellum-mute fade-up">
              <span className="anim-blink inline-block w-[8px] h-[14px] bg-seal align-middle mr-2" />
              {mode === "remember" ? "sealing in TEE…" : "querying inside enclave…"}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-vellum/10 bg-ink/60 p-5">
          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex hairline">
              {(["recall", "remember"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
                    mode === m
                      ? m === "recall"
                        ? "bg-seal text-ink"
                        : "bg-rune text-ink"
                      : "text-vellum-mute hover:text-vellum"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={
                mode === "recall"
                  ? "ask the Mind anything…"
                  : "tell the Mind to remember…"
              }
              disabled={busy}
              className="flex-1 bg-transparent border-none outline-none font-mono text-[13px] text-vellum placeholder:text-vellum-mute"
            />

            <button
              onClick={send}
              disabled={busy || !input.trim()}
              className="px-5 py-2 font-mono text-[10px] tracking-[0.22em] uppercase bg-vellum text-ink hover:bg-seal transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {busy ? "…" : "Send ↵"}
            </button>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-6 grid grid-cols-3 gap-6 font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute">
        <div>
          <div className="text-seal">⬡ Sealed Inference</div>
          <div className="mt-1">Qwen 2.5 7B · Intel TDX</div>
        </div>
        <div>
          <div className="text-seal">⬡ Embedding</div>
          <div className="mt-1">all-MiniLM-L6-v2 · 384d</div>
        </div>
        <div>
          <div className="text-seal">⬡ Storage</div>
          <div className="mt-1">0G Storage · AES-256-GCM</div>
        </div>
      </div>
    </div>
  );
}

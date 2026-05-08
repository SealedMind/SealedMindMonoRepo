import { useEffect, useRef, useState } from "react";
import {
  getState,
  patientChat,
  doctorChat,
  reset,
  openEventStream,
  type AgentEvent,
  type DemoState,
} from "../lib/agentBridge";
import AttestationCard from "../components/AttestationCard";

type Speaker = "user" | "agent";
type AgentSide = "patient" | "doctor";

interface ChatTurn {
  id: string;
  side: AgentSide;
  speaker: Speaker;
  text: string;
  ts: number;
  attestation?: { chatId?: string; valid?: boolean; enclave?: string };
}

export default function Demo() {
  const [state, setState] = useState<DemoState | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [patientInput, setPatientInput] = useState("");
  const [doctorInput, setDoctorInput] = useState("");
  const [patientBusy, setPatientBusy] = useState(false);
  const [doctorBusy, setDoctorBusy] = useState(false);
  const [bridgeUp, setBridgeUp] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Bootstrap ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getState();
        if (!cancelled) {
          setState(s);
          setBridgeUp(true);
        }
      } catch (e) {
        if (!cancelled) {
          setBridgeUp(false);
          setError((e as Error).message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Live event stream ──────────────────────────────────────────
  useEffect(() => {
    if (!bridgeUp) return;
    const close = openEventStream(
      (e) => setEvents((prev) => [...prev, e].slice(-200)),
      () => {
        /* ignore — surface via state if needed */
      }
    );
    return close;
  }, [bridgeUp]);

  // ── Sending messages ───────────────────────────────────────────
  async function sendPatient() {
    if (!patientInput.trim() || patientBusy) return;
    const msg = patientInput.trim();
    setPatientInput("");
    const tid = crypto.randomUUID();
    setTurns((t) => [
      ...t,
      { id: tid + "-u", side: "patient", speaker: "user", text: msg, ts: Date.now() },
    ]);
    setPatientBusy(true);
    setError(null);
    try {
      const r = await patientChat(msg);
      setTurns((t) => [
        ...t,
        { id: tid + "-a", side: "patient", speaker: "agent", text: r.reply, ts: Date.now() },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPatientBusy(false);
    }
  }

  async function sendDoctor() {
    if (!doctorInput.trim() || doctorBusy) return;
    const msg = doctorInput.trim();
    setDoctorInput("");
    const tid = crypto.randomUUID();
    setTurns((t) => [
      ...t,
      { id: tid + "-u", side: "doctor", speaker: "user", text: msg, ts: Date.now() },
    ]);
    setDoctorBusy(true);
    setError(null);
    try {
      const r = await doctorChat(msg);
      const att = (r.metadata?.chatId as string | undefined)
        ? {
            chatId: r.metadata?.chatId as string,
            valid: r.metadata?.attestationValid as boolean,
            enclave: (r.metadata?.enclave as string) ?? "Intel TDX",
          }
        : undefined;
      setTurns((t) => [
        ...t,
        {
          id: tid + "-a",
          side: "doctor",
          speaker: "agent",
          text: r.reply,
          ts: Date.now(),
          attestation: att,
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDoctorBusy(false);
    }
  }

  async function onReset() {
    await reset();
    setTurns([]);
    setEvents([]);
    const s = await getState();
    setState(s);
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="relative mx-auto max-w-[1440px] px-8 py-12">
      <Header state={state} onReset={onReset} bridgeUp={bridgeUp} />

      {error && (
        <div className="mb-6 hairline-rune p-4 font-mono text-[12px] text-rune-deep">
          {error}
        </div>
      )}

      {bridgeUp === false && <BridgeDown />}

      {bridgeUp && state && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChatPanel
            tone="seal"
            agent="patient"
            label="Aria"
            sublabel="Alice's personal assistant"
            brain={state.patient.brain}
            turns={turns.filter((t) => t.side === "patient")}
            input={patientInput}
            onInput={setPatientInput}
            onSend={sendPatient}
            busy={patientBusy}
            placeholder="Type as Alice — e.g. 'Just ran 8km in 45 min'"
          />
          <ChatPanel
            tone="rune"
            agent="doctor"
            label="Dr. Chen's Assistant"
            sublabel="Clinical AI"
            brain={state.doctor.brain}
            turns={turns.filter((t) => t.side === "doctor")}
            input={doctorInput}
            onInput={setDoctorInput}
            onSend={sendDoctor}
            busy={doctorBusy}
            placeholder="Type as Dr. Chen — e.g. 'What's the patient's recent activity?'"
          />
        </div>
      )}

      {bridgeUp && state && (
        <EventFeed events={events} explorerBase={state.explorer_base} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────── Header

function Header({
  state, onReset, bridgeUp,
}: { state: DemoState | null; onReset: () => void; bridgeUp: boolean | null }) {
  return (
    <header className="mb-8">
      <div className="eyebrow flex items-center gap-3">
        <span className="inline-block w-8 h-px bg-seal" />
        Live demo · two LangGraph agents · 0G testnet
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <h1 className="font-display text-vellum text-[clamp(40px,5vw,72px)] leading-[0.95] tracking-[-0.03em]">
          Two agents,{" "}
          <span className="font-display-italic text-seal">one sealed memory</span>.
        </h1>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                bridgeUp === true
                  ? "bg-seal anim-pulse-seal"
                  : bridgeUp === false
                  ? "bg-crimson"
                  : "bg-vellum-mute"
              }`}
            />
            bridge {bridgeUp === true ? "live" : bridgeUp === false ? "down" : "…"}
          </span>
          <button onClick={onReset} className="btn-ghost">
            Reset
          </button>
        </div>
      </div>
      {state && (
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[10px] tracking-[0.18em] uppercase text-vellum-mute">
          <span>shard: <span className="text-vellum-dim">{state.shard}</span></span>
          <span>mind tokenId: <span className="text-vellum-dim">{state.mind_id}</span></span>
          <span>doctor: <span className="text-vellum-dim">{shortAddr(state.doctor_address)}</span></span>
          <a
            href={`${state.explorer_base}/address/${state.capability_registry}`}
            target="_blank" rel="noreferrer"
            className="hover:text-seal transition-colors underline-offset-4 hover:underline"
          >
            ↳ CapabilityRegistry on chain
          </a>
        </div>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────── Bridge down

function BridgeDown() {
  return (
    <div className="terminal-frame p-8">
      <div className="font-mono text-[12px] text-vellum-dim leading-[1.7]">
        <div className="text-crimson font-bold mb-2">Agent bridge unreachable.</div>
        <div>Start it on the demo machine:</div>
        <pre className="mt-3 p-3 bg-ink-2 hairline overflow-x-auto whitespace-pre">
{`cd evermemos-sealedmind
PYTHONPATH=. \\
SEALEDMIND_PRIVATE_KEY=0x... \\
DOCTOR_ADDRESS=0x... \\
PATIENT_MIND_ID=0 \\
ZEROG_STREAM_ID=<from .0g_secrets> \\
SEALEDMIND_BACKUP_KEY=<from .0g_secrets> \\
.venv/bin/python examples/agent_server.py`}
        </pre>
        <div className="mt-3 text-vellum-mute">
          Then refresh this page. Override the URL with{" "}
          <code className="text-seal">VITE_AGENT_BRIDGE_URL</code> if needed.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────── Chat panel

function ChatPanel({
  tone, label, sublabel, brain, turns, input, onInput, onSend, busy, placeholder,
}: {
  tone: "seal" | "rune";
  agent: AgentSide;
  label: string;
  sublabel: string;
  brain: string;
  turns: ChatTurn[];
  input: string;
  onInput: (s: string) => void;
  onSend: () => void;
  busy: boolean;
  placeholder: string;
}) {
  const accent = tone === "seal" ? "text-seal" : "text-rune";
  const hairline = tone === "seal" ? "hairline-seal" : "hairline-rune";
  const glow = tone === "seal" ? "glow-seal" : "glow-rune";
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  return (
    <div className={`terminal-frame ${hairline} ${glow} flex flex-col h-[640px]`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-vellum/5 flex items-start justify-between">
        <div>
          <div className="font-display text-[22px] text-vellum">{label}</div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-vellum-mute mt-1">
            {sublabel}
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-[9px] tracking-[0.22em] uppercase ${accent}`}>brain</div>
          <div className="font-mono text-[10px] text-vellum-dim mt-1 max-w-[260px] text-balance">
            {brain}
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {turns.length === 0 && (
          <div className="font-mono text-[12px] text-vellum-mute italic">
            (no messages yet — type below)
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className={t.speaker === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[88%] ${t.speaker === "user" ? "text-right" : ""}`}>
              <div className={`font-mono text-[9px] tracking-[0.22em] uppercase mb-1 ${
                t.speaker === "user" ? "text-vellum-mute" : accent
              }`}>
                {t.speaker === "user" ? speakerLabel(t) : label}
              </div>
              <div className={`whitespace-pre-wrap leading-[1.6] text-[14px] ${
                t.speaker === "user"
                  ? "text-vellum-dim font-mono"
                  : "text-vellum"
              }`}>
                {t.text}
              </div>
              {t.attestation && (
                <div className="mt-2">
                  <AttestationCard
                    chatId={t.attestation.chatId}
                    enclave={t.attestation.enclave}
                    attestationValid={t.attestation.valid}
                    compact
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 font-mono text-[11px] text-vellum-mute">
            <Spinner color={tone} />
            thinking…
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="border-t border-vellum/5 p-4 flex items-center gap-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
          className="flex-1 bg-transparent font-mono text-[13px] text-vellum placeholder:text-vellum-mute focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className={`btn-seal ${busy ? "opacity-40 cursor-not-allowed" : ""}`}
          style={tone === "rune" ? {
            background: "var(--color-rune)",
            boxShadow: "0 0 0 1px var(--color-rune), 0 0 20px -4px var(--color-rune-glow)",
          } : undefined}
        >
          Send
        </button>
      </form>
    </div>
  );
}

function speakerLabel(t: ChatTurn): string {
  return t.side === "patient" ? "Alice" : "Dr. Chen";
}

function Spinner({ color }: { color: "seal" | "rune" }) {
  return (
    <span className={`inline-block w-3 h-3 rounded-full border-2 border-${color} border-t-transparent animate-spin`} />
  );
}

// ─────────────────────────────────────────────────── Event feed

function EventFeed({ events, explorerBase }: { events: AgentEvent[]; explorerBase: string }) {
  return (
    <div className="mt-8">
      <div className="eyebrow flex items-center gap-3 mb-4">
        <span className="inline-block w-8 h-px bg-seal" />
        Chain &amp; storage activity (live)
      </div>
      <div className="terminal-frame p-5 max-h-[300px] overflow-y-auto font-mono text-[11px] leading-[1.8] space-y-1">
        {events.length === 0 && (
          <div className="text-vellum-mute italic">
            (no events yet — events stream here as the agents act)
          </div>
        )}
        {[...events].reverse().map((e) => (
          <EventLine key={e.id} e={e} explorerBase={explorerBase} />
        ))}
      </div>
    </div>
  );
}

function EventLine({ e, explorerBase }: { e: AgentEvent; explorerBase: string }) {
  const t = new Date(e.ts * 1000).toLocaleTimeString();
  const p = e.payload as Record<string, string | number>;
  const tx = (p.tx as string)?.replace(/^0x/, "");

  switch (e.kind) {
    case "storage_write":
      return (
        <div className="flex gap-3">
          <span className="text-vellum-mute">{t}</span>
          <span className="text-rune">[storage]</span>
          <span>encrypted → 0G testnet · key {String(p.key).slice(0, 32)}…</span>
        </div>
      );
    case "storage_read":
      return (
        <div className="flex gap-3">
          <span className="text-vellum-mute">{t}</span>
          <span className="text-rune">[storage]</span>
          <span>decrypted ← 0G testnet · key {String(p.key).slice(0, 32)}…</span>
        </div>
      );
    case "capability_granted":
      return (
        <div className="flex gap-3">
          <span className="text-vellum-mute">{t}</span>
          <span className="text-seal-deep">[chain]</span>
          <span>
            grant tx{" "}
            <a
              href={`${explorerBase}/tx/0x${tx}`}
              target="_blank"
              rel="noreferrer"
              className="text-seal hover:underline"
            >
              0x{tx?.slice(0, 12)}…
            </a>{" "}
            · cap {String(p.token).slice(0, 16)}…
          </span>
        </div>
      );
    case "capability_revoked":
      return (
        <div className="flex gap-3">
          <span className="text-vellum-mute">{t}</span>
          <span className="text-crimson">[chain]</span>
          <span>
            revoke tx{" "}
            <a
              href={`${explorerBase}/tx/0x${tx}`}
              target="_blank"
              rel="noreferrer"
              className="text-crimson hover:underline"
            >
              0x{tx?.slice(0, 12)}…
            </a>
          </span>
        </div>
      );
    case "capability_verified":
      return (
        <div className="flex gap-3">
          <span className="text-vellum-mute">{t}</span>
          <span className="text-seal-deep">[chain]</span>
          <span>verifyCapability(...) → ✓ valid</span>
        </div>
      );
    case "capability_denied":
      return (
        <div className="flex gap-3">
          <span className="text-vellum-mute">{t}</span>
          <span className="text-crimson">[chain]</span>
          <span>verifyCapability(...) → ✗ {String(p.error)}</span>
        </div>
      );
    case "tool_call":
      return (
        <div className="flex gap-3 text-vellum-mute">
          <span>{t}</span>
          <span>[{String(p.agent)}]</span>
          <span>tool: {String(p.tool)}(…)</span>
        </div>
      );
    case "tool_result":
      return null;
    default:
      return (
        <div className="text-vellum-mute">
          {t} {e.kind}
        </div>
      );
  }
}

function shortAddr(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/**
 * Tiny client for the evermemos-sealedmind agent FastAPI bridge
 * (examples/agent_server.py).
 *
 * Override the base URL via VITE_AGENT_BRIDGE_URL when building.
 */

const BRIDGE_BASE =
  (import.meta.env.VITE_AGENT_BRIDGE_URL as string | undefined) ??
  "http://127.0.0.1:8765";

export interface DemoState {
  patient: { name: string; subtitle: string; brain: string };
  doctor: { name: string; subtitle: string; brain: string };
  shard: string;
  mind_id: number;
  doctor_address: string;
  explorer_base: string;
  capability_registry: string;
  last_capability: string | null;
  last_storage_key: string | null;
}

export interface ChatResponse {
  reply: string;
  metadata: Record<string, unknown>;
  last_capability: string | null;
  last_storage_key: string | null;
}

export type AgentEventKind =
  | "tool_call"
  | "tool_result"
  | "storage_write"
  | "storage_read"
  | "capability_granted"
  | "capability_revoked"
  | "capability_verified"
  | "capability_denied";

export interface AgentEvent {
  kind: AgentEventKind;
  payload: Record<string, unknown>;
  ts: number;
  id: string;
}

export async function getState(): Promise<DemoState> {
  const r = await fetch(`${BRIDGE_BASE}/api/state`);
  if (!r.ok) throw new Error(`/api/state ${r.status}`);
  return r.json();
}

export async function patientChat(message: string): Promise<ChatResponse> {
  const r = await fetch(`${BRIDGE_BASE}/api/patient/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!r.ok) throw new Error(`patient chat ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function doctorChat(message: string): Promise<ChatResponse> {
  const r = await fetch(`${BRIDGE_BASE}/api/doctor/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!r.ok) throw new Error(`doctor chat ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function reset(): Promise<void> {
  await fetch(`${BRIDGE_BASE}/api/reset`, { method: "POST" });
}

export function openEventStream(
  onEvent: (e: AgentEvent) => void,
  onError?: (err: Event) => void
): () => void {
  const wsBase = BRIDGE_BASE.replace(/^http/, "ws");
  const ws = new WebSocket(`${wsBase}/ws/events`);
  ws.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data));
    } catch {
      /* ignore */
    }
  };
  if (onError) ws.onerror = onError;
  return () => ws.close();
}

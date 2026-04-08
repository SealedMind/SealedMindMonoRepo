import { SealedMind } from "@sealedmind/sdk";

/** Singleton SealedMind SDK client. */
export const client = new SealedMind({
  apiUrl: import.meta.env.VITE_API_URL || "",
});

const SESSION_KEY = "sealedmind:session";

export function loadSession(): { token: string; address: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    client.setSession(session);
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: { token: string; address: string }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  client.setSession(session);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  client.logout();
}

import { SealedMind } from "@sealedmind/sdk";
import { loadConfig } from "../commands/login.js";

let cached: SealedMind | null = null;
let cachedMindId: string | null = null;

export function getClient(): SealedMind {
  if (cached) return cached;

  const cfg = loadConfig();

  const apiUrl  = process.env.SEALEDMIND_API_URL ?? cfg?.host    ?? "http://localhost:4000";
  const token   = process.env.SEALEDMIND_SESSION  ?? cfg?.apiKey  ?? cfg?.token;
  const address = process.env.SEALEDMIND_ADDRESS  ?? cfg?.address ?? "0x0000000000000000000000000000000000000000";

  if (!token) {
    process.stderr.write(
      "error: not authenticated.\n" +
      "  Run: sealedmind login\n" +
      "  Or set SEALEDMIND_SESSION env var.\n"
    );
    process.exit(2);
  }

  cached = new SealedMind({ apiUrl });
  cached.setSession({ token, address });
  cachedMindId = process.env.SEALEDMIND_MIND_ID ?? cfg?.mindId ?? address.toLowerCase();
  return cached;
}

/** Returns the mind ID — explicit arg > env > saved config > wallet address. */
export function getMindId(explicitId?: string): string {
  if (explicitId) return explicitId;
  getClient(); // ensure cachedMindId is populated
  return cachedMindId!;
}

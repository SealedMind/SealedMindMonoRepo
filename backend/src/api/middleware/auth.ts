import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { SiweMessage } from "siwe";

/**
 * SIWE authentication + API key middleware.
 *
 * Two auth paths:
 *   1. SIWE session token  — short-lived (24h), obtained via /auth/login
 *   2. API key             — long-lived (sm_*), obtained via /auth/apikey
 *
 * Both are persisted to disk so they survive server restarts.
 */

const DATA_DIR     = path.resolve("data");
const SESSION_FILE = path.join(DATA_DIR, "sessions.json");
const APIKEY_FILE  = path.join(DATA_DIR, "apikeys.json");

interface SessionEntry { address: string; expiresAt: number }
interface ApiKeyEntry  { address: string }

const sessions = new Map<string, SessionEntry>();
const apiKeys  = new Map<string, ApiKeyEntry>();

// ── Persistence ───────────────────────────────────────────────────────────────

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadSessions() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return;
    const raw: Record<string, SessionEntry> = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    const now = Date.now();
    for (const [token, s] of Object.entries(raw)) {
      if (s.expiresAt > now) sessions.set(token, s);
    }
  } catch {}
}

function saveSessions() {
  ensureDataDir();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(sessions)), "utf8");
}

function loadApiKeys() {
  try {
    if (!fs.existsSync(APIKEY_FILE)) return;
    const raw: Record<string, ApiKeyEntry> = JSON.parse(fs.readFileSync(APIKEY_FILE, "utf8"));
    for (const [key, entry] of Object.entries(raw)) apiKeys.set(key, entry);
  } catch {}
}

function saveApiKeys() {
  ensureDataDir();
  fs.writeFileSync(APIKEY_FILE, JSON.stringify(Object.fromEntries(apiKeys)), "utf8");
}

// Load persisted state on module init
loadSessions();
loadApiKeys();

// ── Public API ────────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request { walletAddress?: string }
  }
}

/** Verify SIWE message + signature, create and persist a session. */
export async function createSession(
  message: string,
  signature: string
): Promise<{ token: string; address: string }> {
  const siweMessage = new SiweMessage(message);
  const { data } = await siweMessage.verify({ signature });

  const token = crypto.randomUUID();
  sessions.set(token, {
    address: data.address.toLowerCase(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 h
  });
  saveSessions();

  return { token, address: data.address };
}

/** Generate (or return existing) long-lived API key for an address. */
export function getOrCreateApiKey(address: string): string {
  const addr = address.toLowerCase();
  const existing = [...apiKeys.entries()].find(([, v]) => v.address === addr);
  if (existing) return existing[0];

  const key = `sm_${crypto.randomBytes(24).toString("hex")}`;
  apiKeys.set(key, { address: addr });
  saveApiKeys();
  return key;
}

/** Express middleware: require a valid session token or API key. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const token = header.slice(7);

  // 1. API key path (sm_*)
  const apiKeyEntry = apiKeys.get(token);
  if (apiKeyEntry) {
    req.walletAddress = apiKeyEntry.address;
    next();
    return;
  }

  // 2. Session token path
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: "Invalid session token" });
    return;
  }
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    saveSessions();
    res.status(401).json({ error: "Session expired" });
    return;
  }

  req.walletAddress = session.address;
  next();
}

/** Optional auth: sets walletAddress if valid token present, never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    const apiKeyEntry = apiKeys.get(token);
    if (apiKeyEntry) {
      req.walletAddress = apiKeyEntry.address;
    } else {
      const session = sessions.get(token);
      if (session && session.expiresAt > Date.now()) {
        req.walletAddress = session.address;
      }
    }
  }
  next();
}

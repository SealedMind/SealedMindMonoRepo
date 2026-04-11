import { Router, Request, Response } from "express";
import { SiweMessage, generateNonce } from "siwe";
import { createSession, getOrCreateApiKey, requireAuth } from "../middleware/auth.js";

const router = Router();

/** GET /auth/nonce — generate a fresh nonce for SIWE. */
router.get("/nonce", (_req: Request, res: Response) => {
  res.json({ nonce: generateNonce() });
});

/** POST /auth/login — verify SIWE signature, return session token. */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { message, signature } = req.body;
    if (!message || !signature) {
      res.status(400).json({ error: "message and signature required" });
      return;
    }
    const { token, address } = await createSession(message, signature);
    res.json({ token, address });
  } catch (err: any) {
    res.status(401).json({ error: "SIWE verification failed", details: err.message });
  }
});

/**
 * POST /auth/apikey — issue (or retrieve) a long-lived API key for the caller.
 * API keys survive server restarts and never expire unless manually revoked.
 * Used by the CLI and agent integrations.
 */
router.post("/apikey", requireAuth, (req: Request, res: Response) => {
  const apiKey = getOrCreateApiKey(req.walletAddress!);
  res.json({ apiKey });
});

/** GET /auth/apikey — retrieve the existing API key (same as POST, idempotent). */
router.get("/apikey", requireAuth, (req: Request, res: Response) => {
  const apiKey = getOrCreateApiKey(req.walletAddress!);
  res.json({ apiKey });
});

export default router;

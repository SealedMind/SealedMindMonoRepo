import { Router, Request, Response } from "express";
import { SiweMessage, generateNonce } from "siwe";
import { createSession } from "../middleware/auth.js";

const router = Router();

/** GET /auth/nonce — generate a nonce for SIWE message. */
router.get("/nonce", (_req: Request, res: Response) => {
  res.json({ nonce: generateNonce() });
});

/** POST /auth/login — verify SIWE signature and return session token. */
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

export default router;

import { Router, Request, Response } from "express";
import type { InferenceService } from "../../services/inference.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate_limit.js";
import { logAttestation } from "./attestations.js";

/**
 * Generic TEE-attested chat endpoint — Qwen 2.5 7B in Intel TDX.
 *
 * POST /v1/inference/chat
 *   headers: Authorization: Bearer <sm_* api key | sm_op_* operator key | session>
 *   body:    { messages: [{role, content}], maxTokens?, temperature? }
 *   resp:    { content, model, chatId, attestationValid, enclave }
 *
 * Auth model:
 *   * requireAuth — accepts SIWE session, user-scoped API key, OR an
 *     operator key configured via SEALEDMIND_OPERATOR_KEYS. This stops
 *     anonymous callers from draining the funded wallet's compute escrow.
 *   * rateLimit — token bucket per-key: 30 requests / 60s by default.
 *
 * The chatId can be re-verified via POST /v1/attestations/verify.
 */
export function createInferenceRouter(inference: InferenceService) {
  const router = Router();

  router.post(
    "/chat",
    requireAuth,
    rateLimit({ capacity: 30, refillPerSec: 0.5 }),
    async (req: Request, res: Response) => {
    try {
      const { messages, maxTokens, temperature } = req.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "messages must be a non-empty array" });
        return;
      }
      for (const m of messages) {
        if (typeof m?.role !== "string" || typeof m?.content !== "string") {
          res.status(400).json({ error: "each message needs string role + content" });
          return;
        }
      }

      const result = await inference.chat(messages, { maxTokens, temperature });

      // Record the chatId so /v1/attestations/verify can find it later.
      // Without this, every "Verify Proof" click in the UI returns "not found".
      // Caller-provided mindId is best-effort (operator keys don't have one).
      const callerMindId = req.walletAddress ?? req.operatorLabel ?? "anon";
      if (result.chatId) {
        try { logAttestation(result.chatId, "chat", callerMindId, result.attestationValid); }
        catch { /* recording is best-effort, don't break the response */ }
      }

      res.json({
        content: result.content,
        model: result.model,
        chatId: result.chatId,
        attestationValid: result.attestationValid,
        enclave: "Intel TDX",
      });
      } catch (err: any) {
        res.status(500).json({ error: err?.message ?? String(err) });
      }
    }
  );

  return router;
}

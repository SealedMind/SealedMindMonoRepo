import { Router, Request, Response } from "express";
import type { InferenceService } from "../../services/inference.js";

/**
 * Generic TEE-attested chat endpoint.
 *
 * POST /v1/inference/chat
 *   body: { messages: [{role, content}], maxTokens?, temperature? }
 *   resp: { content, chatId, attestationValid, model, attestationHash }
 *
 * No SIWE auth required — by design, this is meant to be a callable LLM
 * primitive for any external client (e.g. agent frameworks). For
 * production deployments, gate via API key or rate limit at the edge.
 *
 * The model is Qwen 2.5 7B running inside Intel TDX. Every response is
 * accompanied by a TEE attestation chatId; clients can re-verify via
 * POST /v1/attestations/verify.
 */
export function createInferenceRouter(inference: InferenceService) {
  const router = Router();

  router.post("/chat", async (req: Request, res: Response) => {
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
  });

  return router;
}

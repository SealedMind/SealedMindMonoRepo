import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { hasCapability } from "./capabilities.js";
import { logAttestation, patchAttestationWithOnChainTx } from "./attestations.js";
import type { EngineRegistry } from "../../services/engineRegistry.js";
import { type MemoryAccessLogService, mindIdToUint } from "../../services/memoryAccessLog.js";

const MAX_CONTENT_LENGTH = 10_000;

export function createMemoryRouter(
  registry: EngineRegistry,
  memoryAccessLog: MemoryAccessLogService,
) {
  const router = Router();

  // Local helper — fire-and-forget on-chain log + patch the in-memory record
  // when the tx hash arrives. Detached so the HTTP response returns first.
  function logOnChain(
    chatId: string | undefined,
    operation: "remember" | "recall",
    mindId: string,
    storageCID?: string,
  ) {
    if (!chatId) return;
    memoryAccessLog
      .logAccess({
        mindIdNumeric: mindIdToUint(mindId),
        operation,
        chatId,
        storageCID,
      })
      .then((txHash) => {
        if (!txHash) return;
        patchAttestationWithOnChainTx(
          chatId,
          txHash,
          memoryAccessLog.explorerTxUrl(txHash),
        );
      })
      .catch(() => { /* already soft-failed inside service */ });
  }

  /** POST /minds/:id/remember — seal a memory (owner only). */
  router.post("/:id/remember", requireAuth, async (req: Request, res: Response) => {
    try {
      const mindId  = String(req.params.id).toLowerCase();
      const caller  = req.walletAddress!.toLowerCase();

      // Only the mind owner can write memories
      if (caller !== mindId) {
        res.status(403).json({ error: "Only the mind owner can add memories" });
        return;
      }

      const { content, shard, type } = req.body;
      if (!content) {
        res.status(400).json({ error: "content is required" });
        return;
      }
      if (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH) {
        res.status(400).json({ error: `content must be a string under ${MAX_CONTENT_LENGTH} characters` });
        return;
      }

      const engine = await registry.getOrCreate(mindId);
      const result = await engine.remember(content, shard || "general", type || "semantic");

      res.json({
        success: true,
        memories: result.memories.map((m, i) => ({
          id: m.id,
          content: m.content,
          type: m.type,
          shard: m.shard,
          tags: m.tags,
          storageCID: m.storageCID,
          txHash: result.txHashes[i] ?? null,
          explorerUrl: result.txHashes[i]
            ? `https://chainscan-galileo.0g.ai/tx/${result.txHashes[i]}`
            : null,
          createdAt: new Date(m.createdAt).toISOString(),
        })),
        attestation: {
          chatId: result.attestation.chatId,
          verified: result.attestation.attestationValid,
          enclave: "Intel TDX",
        },
        mindStats: { totalMemories: engine.memoryCount },
      });

      // Record so /v1/attestations/verify can find this chatId later
      if (result.attestation.chatId) {
        try { logAttestation(result.attestation.chatId, "remember", mindId, result.attestation.attestationValid); }
        catch { /* best-effort */ }

        // Background — emit on-chain MemoryAccessLog entry. The first
        // memory's storage CID gives us the canonical pointer for this
        // remember batch (the rest are co-located on the same shard tx).
        const firstCID = result.memories[0]?.storageCID;
        logOnChain(result.attestation.chatId, "remember", mindId, firstCID);
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** POST /minds/:id/recall — recall memories (owner or grantee). */
  router.post("/:id/recall", requireAuth, async (req: Request, res: Response) => {
    try {
      const mindId  = String(req.params.id).toLowerCase();
      const caller  = req.walletAddress!.toLowerCase();
      const isOwner = caller === mindId;

      const { query, shard, topK, includeAttestation } = req.body;
      if (!query) {
        res.status(400).json({ error: "query is required" });
        return;
      }

      // Access control: owner always allowed; others need a valid capability
      if (!isOwner && !hasCapability(mindId, caller, shard)) {
        res.status(403).json({ error: "Access denied: no capability granted for this mind/shard" });
        return;
      }

      // Always use the owner's engine to access their memories
      const engine = await registry.getOrCreate(mindId);
      const result = await engine.recall(query, topK || 5, shard);

      const response: any = {
        memories: result.memories.map((m) => ({
          id: m.id,
          content: m.content,
          type: m.type,
          shard: m.shard,
          tags: m.tags,
          storageCID: m.storageCID,
          createdAt: new Date(m.createdAt).toISOString(),
        })),
        answer: result.answer,
      };

      if (includeAttestation !== false) {
        response.attestation = {
          chatId: result.attestation.chatId,
          verified: result.attestation.attestationValid,
          enclave: "Intel TDX",
        };
      }

      // Record the recall chatId so verify endpoint can find it
      if (result.attestation.chatId) {
        try { logAttestation(result.attestation.chatId, "recall", mindId, result.attestation.attestationValid); }
        catch { /* best-effort */ }

        // Background — emit on-chain MemoryAccessLog entry for the recall.
        logOnChain(result.attestation.chatId, "recall", mindId);
      }

      res.json(response);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

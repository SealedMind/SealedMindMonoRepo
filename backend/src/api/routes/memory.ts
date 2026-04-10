import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { MemoryEngine } from "../../services/memoryEngine.js";

/**
 * Memory operation endpoints per §11.
 *
 * POST /minds/:id/remember — store a memory (routed through Sealed Inference)
 * POST /minds/:id/recall   — recall memories (routed through Sealed Inference)
 */

export function createMemoryRouter(engine: MemoryEngine) {
  const router = Router();

  /** POST /minds/:id/remember */
  router.post("/:id/remember", requireAuth, async (req: Request, res: Response) => {
    try {
      const { content, shard, type, tags } = req.body;

      if (!content) {
        res.status(400).json({ error: "content is required" });
        return;
      }

      const result = await engine.remember(
        content,
        shard || "general",
        type || "semantic"
      );

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
        mindStats: {
          totalMemories: engine.memoryCount,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** POST /minds/:id/recall */
  router.post("/:id/recall", requireAuth, async (req: Request, res: Response) => {
    try {
      const { query, shard, topK, includeAttestation } = req.body;

      if (!query) {
        res.status(400).json({ error: "query is required" });
        return;
      }

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

      res.json(response);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

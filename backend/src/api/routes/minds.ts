import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { MemoryEngine } from "../../services/memoryEngine.js";

/**
 * Mind management endpoints per §11.
 *
 * For the hackathon, Mind state is managed in-memory via the MemoryEngine.
 * On-chain Mind iNFT minting/transfer is handled client-side via wagmi.
 */

export function createMindsRouter(engine: MemoryEngine) {
  const router = Router();

  /** POST /minds — create a new Mind (in-memory; on-chain mint is client-side). */
  router.post("/", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, shards } = req.body;
      res.status(201).json({
        success: true,
        mind: {
          owner: req.walletAddress,
          name: name || "Unnamed Mind",
          shards: shards || [],
          memoryCount: 0,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** GET /minds — list user's Minds. */
  router.get("/", requireAuth, async (_req: Request, res: Response) => {
    res.json({
      minds: [
        {
          owner: _req.walletAddress,
          memoryCount: engine.memoryCount,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  });

  /** GET /minds/:id — get Mind details. */
  router.get("/:id", requireAuth, async (req: Request, res: Response) => {
    res.json({
      mind: {
        id: req.params.id,
        owner: req.walletAddress,
        memoryCount: engine.memoryCount,
        records: engine.getAllRecords(),
      },
    });
  });

  /** POST /minds/:id/shards — create a new shard. */
  router.post("/:id/shards", requireAuth, async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "shard name required" });
      return;
    }
    res.status(201).json({ success: true, shard: name });
  });

  /** GET /minds/:id/stats — memory statistics. */
  router.get("/:id/stats", requireAuth, async (_req: Request, res: Response) => {
    const records = engine.getAllRecords();
    const shardCounts: Record<string, number> = {};
    records.forEach((r) => {
      shardCounts[r.shard] = (shardCounts[r.shard] || 0) + 1;
    });
    res.json({
      totalMemories: engine.memoryCount,
      shardMemories: shardCounts,
    });
  });

  return router;
}

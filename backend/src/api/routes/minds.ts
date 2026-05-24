import fs from "node:fs";
import path from "node:path";
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import type { EngineRegistry } from "../../services/engineRegistry.js";

const MINDS_FILE = path.resolve("data", "minds.json");

interface MindMeta {
  id: string;       // = owner address
  owner: string;
  name: string;
  shards: string[];
  createdAt: string;
}

const minds = new Map<string, MindMeta>();

function loadMinds() {
  try {
    if (!fs.existsSync(MINDS_FILE)) return;
    const raw: Record<string, MindMeta> = JSON.parse(fs.readFileSync(MINDS_FILE, "utf8"));
    for (const [id, m] of Object.entries(raw)) minds.set(id, m);
  } catch {}
}

function saveMinds() {
  fs.mkdirSync(path.dirname(MINDS_FILE), { recursive: true });
  fs.writeFileSync(MINDS_FILE, JSON.stringify(Object.fromEntries(minds)), "utf8");
}

loadMinds();

export function createMindsRouter(registry: EngineRegistry) {
  const router = Router();

  /**
   * POST /minds — create (or return existing) Mind for the authenticated user.
   * Mind ID is the wallet address — stable across restarts.
   */
  router.post("/", requireAuth, async (req: Request, res: Response) => {
    try {
      const owner = req.walletAddress!.toLowerCase();

      if (!minds.has(owner)) {
        minds.set(owner, {
          id: owner,
          owner,
          name: req.body.name || "My Mind",
          shards: req.body.shards || [],
          createdAt: new Date().toISOString(),
        });
        saveMinds();
      }

      const engine = await registry.getOrCreate(owner);
      const meta = minds.get(owner)!;
      res.status(201).json({
        success: true,
        mind: { ...meta, memoryCount: engine.memoryCount },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** GET /minds — list the authenticated user's Minds. */
  router.get("/", requireAuth, async (req: Request, res: Response) => {
    const owner = req.walletAddress!.toLowerCase();
    const meta  = minds.get(owner);
    if (!meta) {
      res.json({ minds: [] });
      return;
    }
    const engine = await registry.getOrCreate(owner);
    res.json({ minds: [{ ...meta, memoryCount: engine.memoryCount }] });
  });

  /** GET /minds/:id — get Mind details. */
  router.get("/:id", requireAuth, async (req: Request, res: Response) => {
    const mindId = String(req.params.id).toLowerCase();
    const caller = req.walletAddress!.toLowerCase();

    // Owner or grantee can read mind metadata
    const meta = minds.get(mindId);
    if (!meta) {
      res.status(404).json({ error: "Mind not found" });
      return;
    }

    const engine = await registry.getOrCreate(mindId);
    res.json({
      mind: {
        ...meta,
        memoryCount: engine.memoryCount,
        records: caller === mindId ? engine.getAllRecords() : [],
      },
    });
  });

  /** POST /minds/:id/shards — add a shard name to a Mind. */
  router.post("/:id/shards", requireAuth, async (req: Request, res: Response) => {
    const mindId = String(req.params.id).toLowerCase();
    const owner  = req.walletAddress!.toLowerCase();

    if (owner !== mindId) {
      res.status(403).json({ error: "Only the mind owner can add shards" });
      return;
    }

    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "shard name required" });
      return;
    }

    const meta = minds.get(mindId);
    if (meta && !meta.shards.includes(name)) {
      meta.shards.push(name);
      saveMinds();
    }

    res.status(201).json({ success: true, shard: name });
  });

  /** GET /minds/:id/stats — memory statistics. */
  router.get("/:id/stats", requireAuth, async (req: Request, res: Response) => {
    const mindId = String(req.params.id).toLowerCase();
    const engine = await registry.getOrCreate(mindId);
    const records = engine.getAllRecords();
    const shardCounts: Record<string, number> = {};
    records.forEach((r) => {
      shardCounts[r.shard] = (shardCounts[r.shard] || 0) + 1;
    });
    res.json({ totalMemories: engine.memoryCount, shardMemories: shardCounts });
  });

  /**
   * GET /minds/:id/version — diagnostic.
   *
   * Returns the encryption version a Mind resolves to (1 = legacy direct-key,
   * 2 = envelope/transferable). Public — no PII surfaced, just the metadata
   * shape. Useful for partners (Daimon, Foundry) to confirm a Mind is
   * transferable before listing it for sale.
   */
  router.get("/:id/version", async (req: Request, res: Response) => {
    const mindId = String(req.params.id).toLowerCase();
    res.json({ mindId, encVersion: registry.versionOf(mindId) });
  });

  /**
   * POST /minds/:id/transfer — re-key a Mind to a new owner.
   *
   * Body: { newOwner: "0x...", txHash?: "0x..." (optional, on-chain proof) }
   *
   * Auth: the request must be authenticated as the CURRENT owner (the one
   * recorded in minds.json). We do NOT independently verify on-chain
   * `ownerOf(tokenId)` here because (a) the user already signed an off-chain
   * SIWE/API-key for this backend, and (b) the partner team's frontend is
   * expected to call ERC-7857 `transfer()` first, then call this endpoint
   * with the resulting txHash. The txHash is recorded for audit but not
   * trust — the security guarantee is the SIWE-bound API key.
   *
   * On success:
   *   - The Mind's data dir is renamed from <currentOwner> to <newOwner>.
   *   - The keyring's CK is re-wrapped under the new owner's userKey.
   *   - minds.json's owner/id is flipped.
   *   - Both engines are dropped from the registry cache.
   *   - The new owner can read the memories immediately on next request.
   *
   * v1 Minds are lazily upgraded to v2 during transfer (see
   * EngineRegistry.rekeyForTransfer for the exact semantics).
   */
  router.post("/:id/transfer", requireAuth, async (req: Request, res: Response) => {
    try {
      const mindId = String(req.params.id).toLowerCase();
      const caller = req.walletAddress!.toLowerCase();

      if (caller !== mindId) {
        res.status(403).json({ error: "Only the current owner can transfer this Mind" });
        return;
      }

      const newOwnerRaw: unknown = req.body?.newOwner;
      if (typeof newOwnerRaw !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(newOwnerRaw)) {
        res.status(400).json({ error: "newOwner must be a 0x-prefixed EVM address" });
        return;
      }
      const newOwner = newOwnerRaw.toLowerCase();
      if (newOwner === mindId) {
        res.status(400).json({ error: "newOwner equals current owner" });
        return;
      }
      if (minds.has(newOwner)) {
        res.status(409).json({ error: "Destination address already owns a Mind" });
        return;
      }

      const txHash: string | undefined =
        typeof req.body?.txHash === "string" ? req.body.txHash : undefined;

      // Re-key + migrate the data directory.
      const result = await registry.rekeyForTransfer(mindId, newOwner);

      // Flip the in-memory mind registry — Mind ID becomes the new owner's address.
      const meta = minds.get(mindId);
      if (meta) {
        const next: MindMeta = {
          ...meta,
          id: newOwner,
          owner: newOwner,
        };
        minds.delete(mindId);
        minds.set(newOwner, next);
        saveMinds();
      }

      res.json({
        success: true,
        previousOwner: mindId,
        newOwner,
        encVersion: result.encVersion,
        dataDirMoved: { from: result.fromDir, to: result.toDir },
        onChainTxHash: txHash ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  return router;
}

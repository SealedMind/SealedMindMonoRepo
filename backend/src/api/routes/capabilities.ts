import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";

/**
 * Capability management endpoints per §11.
 *
 * In the hackathon demo, capabilities are managed on-chain via CapabilityRegistry.sol.
 * This API provides a convenience layer for the frontend.
 * Full on-chain integration in Phase 6 frontend (wagmi contract calls).
 */

// In-memory capability cache (mirrors on-chain state)
interface CapabilityEntry {
  capId: string;
  mindId: string;
  shardName: string;
  grantee: string;
  readOnly: boolean;
  expiry: number;
  revoked: boolean;
  grantedAt: string;
}

const capabilities: Map<string, CapabilityEntry> = new Map();

export function createCapabilitiesRouter() {
  const router = Router();

  /** POST /minds/:id/capabilities — grant a capability. */
  router.post("/:id/capabilities", requireAuth, async (req: Request, res: Response) => {
    try {
      const { shardName, grantee, readOnly, expiry } = req.body;

      if (!shardName || !grantee) {
        res.status(400).json({ error: "shardName and grantee required" });
        return;
      }

      const capId = `cap_${crypto.randomUUID().slice(0, 8)}`;
      const entry: CapabilityEntry = {
        capId,
        mindId: req.params.id as string,
        shardName,
        grantee: grantee.toLowerCase(),
        readOnly: readOnly ?? true,
        expiry: expiry || 0,
        revoked: false,
        grantedAt: new Date().toISOString(),
      };

      capabilities.set(capId, entry);

      res.status(201).json({ success: true, capability: entry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** GET /minds/:id/capabilities — list capabilities for a Mind. */
  router.get("/:id/capabilities", requireAuth, async (req: Request, res: Response) => {
    const mindCaps = Array.from(capabilities.values()).filter(
      (c) => c.mindId === req.params.id
    );
    res.json({ capabilities: mindCaps });
  });

  /** DELETE /minds/:id/capabilities/:capId — revoke a capability. */
  router.delete("/:id/capabilities/:capId", requireAuth, async (req: Request, res: Response) => {
    const cap = capabilities.get(req.params.capId as string);
    if (!cap) {
      res.status(404).json({ error: "Capability not found" });
      return;
    }
    cap.revoked = true;
    res.json({ success: true, capId: req.params.capId });
  });

  /** GET /minds/:id/audit — access audit log (reads from MemoryAccessLog contract). */
  router.get("/:id/audit", requireAuth, async (req: Request, res: Response) => {
    // Placeholder — wired to MemoryAccessLog contract reads in Phase 6
    res.json({
      mindId: req.params.id,
      entries: [],
      message: "Audit log reads from MemoryAccessLog contract on 0G Chain",
    });
  });

  return router;
}

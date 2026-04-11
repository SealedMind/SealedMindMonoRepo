import fs from "node:fs";
import path from "node:path";
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";

const CAP_FILE = path.resolve("data", "capabilities.json");

interface CapabilityEntry {
  capId: string;
  mindId: string;
  shardName: string;
  grantee: string;
  readOnly: boolean;
  expiry: number;  // unix ms, 0 = never
  revoked: boolean;
  grantedAt: string;
}

const capabilities = new Map<string, CapabilityEntry>();

// ── Persistence ───────────────────────────────────────────────────────────────

function loadCaps() {
  try {
    if (!fs.existsSync(CAP_FILE)) return;
    const raw: Record<string, CapabilityEntry> = JSON.parse(fs.readFileSync(CAP_FILE, "utf8"));
    for (const [id, cap] of Object.entries(raw)) capabilities.set(id, cap);
  } catch {}
}

function saveCaps() {
  fs.mkdirSync(path.dirname(CAP_FILE), { recursive: true });
  fs.writeFileSync(CAP_FILE, JSON.stringify(Object.fromEntries(capabilities)), "utf8");
}

loadCaps();

// ── Exported helper (used by memory route) ────────────────────────────────────

/**
 * Returns true if `grantee` has a valid, non-revoked capability on `mindId`.
 * If `shardName` is provided, the capability must cover that shard (or "*").
 */
export function hasCapability(mindId: string, grantee: string, shardName?: string): boolean {
  const now = Date.now();
  for (const cap of capabilities.values()) {
    if (
      cap.mindId.toLowerCase()  === mindId.toLowerCase()  &&
      cap.grantee.toLowerCase() === grantee.toLowerCase() &&
      !cap.revoked &&
      (cap.expiry === 0 || cap.expiry > now) &&
      (!shardName || cap.shardName === shardName || cap.shardName === "*")
    ) {
      return true;
    }
  }
  return false;
}

// ── Router ────────────────────────────────────────────────────────────────────

export function createCapabilitiesRouter() {
  const router = Router();

  /** POST /minds/:id/capabilities — grant a capability. */
  router.post("/:id/capabilities", requireAuth, async (req: Request, res: Response) => {
    try {
      const mindId = String(req.params.id).toLowerCase();
      const owner  = req.walletAddress!.toLowerCase();

      // Only the mind owner can grant
      if (owner !== mindId) {
        res.status(403).json({ error: "Only the mind owner can grant capabilities" });
        return;
      }

      const { shardName, grantee, readOnly, expiry } = req.body;
      if (!shardName || !grantee) {
        res.status(400).json({ error: "shardName and grantee required" });
        return;
      }

      const capId = `cap_${crypto.randomUUID().slice(0, 8)}`;
      const entry: CapabilityEntry = {
        capId,
        mindId,
        shardName,
        grantee: grantee.toLowerCase(),
        readOnly: readOnly ?? true,
        expiry: expiry || 0,
        revoked: false,
        grantedAt: new Date().toISOString(),
      };

      capabilities.set(capId, entry);
      saveCaps();

      res.status(201).json({ success: true, capability: entry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** GET /minds/:id/capabilities — list capabilities for a Mind. */
  router.get("/:id/capabilities", requireAuth, async (req: Request, res: Response) => {
    const mindId = String(req.params.id).toLowerCase();
    const mindCaps = Array.from(capabilities.values()).filter(
      (c) => c.mindId === mindId
    );
    res.json({ capabilities: mindCaps });
  });

  /** DELETE /minds/:id/capabilities/:capId — revoke a capability. */
  router.delete("/:id/capabilities/:capId", requireAuth, async (req: Request, res: Response) => {
    const mindId = String(req.params.id).toLowerCase();
    const owner  = req.walletAddress!.toLowerCase();

    if (owner !== mindId) {
      res.status(403).json({ error: "Only the mind owner can revoke capabilities" });
      return;
    }

    const cap = capabilities.get(req.params.capId as string);
    if (!cap) {
      res.status(404).json({ error: "Capability not found" });
      return;
    }

    cap.revoked = true;
    saveCaps();
    res.json({ success: true, capId: req.params.capId });
  });

  /** GET /minds/:id/audit — access audit log. */
  router.get("/:id/audit", requireAuth, async (req: Request, res: Response) => {
    res.json({
      mindId: req.params.id,
      entries: [],
      message: "Audit log reads from MemoryAccessLog contract on 0G Chain",
    });
  });

  return router;
}

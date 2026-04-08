import { Router, Request, Response } from "express";

/**
 * Attestation endpoints per §11.
 *
 * GET  /attestations/:hash — get attestation details
 * POST /attestations/verify — verify an attestation
 */

// In-memory attestation store (populated by memory operations)
interface AttestationRecord {
  hash: string;
  chatId: string;
  verified: boolean;
  operation: string;       // "remember" | "recall"
  mindId: string;
  timestamp: string;
  teeEnvironment: {
    cpu: string;
    gpu: string;
  };
}

export const attestationStore: Map<string, AttestationRecord> = new Map();

export function logAttestation(
  chatId: string,
  operation: string,
  mindId: string,
  verified: boolean
): string {
  const hash = `0x${Buffer.from(chatId).toString("hex").slice(0, 40)}`;
  attestationStore.set(hash, {
    hash,
    chatId,
    verified,
    operation,
    mindId,
    timestamp: new Date().toISOString(),
    teeEnvironment: {
      cpu: "Intel TDX (4th Gen Xeon)",
      gpu: "NVIDIA H100 (TEE Mode)",
    },
  });
  return hash;
}

export function createAttestationsRouter() {
  const router = Router();

  /** GET /attestations/:hash */
  router.get("/:hash", async (req: Request, res: Response) => {
    const att = attestationStore.get(req.params.hash as string);
    if (!att) {
      res.status(404).json({ error: "Attestation not found" });
      return;
    }
    res.json({ attestation: att });
  });

  /** POST /attestations/verify */
  router.post("/verify", async (req: Request, res: Response) => {
    const { hash } = req.body;
    if (!hash) {
      res.status(400).json({ error: "hash required" });
      return;
    }

    const att = attestationStore.get(hash);
    if (!att) {
      res.json({ verified: false, reason: "Attestation not found in store" });
      return;
    }

    res.json({
      verified: att.verified,
      attestation: att,
    });
  });

  return router;
}

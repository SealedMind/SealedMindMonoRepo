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
  operation: string;       // "remember" | "recall" | "chat"
  mindId: string;
  timestamp: string;
  teeEnvironment: {
    cpu: string;
    gpu: string;
  };
  /** Set asynchronously when MemoryAccessLog.logAccess lands on chain. */
  onChainTxHash?: string;
  /** Convenience field — chainscan URL for the tx (set with onChainTxHash). */
  onChainExplorerUrl?: string;
}

export const attestationStore: Map<string, AttestationRecord> = new Map();

export function logAttestation(
  chatId: string,
  operation: string,
  mindId: string,
  verified: boolean
): string {
  // Store under the chatId itself as the canonical lookup key.
  // (Earlier versions derived a separate "hash" from the chatId, which
  // broke the verify endpoint because callers use the chatId returned
  // from /v1/inference/chat as the lookup key.)
  attestationStore.set(chatId, {
    hash: chatId,
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
  return chatId;
}

/**
 * Patch a previously-recorded attestation with the on-chain tx hash from
 * MemoryAccessLog.logAccess once it lands. Idempotent — subsequent calls
 * with the same chatId update the same record.
 */
export function patchAttestationWithOnChainTx(
  chatId: string,
  txHash: string,
  explorerUrl: string,
): void {
  const att = attestationStore.get(chatId);
  if (!att) return;
  att.onChainTxHash = txHash;
  att.onChainExplorerUrl = explorerUrl;
  attestationStore.set(chatId, att);
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

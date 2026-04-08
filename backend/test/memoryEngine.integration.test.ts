import { describe, it, expect, beforeAll } from "vitest";
import { config as loadEnv } from "dotenv";
import { MemoryEngine } from "../src/services/memoryEngine.js";

loadEnv({ path: "../.env" });

// Full end-to-end: fact extraction (TEE) + embed + index + encrypt + upload + recall + synthesize (TEE)
// Requires PRIVATE_KEY and live 0G testnet access.
const RUN = process.env.PRIVATE_KEY ? describe : describe.skip;

RUN("MemoryEngine (end-to-end)", () => {
  let engine: MemoryEngine;

  beforeAll(async () => {
    engine = new MemoryEngine({
      inference: {
        rpcUrl: process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
        privateKey: process.env.PRIVATE_KEY!,
      },
      storage: {
        indexerUrl: process.env.OG_STORAGE_INDEXER ?? "https://indexer-storage-testnet-turbo.0g.ai",
        rpcUrl: process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
        privateKey: process.env.PRIVATE_KEY!,
      },
    });
    await engine.init();
  }, 30_000);

  it("remembers facts and recalls them", async () => {
    // Remember
    const result = await engine.remember(
      "I just moved to Tokyo for a new ML engineering role. I am allergic to shellfish.",
      "personal"
    );

    expect(result.memories.length).toBeGreaterThan(0);
    expect(result.attestation.attestationValid).toBe(true);
    expect(result.storageCIDs.length).toBeGreaterThan(0);
    console.log("  Remembered:", result.memories.length, "facts");
    console.log("  Attestation valid:", result.attestation.attestationValid);
    console.log("  Storage CIDs:", result.storageCIDs);

    // Recall
    const recall = await engine.recall("Where do I live?", 3);
    expect(recall.memories.length).toBeGreaterThan(0);
    expect(recall.answer.length).toBeGreaterThan(0);
    console.log("  Recall answer:", recall.answer);
    console.log("  Recall attestation valid:", recall.attestation.attestationValid);

    // Recall with different query
    const recall2 = await engine.recall("Do I have any food allergies?", 3);
    expect(recall2.answer.toLowerCase()).toContain("shellfish");
    console.log("  Allergy recall:", recall2.answer);
  }, 180_000);
});

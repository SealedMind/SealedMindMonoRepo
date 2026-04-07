import { describe, it, expect, beforeAll } from "vitest";
import { config as loadEnv } from "dotenv";
import { StorageService } from "../src/services/storage.js";
import { generateKey } from "../src/services/crypto.js";

loadEnv({ path: "../.env" });

// 2026-04-07: Galileo testnet flow contract (0x22E03...) is reverting on submit()
// for ALL users (nextTxSeq stuck at 42752). Our code follows the exact SDK README
// pattern. Skip until testnet recovers. Re-enable by removing .skip.
const RUN = describe.skip;

/**
 * Real integration test against 0G Storage testnet.
 * Skipped automatically if PRIVATE_KEY is not in .env.
 *
 * Each upload costs a tiny amount of testnet OG; tests are kept minimal.
 */
RUN("StorageService (0G testnet)", () => {
  let svc: StorageService;

  beforeAll(() => {
    svc = new StorageService({
      indexerUrl: process.env.OG_STORAGE_INDEXER ?? "https://indexer-storage-testnet-turbo.0g.ai",
      rpcUrl: process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai",
      privateKey: process.env.PRIVATE_KEY!,
    });
  });

  it("encrypts, uploads, downloads, and decrypts a payload end-to-end", async () => {
    const key = generateKey();
    const payload = `SealedMind test memory @ ${Date.now()} — Tokyo, allergies: shellfish`;

    const { rootHash, txHash } = await svc.putEncrypted(payload, key);
    expect(rootHash).toMatch(/^0x[0-9a-f]+$/i);
    expect(txHash).toMatch(/^0x[0-9a-f]+$/i);
    console.log("    rootHash:", rootHash);
    console.log("    txHash:  ", txHash);

    const decrypted = await svc.getEncrypted(rootHash, key);
    expect(decrypted.toString("utf8")).toBe(payload);
  }, 180_000);
});

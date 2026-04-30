import { config as loadEnv } from "dotenv";
loadEnv({ path: "../.env" });

import { createApp } from "./server.js";
import { EngineRegistry } from "../services/engineRegistry.js";
import { InferenceService } from "../services/inference.js";

const PORT = Number(process.env.PORT) || 4000;

async function main() {
  console.log("Initializing SealedMind API...");

  if (!process.env.KEY_DERIVATION_SECRET) {
    console.warn(
      "WARNING: KEY_DERIVATION_SECRET not set. Using a random secret — " +
      "all existing memories will be unreadable after restart. Set this in .env."
    );
  }

  const inferenceCfg = {
    rpcUrl:     process.env.OG_RPC_URL     ?? "https://evmrpc-testnet.0g.ai",
    privateKey: process.env.PRIVATE_KEY!,
  };

  const registry = new EngineRegistry(
    {
      inference: inferenceCfg,
      storage: {
        indexerUrl: process.env.OG_STORAGE_INDEXER ?? "https://indexer-storage-testnet-turbo.0g.ai",
        rpcUrl:     process.env.OG_RPC_URL          ?? "https://evmrpc-testnet.0g.ai",
        privateKey: process.env.PRIVATE_KEY!,
      },
    },
    process.env.KEY_DERIVATION_SECRET ?? (await import("node:crypto")).default.randomBytes(32).toString("hex"),
    "data"
  );

  // Standalone inference service for /v1/inference/chat — separate from the
  // per-user MemoryEngines, since chat is a generic capability.
  const inferenceService = new InferenceService(inferenceCfg);
  console.log("Initializing 0G Compute broker for /v1/inference/chat...");
  await inferenceService.init();
  console.log("✅ Inference broker ready");

  const app = createApp(registry, inferenceService);
  app.listen(PORT, () => {
    console.log(`SealedMind API running on http://localhost:${PORT}`);
    console.log("Endpoints:");
    console.log("  GET  /health");
    console.log("  GET  /v1/auth/nonce");
    console.log("  POST /v1/auth/login");
    console.log("  POST /v1/auth/apikey   ← issue long-lived API key");
    console.log("  POST /v1/minds");
    console.log("  GET  /v1/minds");
    console.log("  POST /v1/minds/:id/remember");
    console.log("  POST /v1/minds/:id/recall");
    console.log("  POST /v1/minds/:id/capabilities");
    console.log("  GET  /v1/attestations/:hash");
    console.log("  POST /v1/inference/chat ← TEE-attested Qwen 2.5 7B");
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});

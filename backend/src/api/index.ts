import { config as loadEnv } from "dotenv";
loadEnv({ path: "../.env" });

import { createApp } from "./server.js";
import { MemoryEngine } from "../services/memoryEngine.js";

const PORT = Number(process.env.PORT) || 4000;

async function main() {
  console.log("Initializing SealedMind API...");

  const engine = new MemoryEngine({
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
  console.log("Memory engine initialized (TEE broker connected)");

  const app = createApp(engine);
  app.listen(PORT, () => {
    console.log(`SealedMind API running on http://localhost:${PORT}`);
    console.log("Endpoints:");
    console.log("  GET  /health");
    console.log("  GET  /v1/auth/nonce");
    console.log("  POST /v1/auth/login");
    console.log("  POST /v1/minds");
    console.log("  GET  /v1/minds");
    console.log("  POST /v1/minds/:id/remember");
    console.log("  POST /v1/minds/:id/recall");
    console.log("  POST /v1/minds/:id/capabilities");
    console.log("  GET  /v1/attestations/:hash");
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});

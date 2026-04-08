import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import { createMindsRouter } from "./routes/minds.js";
import { createMemoryRouter } from "./routes/memory.js";
import { createCapabilitiesRouter } from "./routes/capabilities.js";
import { createAttestationsRouter } from "./routes/attestations.js";
import type { MemoryEngine } from "../services/memoryEngine.js";

/**
 * Create the Express API server.
 *
 * The MemoryEngine is injected so the server can be tested
 * with a mocked engine or started with a real one.
 */
export function createApp(engine: MemoryEngine) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", memoryCount: engine.memoryCount });
  });

  // Routes (all under /v1 per §11)
  app.use("/v1/auth", authRouter);
  app.use("/v1/minds", createMindsRouter(engine));
  app.use("/v1/minds", createMemoryRouter(engine));
  app.use("/v1/minds", createCapabilitiesRouter());
  app.use("/v1/attestations", createAttestationsRouter());

  return app;
}

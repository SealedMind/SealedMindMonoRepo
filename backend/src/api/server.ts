import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import { createMindsRouter } from "./routes/minds.js";
import { createMemoryRouter } from "./routes/memory.js";
import { createCapabilitiesRouter } from "./routes/capabilities.js";
import { createAttestationsRouter } from "./routes/attestations.js";
import { createInferenceRouter } from "./routes/inference.js";
import type { EngineRegistry } from "../services/engineRegistry.js";
import type { InferenceService } from "../services/inference.js";
import type { MemoryAccessLogService } from "../services/memoryAccessLog.js";

export function createApp(
  registry: EngineRegistry,
  inference: InferenceService,
  memoryAccessLog: MemoryAccessLogService,
) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/v1/auth",         authRouter);
  app.use("/v1/minds",        createMindsRouter(registry));
  app.use("/v1/minds",        createMemoryRouter(registry, memoryAccessLog));
  app.use("/v1/minds",        createCapabilitiesRouter());
  app.use("/v1/attestations", createAttestationsRouter());
  app.use("/v1/inference",    createInferenceRouter(inference, memoryAccessLog));

  return app;
}

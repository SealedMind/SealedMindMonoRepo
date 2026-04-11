import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import { createMindsRouter } from "./routes/minds.js";
import { createMemoryRouter } from "./routes/memory.js";
import { createCapabilitiesRouter } from "./routes/capabilities.js";
import { createAttestationsRouter } from "./routes/attestations.js";
import type { EngineRegistry } from "../services/engineRegistry.js";

export function createApp(registry: EngineRegistry) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/v1/auth",        authRouter);
  app.use("/v1/minds",       createMindsRouter(registry));
  app.use("/v1/minds",       createMemoryRouter(registry));
  app.use("/v1/minds",       createCapabilitiesRouter());
  app.use("/v1/attestations", createAttestationsRouter());

  return app;
}

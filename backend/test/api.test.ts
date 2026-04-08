import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import { createApp } from "../src/api/server.js";
import { createSession } from "../src/api/middleware/auth.js";

/**
 * API integration tests — tests all Phase 4 endpoints.
 * Uses a mocked MemoryEngine to isolate API logic.
 */

// Mock MemoryEngine
const mockEngine = {
  memoryCount: 3,
  getAllRecords: () => [
    { id: "m1", content: "test memory", type: "semantic", shard: "general", tags: [], storageCID: "0xabc", createdAt: Date.now() },
    { id: "m2", content: "another memory", type: "semantic", shard: "work", tags: ["tag1"], storageCID: "0xdef", createdAt: Date.now() },
    { id: "m3", content: "third memory", type: "episodic", shard: "general", tags: [], storageCID: "0x123", createdAt: Date.now() },
  ],
  remember: vi.fn().mockResolvedValue({
    memories: [
      { id: "m4", content: "stored fact", type: "semantic", shard: "general", tags: [], storageCID: "0xnew", createdAt: Date.now() },
    ],
    attestation: { chatId: "chat-001", attestationValid: true },
  }),
  recall: vi.fn().mockResolvedValue({
    memories: [
      { id: "m1", content: "test memory", type: "semantic", shard: "general", tags: [], storageCID: "0xabc", createdAt: Date.now() },
    ],
    answer: "Based on your memories, here is the answer.",
    attestation: { chatId: "chat-002", attestationValid: true },
  }),
  init: vi.fn().mockResolvedValue(undefined),
} as any;

let app: express.Express;
let authToken: string;

beforeAll(async () => {
  app = createApp(mockEngine);

  // Create a session directly for testing (bypasses SIWE signature verification)
  const { token } = await createSession(
    // Minimal SIWE message - we mock verify below
    "test-message",
    "test-signature"
  ).catch(() => {
    // If SIWE verify fails, create token manually
    return { token: "", address: "" };
  });
  authToken = token;
});

describe("Health check", () => {
  it("GET /health returns status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.memoryCount).toBe(3);
  });
});

describe("Auth endpoints", () => {
  it("GET /v1/auth/nonce returns a nonce string", async () => {
    const res = await request(app).get("/v1/auth/nonce");
    expect(res.status).toBe(200);
    expect(res.body.nonce).toBeDefined();
    expect(typeof res.body.nonce).toBe("string");
  });

  it("POST /v1/auth/login rejects missing fields", async () => {
    const res = await request(app).post("/v1/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe("Minds endpoints (unauthenticated)", () => {
  it("POST /v1/minds rejects without auth", async () => {
    const res = await request(app).post("/v1/minds").send({ name: "Test" });
    expect(res.status).toBe(401);
  });

  it("GET /v1/minds rejects without auth", async () => {
    const res = await request(app).get("/v1/minds");
    expect(res.status).toBe(401);
  });
});

describe("Memory endpoints (unauthenticated)", () => {
  it("POST /v1/minds/1/remember rejects without auth", async () => {
    const res = await request(app)
      .post("/v1/minds/1/remember")
      .send({ content: "test" });
    expect(res.status).toBe(401);
  });

  it("POST /v1/minds/1/recall rejects without auth", async () => {
    const res = await request(app)
      .post("/v1/minds/1/recall")
      .send({ query: "test" });
    expect(res.status).toBe(401);
  });
});

describe("Attestation endpoints", () => {
  it("GET /v1/attestations/:hash returns 404 for unknown hash", async () => {
    const res = await request(app).get("/v1/attestations/0xdeadbeef");
    expect(res.status).toBe(404);
  });

  it("POST /v1/attestations/verify rejects missing hash", async () => {
    const res = await request(app).post("/v1/attestations/verify").send({});
    expect(res.status).toBe(400);
  });

  it("POST /v1/attestations/verify returns false for unknown hash", async () => {
    const res = await request(app)
      .post("/v1/attestations/verify")
      .send({ hash: "0xdeadbeef" });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
  });
});

describe("Capability endpoints (unauthenticated)", () => {
  it("POST /v1/minds/1/capabilities rejects without auth", async () => {
    const res = await request(app)
      .post("/v1/minds/1/capabilities")
      .send({ shardName: "general", grantee: "0x123" });
    expect(res.status).toBe(401);
  });
});

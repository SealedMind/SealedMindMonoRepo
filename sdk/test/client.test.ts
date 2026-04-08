import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SealedMind, SealedMindError } from "../src/index.js";

/**
 * SDK client tests — spins up a minimal mock server
 * to test the client's HTTP layer and type safety.
 */

import http from "node:http";

let server: http.Server;
let baseUrl: string;

// Minimal mock API server
function createMockServer(): http.Server {
  return http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      const url = req.url || "";

      // Auth
      if (url === "/v1/auth/nonce" && req.method === "GET") {
        res.end(JSON.stringify({ nonce: "test-nonce-123" }));
        return;
      }

      // Check auth for protected routes
      const auth = req.headers.authorization;
      const isProtected =
        url.startsWith("/v1/minds") || url.startsWith("/v1/attestations");

      if (isProtected && !auth?.startsWith("Bearer ")) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: "Missing Authorization header" }));
        return;
      }

      // Minds
      if (url === "/v1/minds" && req.method === "POST") {
        const data = JSON.parse(body);
        res.statusCode = 201;
        res.end(
          JSON.stringify({
            mind: {
              id: "mind-1",
              owner: "0xtest",
              name: data.name,
              memoryCount: 0,
              shards: data.shards || [],
              createdAt: new Date().toISOString(),
            },
          })
        );
        return;
      }

      if (url === "/v1/minds" && req.method === "GET") {
        res.end(JSON.stringify({ minds: [] }));
        return;
      }

      // Remember
      if (url.match(/\/v1\/minds\/[\w-]+\/remember/) && req.method === "POST") {
        const data = JSON.parse(body);
        res.end(
          JSON.stringify({
            success: true,
            memories: [
              {
                id: "mem-1",
                content: data.content,
                type: data.type || "semantic",
                shard: data.shard || "general",
                tags: [],
                storageCID: "0xabc",
                createdAt: new Date().toISOString(),
              },
            ],
            attestation: {
              chatId: "chat-001",
              verified: true,
              enclave: "Intel TDX",
            },
            mindStats: { totalMemories: 1 },
          })
        );
        return;
      }

      // Recall
      if (url.match(/\/v1\/minds\/[\w-]+\/recall/) && req.method === "POST") {
        res.end(
          JSON.stringify({
            memories: [],
            answer: "Mock answer",
            attestation: {
              chatId: "chat-002",
              verified: true,
              enclave: "Intel TDX",
            },
          })
        );
        return;
      }

      // Capabilities
      if (
        url.match(/\/v1\/minds\/[\w-]+\/capabilities$/) &&
        req.method === "POST"
      ) {
        const data = JSON.parse(body);
        res.statusCode = 201;
        res.end(
          JSON.stringify({
            success: true,
            capability: {
              capId: "cap_test123",
              mindId: "mind-1",
              shardName: data.shardName,
              grantee: data.grantee,
              readOnly: data.readOnly ?? true,
              expiry: data.expiry || 0,
              revoked: false,
              grantedAt: new Date().toISOString(),
            },
          })
        );
        return;
      }

      if (
        url.match(/\/v1\/minds\/[\w-]+\/capabilities$/) &&
        req.method === "GET"
      ) {
        res.end(JSON.stringify({ capabilities: [] }));
        return;
      }

      if (
        url.match(/\/v1\/minds\/[\w-]+\/capabilities\/[\w_]+/) &&
        req.method === "DELETE"
      ) {
        res.end(JSON.stringify({ success: true, capId: "cap_test123" }));
        return;
      }

      // Attestations
      if (url.match(/\/v1\/attestations\/0x/) && req.method === "GET") {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Attestation not found" }));
        return;
      }

      // Health
      if (url === "/health") {
        res.end(JSON.stringify({ status: "ok", memoryCount: 0 }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Not found" }));
    });
  });
}

beforeAll(async () => {
  server = createMockServer();
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

describe("SealedMind SDK", () => {
  it("starts unauthenticated", () => {
    const client = new SealedMind({ apiUrl: baseUrl });
    expect(client.isAuthenticated).toBe(false);
    expect(client.address).toBeNull();
  });

  it("can set a session manually", () => {
    const client = new SealedMind({ apiUrl: baseUrl });
    client.setSession({ token: "test-token", address: "0xabc" });
    expect(client.isAuthenticated).toBe(true);
    expect(client.address).toBe("0xabc");
  });

  it("rejects unauthenticated requests to protected endpoints", async () => {
    const client = new SealedMind({ apiUrl: baseUrl });
    await expect(client.listMinds()).rejects.toThrow(SealedMindError);
    await expect(client.listMinds()).rejects.toThrow("401");
  });

  describe("authenticated", () => {
    let client: SealedMind;

    beforeAll(() => {
      client = new SealedMind({ apiUrl: baseUrl });
      client.setSession({ token: "test-token", address: "0xtest" });
    });

    it("creates a Mind", async () => {
      const result = await client.createMind("My Agent");
      expect(result.mind.name).toBe("My Agent");
      expect(result.mind.id).toBe("mind-1");
    });

    it("lists Minds", async () => {
      const result = await client.listMinds();
      expect(result.minds).toBeInstanceOf(Array);
    });

    it("remembers content", async () => {
      const result = await client.remember("mind-1", {
        content: "I live in Tokyo",
      });
      expect(result.success).toBe(true);
      expect(result.memories[0].content).toBe("I live in Tokyo");
      expect(result.attestation.verified).toBe(true);
    });

    it("recalls memories", async () => {
      const result = await client.recall("mind-1", {
        query: "Where do I live?",
      });
      expect(result.answer).toBe("Mock answer");
      expect(result.attestation?.verified).toBe(true);
    });

    it("grants a capability", async () => {
      const result = await client.grantCapability(
        "mind-1",
        "general",
        "0xgrantee"
      );
      expect(result.success).toBe(true);
      expect(result.capability.shardName).toBe("general");
      expect(result.capability.grantee).toBe("0xgrantee");
    });

    it("lists capabilities", async () => {
      const result = await client.listCapabilities("mind-1");
      expect(result.capabilities).toBeInstanceOf(Array);
    });

    it("revokes a capability", async () => {
      const result = await client.revokeCapability("mind-1", "cap_test123");
      expect(result.success).toBe(true);
    });

    it("handles 404 attestation gracefully", async () => {
      await expect(
        client.getAttestation("0xdeadbeef")
      ).rejects.toThrow(SealedMindError);
    });

    it("clears session on logout", () => {
      client.logout();
      expect(client.isAuthenticated).toBe(false);
    });
  });
});

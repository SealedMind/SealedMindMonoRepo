/**
 * @sealedmind/mcp — Model Context Protocol server for SealedMind.
 *
 * Exposes 6 tools that wrap our hosted REST API:
 *   sealedmind_remember         — seal a memory to a shard
 *   sealedmind_recall           — TEE-attested retrieval + synthesis
 *   sealedmind_grant_capability — share a shard with another wallet
 *   sealedmind_list_capabilities
 *   sealedmind_revoke_capability
 *   sealedmind_verify_attestation — surface chainscan-clickable proof
 *
 * stdio transport. Auth via env vars (BYOK):
 *   SEALEDMIND_API_KEY            (required)  — sm_* or sm_op_*
 *   SEALEDMIND_DEFAULT_MIND_ID    (optional)  — Mind to use when tools omit mindId
 *   SEALEDMIND_API_URL            (optional)  — override the hosted backend
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

// ─────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────

interface Config {
  apiUrl: string;
  apiKey: string;
  defaultMindId: string | null;
}

function loadConfig(): Config {
  const apiKey = process.env.SEALEDMIND_API_KEY;
  if (!apiKey) {
    console.error(
      "[sealedmind-mcp] ERROR: SEALEDMIND_API_KEY env var is required.\n" +
        "  Get one at https://sealedmind.vercel.app/developer",
    );
    process.exit(1);
  }
  return {
    apiUrl: (process.env.SEALEDMIND_API_URL ?? "https://sealedmind-backend-production.up.railway.app")
      .replace(/\/$/, ""),
    apiKey,
    defaultMindId: process.env.SEALEDMIND_DEFAULT_MIND_ID ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Thin HTTP client over the SealedMind backend
// ─────────────────────────────────────────────────────────────────────

class SealedMindClient {
  constructor(private cfg: Config) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.cfg.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let detail: string;
      try {
        const j = (await res.json()) as { error?: string };
        detail = j.error ?? `HTTP ${res.status}`;
      } catch {
        detail = `HTTP ${res.status} ${res.statusText}`;
      }
      throw new Error(`SealedMind API: ${detail}`);
    }
    return res.json() as Promise<T>;
  }

  /** Pick the mind to operate on. Tool arg > env default > error. */
  resolveMindId(provided: string | undefined | null): string {
    const mindId = provided ?? this.cfg.defaultMindId;
    if (!mindId) {
      throw new Error(
        "mindId is required — either pass it to the tool call or set SEALEDMIND_DEFAULT_MIND_ID env var.",
      );
    }
    return mindId.toLowerCase();
  }

  remember(mindId: string, body: { content: string; shard?: string; tags?: string[]; type?: string }) {
    return this.request<RememberResponse>("POST", `/v1/minds/${mindId}/remember`, body);
  }
  recall(mindId: string, body: { query: string; shard?: string; topK?: number; includeAttestation?: boolean }) {
    return this.request<RecallResponse>("POST", `/v1/minds/${mindId}/recall`, body);
  }
  grantCapability(mindId: string, body: { grantee: string; shard: string; readOnly?: boolean; expiry?: number }) {
    return this.request<GrantResponse>("POST", `/v1/minds/${mindId}/capabilities`, body);
  }
  listCapabilities(mindId: string) {
    return this.request<{ capabilities: unknown[] }>("GET", `/v1/minds/${mindId}/capabilities`);
  }
  revokeCapability(mindId: string, capId: string) {
    return this.request<{ txHash?: string }>("DELETE", `/v1/minds/${mindId}/capabilities/${capId}`);
  }
  verifyAttestation(hash: string) {
    return this.request<VerifyResponse>("POST", `/v1/attestations/verify`, { hash });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Backend response shapes (just what we surface to the agent)
// ─────────────────────────────────────────────────────────────────────

interface Memory {
  id: string;
  content: string;
  shard?: string;
  storageCID?: string;
  txHash?: string | null;
  explorerUrl?: string | null;
  createdAt?: string;
}
interface Attestation {
  chatId?: string;
  verified?: boolean;
  enclave?: string;
  onChainTxHash?: string;
  onChainExplorerUrl?: string;
}
interface RememberResponse {
  success: boolean;
  memories: Memory[];
  attestation: Attestation;
  mindStats?: { totalMemories: number };
}
interface RecallResponse {
  memories: Memory[];
  answer: string;
  attestation: Attestation;
}
interface GrantResponse {
  capId: string;
  txHash?: string;
  grantee?: string;
  shard?: string;
  readOnly?: boolean;
  expiry?: number;
}
interface VerifyResponse {
  verified: boolean;
  attestation?: Attestation & { mindId?: string; operation?: string; timestamp?: string };
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Tool definitions (JSON Schema)
// ─────────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "sealedmind_remember",
    description:
      "Seal a fact or piece of context into the user's encrypted Mind on 0G. The content is AES-256-GCM encrypted under a key derived from the user's wallet, uploaded to 0G Storage, and an on-chain MemoryAccessLog entry is emitted. Returns the storage CID + chainscan URL for the log tx. Use whenever the user shares something durable about themselves (preferences, biographical facts, health info, project context, decisions).",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The plain-text fact or context to seal. SealedMind's two-pass extractor will distill it into structured memories.",
        },
        shard: {
          type: "string",
          description: "Optional named shard (e.g. 'health', 'work', 'finance', 'preferences', 'fitness'). Shards are how capability sharing is scoped. Defaults to 'general'.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional free-form tags for later filtering.",
        },
        mindId: {
          type: "string",
          description: "Optional Mind ID (wallet address). If omitted, uses SEALEDMIND_DEFAULT_MIND_ID from the environment.",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "sealedmind_recall",
    description:
      "Retrieve memories from the user's Mind using semantic search, then synthesize an answer via TEE-attested Qwen 2.5 7B inside Intel TDX + NVIDIA H100. Returns the answer, the supporting memory snippets, and a signed attestation. Use before answering questions that depend on what the user has told you previously, especially about personal context, history, preferences, or prior decisions.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language query — what you want to retrieve from the user's memory.",
        },
        shard: {
          type: "string",
          description: "Optional shard filter. If you only need health context, pass shard='health' to limit search.",
        },
        topK: {
          type: "integer",
          description: "Max number of memories to retrieve (default 5, max 20).",
          minimum: 1,
          maximum: 20,
        },
        mindId: {
          type: "string",
          description: "Optional Mind ID. If omitted, uses SEALEDMIND_DEFAULT_MIND_ID.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "sealedmind_grant_capability",
    description:
      "Grant another wallet address read access to one of the user's shards via the on-chain CapabilityRegistry. Capabilities are time-bound, scope-limited, and revocable in a single transaction. Returns the capability ID + on-chain tx hash. Use when the user explicitly asks to share data with another party (e.g. 'give my doctor's AI access to my health shard for 30 days').",
    inputSchema: {
      type: "object",
      properties: {
        grantee: {
          type: "string",
          description: "EVM wallet address of the grantee (0x-prefixed).",
        },
        shard: {
          type: "string",
          description: "Name of the shard to share (e.g. 'health').",
        },
        expirySeconds: {
          type: "integer",
          description: "Validity duration in seconds. Defaults to 30 days. Use 0 for no expiry (not recommended).",
          minimum: 0,
        },
        readOnly: {
          type: "boolean",
          description: "Whether the capability is read-only. Defaults to true.",
        },
        mindId: {
          type: "string",
          description: "Optional Mind ID. If omitted, uses SEALEDMIND_DEFAULT_MIND_ID.",
        },
      },
      required: ["grantee", "shard"],
    },
  },
  {
    name: "sealedmind_list_capabilities",
    description:
      "List active capabilities the user has granted on their Mind, with grantee addresses, shards, and expiries. Use to answer 'who currently has access to my X data?'",
    inputSchema: {
      type: "object",
      properties: {
        mindId: { type: "string", description: "Optional Mind ID; defaults to SEALEDMIND_DEFAULT_MIND_ID." },
      },
    },
  },
  {
    name: "sealedmind_revoke_capability",
    description:
      "Revoke a previously-granted capability on chain. The next recall attempt by the grantee returns 403 immediately. Returns the revoke tx hash.",
    inputSchema: {
      type: "object",
      properties: {
        capId: {
          type: "string",
          description: "The capability ID (bytes32) returned from sealedmind_grant_capability or sealedmind_list_capabilities.",
        },
        mindId: { type: "string", description: "Optional Mind ID; defaults to SEALEDMIND_DEFAULT_MIND_ID." },
      },
      required: ["capId"],
    },
  },
  {
    name: "sealedmind_verify_attestation",
    description:
      "Independently re-verify a SealedMind attestation by chatId. Returns whether the attestation chain is valid and (once the on-chain MemoryAccessLog tx has mined) a chainscan-clickable URL proving the operation happened in a sealed environment. Use to surface verifiable proof to the user.",
    inputSchema: {
      type: "object",
      properties: {
        chatId: {
          type: "string",
          description: "The chatId from a prior remember/recall/chat attestation.",
        },
      },
      required: ["chatId"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────
// Tool dispatch
// ─────────────────────────────────────────────────────────────────────

async function dispatch(client: SealedMindClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "sealedmind_remember": {
      const mindId = client.resolveMindId(args.mindId as string | undefined);
      const result = await client.remember(mindId, {
        content: String(args.content),
        shard: args.shard ? String(args.shard) : undefined,
        tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
      });
      return {
        success: result.success,
        sealedCount: result.memories.length,
        memories: result.memories.map((m) => ({
          id: m.id,
          content: m.content,
          shard: m.shard,
          storageCID: m.storageCID,
          chainscanTx: m.explorerUrl ?? null,
        })),
        attestation: result.attestation,
        totalMemories: result.mindStats?.totalMemories,
      };
    }

    case "sealedmind_recall": {
      const mindId = client.resolveMindId(args.mindId as string | undefined);
      const result = await client.recall(mindId, {
        query: String(args.query),
        shard: args.shard ? String(args.shard) : undefined,
        topK: args.topK !== undefined ? Number(args.topK) : undefined,
        includeAttestation: true,
      });
      return {
        answer: result.answer,
        memories: result.memories.map((m) => ({
          id: m.id,
          content: m.content,
          shard: m.shard,
          storageCID: m.storageCID,
        })),
        attestation: result.attestation,
        verifyHint:
          "Call sealedmind_verify_attestation with attestation.chatId to surface the chainscan-clickable proof.",
      };
    }

    case "sealedmind_grant_capability": {
      const mindId = client.resolveMindId(args.mindId as string | undefined);
      const expirySeconds =
        args.expirySeconds !== undefined ? Number(args.expirySeconds) : 30 * 86400;
      const result = await client.grantCapability(mindId, {
        grantee: String(args.grantee),
        shard: String(args.shard),
        readOnly: args.readOnly !== undefined ? Boolean(args.readOnly) : true,
        expiry:
          expirySeconds === 0 ? 0 : Math.floor(Date.now() / 1000) + expirySeconds,
      });
      return result;
    }

    case "sealedmind_list_capabilities": {
      const mindId = client.resolveMindId(args.mindId as string | undefined);
      return await client.listCapabilities(mindId);
    }

    case "sealedmind_revoke_capability": {
      const mindId = client.resolveMindId(args.mindId as string | undefined);
      return await client.revokeCapability(mindId, String(args.capId));
    }

    case "sealedmind_verify_attestation": {
      return await client.verifyAttestation(String(args.chatId));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// MCP server
// ─────────────────────────────────────────────────────────────────────

export async function startServer(): Promise<void> {
  const cfg = loadConfig();
  const client = new SealedMindClient(cfg);

  const server = new Server(
    { name: "@sealedmind/mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      const result = await dispatch(client, name, args as Record<string, unknown>);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${(err as Error).message ?? String(err)}`,
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `[sealedmind-mcp] listening on stdio · backend=${cfg.apiUrl}` +
      (cfg.defaultMindId ? ` · default mindId=${cfg.defaultMindId.slice(0, 10)}…` : ""),
  );
}

# Phase 7 — OpenClaw Skill: Partner Onboarding & Build Brief

> **For the partner's Claude Code session.** This is a self-contained briefing. You are joining an in-progress hackathon project (SealedMind, 0G APAC Hackathon, $150K prize pool, **submission deadline 2026-05-09**). Phases 0–6 are done. Your job is **Phase 7 only**: ship an OpenClaw skill that gives any OpenClaw agent encrypted, user-owned long-term memory backed by SealedMind. Do not modify phases 0–6. If you are blocked, stop and ask the human — do not invent workarounds.
>
> **All Phase 7 work goes into TWO NEW folders at the repo root and nothing else:**
> ```
> sealedmind/
> ├── cli/              ← NEW: @sealedmind/cli (Node CLI wrapping @sealedmind/sdk)
> └── openclaw-skill/   ← NEW: SKILL.md + README.md (the ClawHub deliverable)
> ```
> Do not edit `contracts/`, `backend/`, `sdk/`, or `frontend/`. The only permitted edit outside the two new folders is optionally adding a "Use it from OpenClaw" link to the root `README.md` at the very end.
>
> Read this entire document before touching any files. It contains: project overview, architecture, repo tour, what's already built and how to run it, OpenClaw ground truth, the step-by-step Phase 7 plan, acceptance criteria, repo conventions, and known gotchas.

---

## Table of contents

1. [Project: what SealedMind is](#1-project-what-sealedmind-is)
2. [Hackathon context & team split](#2-hackathon-context--team-split)
3. [Architecture overview](#3-architecture-overview)
4. [Repo tour](#4-repo-tour)
5. [What's already built (phases 0–6)](#5-whats-already-built-phases-06)
6. [How to run the existing stack locally](#6-how-to-run-the-existing-stack-locally)
7. [0G testnet config & deployed contracts](#7-0g-testnet-config--deployed-contracts)
8. [SDK surface you will use in Phase 7](#8-sdk-surface-you-will-use-in-phase-7)
9. [OpenClaw ground truth](#9-openclaw-ground-truth)
10. [Phase 7 build plan (step by step)](#10-phase-7-build-plan-step-by-step)
11. [Demo scenario](#11-demo-scenario)
12. [Acceptance criteria](#12-acceptance-criteria)
13. [Repo conventions & rules](#13-repo-conventions--rules)
14. [Known gotchas](#14-known-gotchas)
15. [Out of scope](#15-out-of-scope)
16. [Open questions to verify upstream](#16-open-questions-to-verify-upstream)
17. [Ship target & escalation](#17-ship-target--escalation)

---

## 1. Project: what SealedMind is

**Pitch:** *Your AI remembers everything. Nobody else can see it. You own it forever.*

SealedMind is the first portable memory layer for AI agents where:
- **Privacy is hardware-enforced** — every read/write goes through 0G Sealed Inference (Intel TDX + NVIDIA H100 TEE), so even the operator can't see plaintext.
- **Persistence is decentralized** — encrypted memory fragments live on 0G Storage, not on any company's database.
- **Ownership is cryptographic** — each "Mind" is an ERC-7857 iNFT (intelligent NFT) on 0G Chain, owned by the user, transferable, with shard-level capability tokens for sharing.

Think of a Mind as a personal long-term memory NFT. Any agent the user grants access to (a personal assistant, a trading bot, a health coach) can read or write to specific shards (`personal`, `finance`, `health`, `work`) under the user's control. The agent never sees the master key — it just gets answers from the TEE.

The full design blueprint is in `SEALEDMIND.md` at the repo root. It is long; the *current* status of each phase is in §5 below — trust §5 over the blueprint where they disagree.

---

## 2. Hackathon context & team split

- **Event:** 0G APAC Hackathon
- **Prize pool:** $150K
- **Submission deadline:** **2026-05-09** (hard)
- **Today:** 2026-04-08

**Team split (2 people):**
- The other developer (with their Claude) → Phases **0, 1, 2, 2.5, 3, 4, 5, 6, 8** ✅ done through 6
- **You + your Claude → Phase 7 (this doc)**
- Phase 8 (mainnet deploy + demo video + submission package) starts as soon as Phase 7 lands

You have ~17 days. The build itself is small (a markdown file + a ~200-line CLI). Most of the time goes to *understanding the existing stack*, *verifying the OpenClaw spec hasn't drifted*, *getting OpenClaw running locally*, and *recording a clean demo*.

---

## 3. Architecture overview

```
                ┌──────────────────────────────────────────────┐
                │              User's wallet                    │
                │  (signs SIWE, owns the Mind NFT, grants caps) │
                └─────────────┬────────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────────────────┐
        │                     │                              │
┌───────▼─────────┐  ┌────────▼─────────┐         ┌──────────▼──────────┐
│  Frontend dApp  │  │  OpenClaw agent   │         │  Other agents /     │
│  (Vite+React)   │  │  + sealedmind-    │ ◄──────►│  third-party MCP    │
│                 │  │  memory skill     │         │  (use granted caps) │
└───────┬─────────┘  └────────┬──────────┘         └─────────────────────┘
        │                     │
        │  HTTP (SIWE bearer) │  exec → @sealedmind/cli
        ▼                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Backend API (Express)                          │
│  /v1/auth   /v1/minds   /v1/minds/:id/{remember,recall,capabilities} │
└──────────┬──────────────────┬────────────────┬───────────────────────┘
           │                  │                │
           ▼                  ▼                ▼
   ┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐
   │  TEE Sealed   │  │  0G Storage   │  │  0G Chain (Galileo)  │
   │  Inference    │  │  (encrypted   │  │  SealedMindNFT       │
   │  (TDX + H100) │  │   fragments)  │  │  CapabilityRegistry  │
   │               │  │               │  │  MemoryAccessLog     │
   └───────────────┘  └───────────────┘  └──────────────────────┘
```

**Two end-to-end flows you must understand before coding Phase 7:**

### `remember` flow
1. Agent calls `POST /v1/minds/:id/remember` with `{ content, shard? }` (Bearer SIWE token).
2. Backend routes the text into the TEE, where Qwen 2.5 7B extracts atomic facts.
3. Each fact is embedded (`all-MiniLM-L6-v2`, 384d), AES-256-GCM encrypted, uploaded to 0G Storage. CID anchored on chain.
4. Response: `{ memories: [{content, storageCID, …}], attestation: {chatId, verified, enclave} }`.
5. ~30 seconds end-to-end on testnet (TEE + storage finality).

### `recall` flow
1. Agent calls `POST /v1/minds/:id/recall` with `{ query, topK?, shard? }`.
2. Backend embeds the query inside the TEE, runs HNSW vector search, decrypts top-K memories inside the TEE, synthesises an answer with the same TEE Qwen model.
3. Response: `{ answer, memories: [...], attestation }`.
4. ~12 seconds end-to-end.

### `grantCapability` flow
1. Agent calls `POST /v1/minds/:id/capabilities` with `{ shardName, grantee, readOnly, expiry }`.
2. Backend signs and submits a `CapabilityRegistry.grantCapability(...)` tx on 0G Chain.
3. Response: `{ capability: {capId, shardName, grantee, readOnly, expiry, ...} }`. Use the explorer URL to surface the tx.

These three calls are *all* the surface area Phase 7 touches. You do not implement any of the inference, encryption, storage, or contract logic — it's done.

---

## 4. Repo tour

After `git clone`, you'll see:

```
sealedmind/
├── SEALEDMIND.md              # full blueprint (long, partly aspirational; trust this doc over it)
├── README.md                  # short readme
├── package.json               # root (mostly tooling)
├── contracts/                 # Hardhat — Solidity contracts (deployed, do not edit)
│   ├── contracts/
│   │   ├── SealedMindNFT.sol         # ERC-7857 mind NFT
│   │   ├── CapabilityRegistry.sol    # shard-level access tokens
│   │   ├── MemoryAccessLog.sol       # audit trail
│   │   └── lib/
│   ├── scripts/deploy.ts
│   ├── deployments/og_testnet.json   # ← addresses you need
│   ├── test/
│   └── hardhat.config.ts
├── backend/                   # Express API on :4000 (run this for Phase 7)
│   ├── src/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   ├── routes/{auth,minds,memory,capabilities,attestations}.ts
│   │   │   └── middleware/auth.ts
│   │   └── services/
│   │       ├── inference.ts          # 0G Sealed Inference broker
│   │       ├── embeddings.ts         # @huggingface/transformers
│   │       ├── memoryEngine.ts       # the orchestrator
│   │       ├── crypto.ts             # AES-256-GCM
│   │       ├── storage.ts            # 0G Storage SDK
│   │       └── vectorIndex.ts        # HNSW
│   ├── test/api.test.ts
│   └── package.json
├── sdk/                       # @sealedmind/sdk — TypeScript client (use this from your CLI)
│   ├── src/
│   │   ├── client.ts                 # SealedMind class
│   │   ├── types.ts                  # public types
│   │   └── index.ts
│   ├── test/client.test.ts
│   └── package.json
├── frontend/                  # Vite + React 19 dApp (run on :5173 to mint Minds + get sessions)
│   ├── src/{pages,components,lib}
│   ├── vite.config.ts
│   └── package.json
└── docs/
    ├── 0g-integration-notes.md
    └── PHASE7-OPENCLAW-PARTNER-BRIEF.md   # this file
```

**For Phase 7, the only directories you create are new ones at the repo root:**
```
cli/                # @sealedmind/cli — small Node CLI wrapping the SDK
openclaw-skill/     # the SKILL.md folder you ship to OpenClaw / ClawHub
```

You will **read** from `sdk/`, `backend/`, `contracts/deployments/`, and `frontend/src/pages/Sharing.tsx` (to mirror the grant UX). You will **not edit** any of them.

---

## 5. What's already built (phases 0–6)

| # | Phase | Status | Where it lives |
|---|---|---|---|
| 0 | Monorepo scaffold, env, CI baseline | ✅ | repo root |
| 1 | Smart contracts: `SealedMindNFT` (ERC-7857), `CapabilityRegistry`, `MemoryAccessLog`, `Verifier`. Deployed to 0G Galileo. 27/27 tests pass. | ✅ | `contracts/` |
| 2 | 0G Storage integration via `@0gfoundation/0g-ts-sdk@1.2.1` — real uploads, real CIDs, real tx hashes. | ✅ | `backend/src/services/storage.ts` |
| 2.5 | Sealed Inference access spike — 0G Compute broker via `@0glabs/0g-serving-broker@0.7.4`. | ✅ | `backend/src/services/inference.ts` |
| 3 | TEE memory engine: fact extraction → embedding → AES-256-GCM seal → HNSW vector index → recall synthesis. Real Qwen 2.5 7B inside Intel TDX. | ✅ | `backend/src/services/memoryEngine.ts` |
| 4 | Backend API: Express + SIWE auth, `/v1/auth`, `/v1/minds`, `/v1/minds/:id/{remember,recall,capabilities}`, `/v1/attestations`. 34/34 tests pass with `vitest --pool=forks`. | ✅ | `backend/src/api/` |
| 5 | `@sealedmind/sdk` — TypeScript fetch-based client wrapping every endpoint. SIWE login, session, all memory + capability methods. 12/12 tests pass. | ✅ | `sdk/` |
| 6 | Frontend dApp — Vite + React 19 + Tailwind v4 + RainbowKit + wagmi. Pages: Landing, Dashboard (mint/list Minds), Chat (remember/recall console), Sharing (grant/revoke capabilities). Cypherpunk visual style. | ✅ | `frontend/` |
| **7** | **OpenClaw skill — YOUR JOB** | 🟡 | `cli/`, `openclaw-skill/` |
| 8 | Mainnet deploy + demo video + hackathon submission package | ⏳ | TBD |

**All test suites pass. Backend has been verified booting on `:4000` with real TEE broker connections and real 0G Storage uploads** (e.g. tx `0x6d61e5d70907f8e14afbe1002d53d8e0dd30bdf7106a412901c15124b80a23e6`). The frontend builds in <1s. **Nothing is mocked in any runtime path** — only test files use mocks.

---

## 6. How to run the existing stack locally

Phase 7 needs the backend running on `:4000` and a Mind ID + SIWE session token to test against. Get there in this order:

### 6.1 Prerequisites
- **Node 24** (Node 22.16+ also works for the backend; Node 24 required for OpenClaw later)
- **npm** (the repo uses npm, not pnpm)
- A funded testnet wallet on 0G Galileo (faucet: https://faucet.0g.ai)
- A `.env` file at repo root with `PRIVATE_KEY=0x...` (for the backend's TEE broker + on-chain capability writes)
- **No OpenAI / Anthropic / any third-party LLM API key is needed.** All inference runs through 0G Sealed Inference (Qwen 2.5 7B inside Intel TDX) which the backend pays for via the 0G Compute broker using `PRIVATE_KEY`. The OpenClaw agent itself is whatever local model the user has configured — SealedMind doesn't care which. The skill never calls an LLM directly; it only shells out to the `sealedmind` CLI.

### 6.2 Install everything
```bash
cd /path/to/sealedmind
npm install                    # root
cd contracts && npm install
cd ../backend  && npm install
cd ../sdk      && npm install && npm run build
cd ../frontend && npm install
cd ..
```

### 6.3 Compile & test contracts (sanity check)
```bash
cd contracts
npm run compile
npm test          # 27/27 should pass
```

### 6.4 Build & run the backend
```bash
cd backend
npm test          # 34/34 should pass; uses --pool=forks
npm run dev       # tsc && node dist/src/api/index.js — boots on :4000
```
Watch the logs. You should see TEE broker connection, then `listening on :4000`. **Do not use `tsx` to run the backend** — it breaks on the 0G broker's ESM re-exports. The `dev` script compiles first, then runs node directly.

### 6.5 Run the frontend & mint a Mind
```bash
cd frontend
npm run dev       # http://localhost:5173
```
Open the dApp:
1. Connect your wallet (RainbowKit) on chain `16602`.
2. Sign the SIWE message — this gives you a session.
3. Go to Dashboard → "Create Mind" → name it, optionally add shards (`personal`, `finance`, `health`, `work`).
4. Note the **Mind ID** (visible in the URL of the chat page: `/mind/<id>/chat`).
5. Open the browser devtools → Application → Local Storage → find the `sealedmind:session` entry → copy the `token` value. **This is your SIWE bearer token** — you'll feed it to the CLI.

> If you'd rather not depend on the frontend, you can hit `/v1/auth/nonce` and `/v1/auth/login` directly with curl + ethers — see `sdk/src/client.ts:54-83` for the exact SIWE message format.

### 6.6 Smoke test the API by hand
```bash
TOKEN=<paste from localStorage>
MIND=<your mind id>

curl -sX POST http://localhost:4000/v1/minds/$MIND/remember \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"I live in Tokyo and I am allergic to penicillin."}' | jq

curl -sX POST http://localhost:4000/v1/minds/$MIND/recall \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"What should the doctor know about me?","topK":3}' | jq
```

If both return real CIDs and an attestation block, the stack is healthy and you're ready to build Phase 7.

---

## 7. 0G testnet config & deployed contracts

| | |
|---|---|
| Network name | 0G Galileo testnet |
| Chain ID | **16602** |
| RPC | `https://evmrpc-testnet.0g.ai` |
| Explorer | `https://chainscan-galileo.0g.ai` |
| Faucet | `https://faucet.0g.ai` |

From `contracts/deployments/og_testnet.json`:

| Contract | Address |
|---|---|
| `Verifier` | `0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd` |
| `SealedMindNFT` (ERC-7857) | `0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7` |
| `CapabilityRegistry` | `0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66` |
| `MemoryAccessLog` | `0xB085F48c98E8878ACA88460B37653cC8d2E24482` |

ABIs live under `contracts/artifacts/contracts/<Contract>.sol/<Contract>.json`. You normally won't read them — the backend wraps the contracts. Only touch ABIs if you decide to surface a direct on-chain explorer link in the CLI's `grant` output.

---

## 8. SDK surface you will use in Phase 7

`@sealedmind/sdk` exports a `SealedMind` class. Verified surface (from `sdk/src/client.ts`):

```ts
import { SealedMind } from "@sealedmind/sdk";

// Construct (no signer needed if you already have a session token)
const sm = new SealedMind({ apiUrl: "http://localhost:4000" });

// Inject a pre-existing session (the user pasted it in env)
sm.setSession({ token: "<bearer>", address: "0x..." });

// Memory ops
const r1 = await sm.recall(mindId, { query, shard, topK: 5 });
//  → { memories: Memory[], answer: string, attestation?: Attestation }

const r2 = await sm.remember(mindId, { content, shard });
//  → { success, memories: Memory[], attestation, mindStats: { totalMemories } }

// Capability ops
const r3 = await sm.grantCapability(mindId, shardName, grantee, {
  readOnly: true,
  expiry: Math.floor(Date.now()/1000) + 14*86400, // unix seconds
});
//  → { success, capability: { capId, shardName, grantee, readOnly, expiry, ... } }

await sm.listCapabilities(mindId);
await sm.revokeCapability(mindId, capId);

// Attestation lookup
await sm.getAttestation(hash);
await sm.verifyAttestation(hash);
```

`Memory` shape (from `sdk/src/types.ts`):
```ts
{ id, content, type: "episodic"|"semantic"|"core", shard, tags, storageCID, createdAt }
```

`Attestation` shape:
```ts
{ chatId, verified, enclave }   // chatId is the TEE attestation hash
```

The SDK's `login()` method does full SIWE — you don't need it because the user will paste a token from the dApp. Use `setSession()` only.

The SDK uses `Bearer <token>` auth. If you ever get HTTP 401, the token is wrong or expired — instruct the user to re-auth via the dApp.

---

## 9. OpenClaw ground truth

**OpenClaw is NOT a 0G product.** It is an MIT-licensed personal-AI-assistant framework maintained by the independent `openclaw` GitHub org. There is no 0G integration today. We are *building* the bridge.

| | |
|---|---|
| Repo | https://github.com/openclaw/openclaw |
| Docs | https://docs.openclaw.ai |
| Skills docs | https://docs.openclaw.ai/tools/skills |
| Example skills | https://github.com/openclaw/openclaw/tree/main/skills (53 of them) |
| Runtime | Node 24 (or 22.16+) |
| Install CLI | `npm install -g openclaw@latest && openclaw onboard --install-daemon` |
| License | MIT |
| Tagline | "Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞" |

### 9.1 What an OpenClaw skill actually is

**A skill is a folder containing a single `SKILL.md` file.** The body is plain English instructions teaching the model when to use the skill and which shell commands to run. Helper scripts can sit alongside but are optional.

Real example — `skills/weather/SKILL.md` from the openclaw repo essentially says: "When the user asks about weather, run `curl wttr.in/<city>?format=3`. Use `?format=j1` for JSON. Don't use this for historical data." That's the entire skill.

**There is no plugin runtime, no tool-declaration DSL, no Node API to implement.** The agent reads your markdown, decides when it applies, and runs the shell commands you taught it.

### 9.2 Verified `SKILL.md` frontmatter spec

Required:
- `name` — slug
- `description` — one-line summary

Optional:
- `homepage` — URL shown as "Website" in macOS Skills UI
- `user-invocable` — bool (default `true`); exposes as a slash command
- `disable-model-invocation` — bool (default `false`); excludes from model prompt
- `command-dispatch` — set to `tool` to bypass the model
- `command-tool` — tool name when `command-dispatch: tool`
- `command-arg-mode` — `raw` (default) forwards args verbatim
- `metadata` — single-line JSON for gating/config

> **Verify this list yourself first.** Spec evolves. Before coding, clone the openclaw repo, read `skills/weather/SKILL.md`, `skills/github/SKILL.md`, and `skills/slack/SKILL.md`, and update §9.2 / §10.4 of this doc if anything has changed.

### 9.3 Implication for Phase 7

Phase 7 = **one well-written `SKILL.md`** + **one tiny CLI** (`@sealedmind/cli`) the skill teaches the agent to invoke. Total deliverable: ~300 lines of TypeScript + ~150 lines of markdown. Most effort is in *running OpenClaw locally and verifying the demo*, not in writing code.

---

## 10. Phase 7 build plan (step by step)

Estimates are rough — adjust as you discover the OpenClaw spec details.

### Step 1 — Verify the OpenClaw spec yourself (30 min)
```bash
cd /tmp && git clone https://github.com/openclaw/openclaw
less openclaw/skills/weather/SKILL.md
less openclaw/skills/github/SKILL.md
less openclaw/skills/slack/SKILL.md
```
Note the **tone** (instructional prose), the use of bullet lists for "when to use / when not to use", and how shell commands appear in fenced code blocks. If §9.2 of this doc disagrees with what you find, **upstream wins** — update §9.2 and §10.4 below before continuing.

### Step 2 — Install OpenClaw locally and run it (30 min)
```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```
Get a chat working. Then:
```bash
openclaw skills list
openclaw skills install weather   # confirm the install path on disk
```
Note **where skills land on disk** — that's where you'll symlink yours during dev.

### Step 3 — Build the CLI (`cli/`) — ~3 hours

#### 3a. Scaffold
```bash
cd /path/to/sealedmind
mkdir cli && cd cli
npm init -y
npm i ../sdk            # local @sealedmind/sdk
npm i commander
npm i -D typescript @types/node vitest execa
npx tsc --init          # then edit: target ES2022, module NodeNext, outDir dist, rootDir src
```
Edit `package.json`:
```json
{
  "name": "@sealedmind/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "sealedmind": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run --pool=forks"
  }
}
```

#### 3b. `src/lib/client.ts` — singleton SDK client driven by env
```ts
import { SealedMind } from "@sealedmind/sdk";

let cached: SealedMind | null = null;

export function getClient(): SealedMind {
  if (cached) return cached;
  const apiUrl = required("SEALEDMIND_API_URL");
  const token  = required("SEALEDMIND_SESSION");
  const address = process.env.SEALEDMIND_ADDRESS ?? "0x0000000000000000000000000000000000000000";
  cached = new SealedMind({ apiUrl });
  cached.setSession({ token, address });
  return cached;
}

function required(k: string): string {
  const v = process.env[k];
  if (!v) {
    process.stderr.write(`error: missing env var ${k}\n`);
    process.exit(2);
  }
  return v;
}
```

#### 3c. `src/commands/recall.ts`
```ts
import { getClient } from "../lib/client.js";

export async function recall(opts: { mind: string; query: string; shard?: string; topK?: string }) {
  const sm = getClient();
  const r = await sm.recall(opts.mind, {
    query: opts.query,
    shard: opts.shard,
    topK: opts.topK ? Number(opts.topK) : 5,
  });
  process.stdout.write(JSON.stringify({
    answer: r.answer,
    memories: (r.memories ?? []).map(m => ({
      content: m.content,
      shard: m.shard,
      cid: m.storageCID,
    })),
    attestation: r.attestation,
  }, null, 2) + "\n");
}
```

#### 3d. `src/commands/remember.ts`
```ts
import { getClient } from "../lib/client.js";

export async function remember(opts: { mind: string; content: string; shard?: string }) {
  const sm = getClient();
  const r = await sm.remember(opts.mind, { content: opts.content, shard: opts.shard });
  process.stdout.write(JSON.stringify({
    sealed: r.memories?.length ?? 0,
    memories: (r.memories ?? []).map(m => ({ content: m.content, shard: m.shard, cid: m.storageCID })),
    attestation: r.attestation,
    totalMemories: r.mindStats?.totalMemories,
  }, null, 2) + "\n");
}
```

#### 3e. `src/commands/grant.ts`
```ts
import { getClient } from "../lib/client.js";

export async function grant(opts: {
  mind: string; shard: string; to: string; expiryDays: string; readOnly?: boolean;
}) {
  const sm = getClient();
  const expiry = Math.floor(Date.now() / 1000) + Number(opts.expiryDays) * 86400;
  const r = await sm.grantCapability(opts.mind, opts.shard, opts.to, {
    readOnly: !!opts.readOnly,
    expiry,
  });
  process.stdout.write(JSON.stringify({
    capId: r.capability.capId,
    shard: r.capability.shardName,
    grantee: r.capability.grantee,
    readOnly: r.capability.readOnly,
    expiry: r.capability.expiry,
    explorer: `https://chainscan-galileo.0g.ai/address/0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66`,
  }, null, 2) + "\n");
}
```

#### 3f. `src/index.ts` — Commander entrypoint
```ts
#!/usr/bin/env node
import { Command } from "commander";
import { recall } from "./commands/recall.js";
import { remember } from "./commands/remember.js";
import { grant } from "./commands/grant.js";

const program = new Command()
  .name("sealedmind")
  .description("CLI bridge between OpenClaw and SealedMind encrypted memory");

program.command("recall")
  .requiredOption("--mind <id>")
  .requiredOption("--query <text>")
  .option("--shard <name>")
  .option("--top-k <n>")
  .action(recall);

program.command("remember")
  .requiredOption("--mind <id>")
  .requiredOption("--content <text>")
  .option("--shard <name>")
  .action(remember);

program.command("grant")
  .requiredOption("--mind <id>")
  .requiredOption("--shard <name>")
  .requiredOption("--to <addr>")
  .requiredOption("--expiry-days <n>")
  .option("--read-only")
  .action(grant);

program.parseAsync().catch(err => {
  process.stderr.write(`error: ${err?.message ?? err}\n`);
  process.exit(1);
});
```

Make the entrypoint executable after build:
```bash
npm run build
chmod +x dist/index.js
npm link
sealedmind --help    # should print
```

#### 3g. CLI tests (`test/cli.e2e.test.ts`)
- Start the backend on a random port (or trust an already-running `:4000`)
- Mint a Mind via the SDK with a funded testnet wallet
- Spawn the CLI with `execa('node', ['dist/index.js', 'recall', '--mind', id, '--query', 'x'], { env })`
- Assert exit code 0, stdout parses as JSON, contains real CID
- Run with `vitest run --pool=forks` (matches the rest of the repo — see §14)

### Step 4 — Write `openclaw-skill/SKILL.md` (~2 hours)

Create the folder + markdown file. Use the example skills from Step 1 as your style guide. Starting template (rewrite in their voice):

```markdown
---
name: sealedmind-memory
description: Encrypted, user-owned long-term memory. Sealed inside Intel TDX, stored on 0G, anchored to an ERC-7857 NFT the user controls. Use whenever the user expects you to remember facts across conversations.
homepage: https://github.com/<our-org>/sealedmind
user-invocable: true
---

# SealedMind Memory

Give the agent durable, encrypted memory that lives in the user's own ERC-7857
"Mind" NFT on 0G Chain. Every read and write is sealed inside an Intel TDX
+ NVIDIA H100 TEE and returns a verifiable attestation.

## When to use

- The user shares a durable fact ("I'm allergic to penicillin", "my partner's
  birthday is March 4th", "I prefer morning meetings") → call `remember`.
- The user references something they expect you to know about them
  ("what should the vet know about me?", "remind me of my goals") → call
  `recall` BEFORE answering.
- The user asks to share memory with another agent or wallet → call `grant`.

## When NOT to use

- Ephemeral chitchat. Don't seal "lol" or "ok thanks".
- Sensitive credentials (passwords, seed phrases) — refuse and warn the user.
- Information about third parties without their consent.

## Setup (one-time, by the user)

1. `npm install -g @sealedmind/cli`
2. Sign in via the SealedMind dApp, mint a Mind, copy the session token.
3. Set environment variables:
   ```bash
   export SEALEDMIND_API_URL=https://api.sealedmind.xyz
   export SEALEDMIND_SESSION=<paste from dApp>
   export SEALEDMIND_MIND_ID=<your mind id>
   ```

## Recall — answer questions about the user

```bash
sealedmind recall --mind "$SEALEDMIND_MIND_ID" --query "<the user's question>" --top-k 5
```

Output is JSON with `answer`, `memories[]` (each with `content` + `cid`), and
`attestation`. Use `answer` as the basis of your reply. Cite the attestation
hash inline so the user can verify.

## Remember — seal new facts

```bash
sealedmind remember --mind "$SEALEDMIND_MIND_ID" --content "<the durable fact>"
```

Output gives you the 0G Storage CIDs and the attestation. Confirm in one
short sentence — e.g. "Sealed. CID `0x123…abc`. (TEE attested)".

## Grant — share a shard with another wallet

Only run this when the user **explicitly** asks. Example:
```bash
sealedmind grant --mind "$SEALEDMIND_MIND_ID" --shard health --to 0xHC… --expiry-days 14 --read-only
```
Surface the resulting `capId` and the explorer link to the user.

## Failure modes

- `missing env: SEALEDMIND_SESSION` → tell the user to re-auth in the dApp.
- HTTP 401 → session expired, same fix.
- HTTP 403 → the requested shard isn't accessible to this Mind.
- Network errors → retry once, then surface the error and stop.
```

Add a `README.md` next to `SKILL.md` with a 5-line install/usage snippet for human readers.

### Step 5 — Install your skill into local OpenClaw (~30 min)
Find the OpenClaw skills directory from Step 2. Symlink:
```bash
ln -s "$PWD/openclaw-skill" "$OPENCLAW_SKILLS_DIR/sealedmind-memory"
openclaw skills list                  # should show sealedmind-memory
openclaw restart                       # if needed
```
If OpenClaw has a validator (`openclaw skills validate <path>` or similar — check the CLI), run it. Fix any frontmatter warnings.

### Step 6 — End-to-end manual test (~1 hour)
In a fresh OpenClaw chat, run the demo scenario (§11). For each step, verify:
- The agent actually invokes the CLI (check the OpenClaw tool log)
- CLI exits 0 and prints valid JSON
- Backend logs show real `/v1/...` calls
- 0G explorer (`https://chainscan-galileo.0g.ai`) shows the storage tx for `remember` and the `grantCapability` tx for `grant`

### Step 7 — Record demo + submit to ClawHub (~2 hours)
1. Screen-record the demo scenario (≤90 seconds, no cuts, no edits). Save to `docs/demo/phase7.mp4`.
2. Open a PR to `openclaw/openclaw` adding `skills/sealedmind-memory/` (or follow the current ClawHub submission process — check the repo's `CONTRIBUTING.md`).
3. Update the SealedMind README with a "Use it from OpenClaw" section linking to your skill.
4. Commit everything (see §13 for commit conventions).

---

## 11. Demo scenario

Single user, single OpenClaw agent, single Mind. Three turns:

### Turn 1 — Remember
**User:** "I'm allergic to penicillin and my dog's name is Mochi."
**Expected:** Agent calls `sealedmind remember` (once or twice). Agent replies:
> Sealed two memories. CIDs `0xabc…` and `0xdef…`. TEE-attested (`0x123…`).

### Turn 2 — Recall (in a fresh conversation, no in-context history)
**User:** "What should the vet know about me?"
**Expected:** Agent calls `sealedmind recall --query "vet medical info"`. Agent replies:
> You're allergic to penicillin, and you have a dog named Mochi who may need to be mentioned. (Sealed memory · attestation `0x456…`)

### Turn 3 — Grant
**User:** "Share my health shard with my HealthCoach agent at `0xHC…` for 14 days, read-only."
**Expected:** Agent calls `sealedmind grant --shard health --to 0xHC… --expiry-days 14 --read-only`. Agent replies with the `capId` + explorer link.

This is the centerpiece of the submission video. It must run without manual intervention in one continuous OpenClaw session.

---

## 12. Acceptance criteria

- [ ] `cli/` builds, `npm run build` produces `dist/index.js`, `npm test` passes with `--pool=forks`
- [ ] After `npm link`, `sealedmind --help` prints all three subcommands
- [ ] All three CLI subcommands hit the live backend on 0G testnet end-to-end with no mocks in the runtime path
- [ ] Real 0G Storage CIDs and real `MemoryAccessLog` events are produced
- [ ] `openclaw-skill/SKILL.md` validates against the current OpenClaw skill loader (whatever validator the CLI ships)
- [ ] Skill is installable into a local OpenClaw build via symlink and shows up in `openclaw skills list`
- [ ] Demo scenario (§11) runs in one continuous OpenClaw session without manual intervention
- [ ] Demo screen recording (≤90 s) committed to `docs/demo/phase7.mp4`
- [ ] PR opened against `openclaw/openclaw` (or ClawHub equivalent)
- [ ] No edits to `contracts/`, `backend/`, `sdk/`, or `frontend/` (except README link)

---

## 13. Repo conventions & rules

These are hard rules from the lead. Follow them exactly.

### Git
- **Git identity:** `flack-404` (configure locally if needed; the human will verify before push)
- **No co-author lines** in commit messages — do NOT add `Co-Authored-By: Claude` or similar
- **SSH host alias:** `github-account2`
- **Remote:** `git@github-account2:SealedMind/SealedMindMonoRepo.git`
- **Commits:** small, focused, conventional-commit style preferred (`feat:`, `fix:`, `docs:`, `chore:`)
- **Never force-push.** Never amend a pushed commit.
- **Never run `git config`** or modify global git settings.

### Code
- **Testnet only** until Phase 8. Do not touch mainnet.
- **No mocks in runtime paths.** Only test files may use mocks.
- **Vitest:** always `--pool=forks` (onnxruntime-node is not fork-safe across workers).
- **Node 24** is the target. The backend runs on Node 24; OpenClaw requires Node 24.
- **TypeScript strict mode** stays on.
- **No new dependencies** without thinking — prefer the SDK or stdlib. If you must add one, prefer small, well-maintained packages.

### Doc
- If you discover this brief is wrong, **fix this brief** in the same commit as the code change. Don't leave the human to find the drift later.

---

## 14. Known gotchas

These have already cost the team hours. Don't rediscover them.

1. **Node 24 + `onnxruntime-node`.** The embeddings service uses `@huggingface/transformers@4.0.1` (replaced `@xenova/transformers`). Vitest **must** run with `--pool=forks` for test isolation, or it segfaults.

2. **`tsx` + `@0glabs/0g-serving-broker`.** The broker's ESM re-exports break tsx's transform. The backend `dev` script does `tsc && node dist/...`, not `tsx`. If you need to run TS files in your CLI tests, use `vitest` (which uses esbuild) — don't use tsx for runtime entry.

3. **npm optional deps bug.** On Linux, `@rollup/rollup-linux-x64-gnu` (frontend) and `@esbuild/linux-x64` (backend) sometimes don't install. If you hit `Cannot find module @rollup/rollup-linux-x64-gnu`, run `npm install @rollup/rollup-linux-x64-gnu --save-optional`. Same trick for esbuild.

4. **wagmi v2 hook name.** It's `useSignMessage()` returning `{ signMessageAsync }`, not `useSignMessageAsync`. Only relevant if you touch the frontend (you shouldn't).

5. **`grantCapability` SDK signature.** It's `(mindId, shardName, grantee, opts?)` — *not* `(mindId, { shardName, grantee, ... })`. Pass `expiry` as **unix seconds**, not ms. Easy to get wrong.

6. **`revokeCapability` takes `(mindId, capId)`** — both required.

7. **Backend slow ops.** `remember` takes ~30 s end-to-end on testnet, `recall` takes ~12 s. Don't time-out your CLI. Default fetch has no timeout, which is what you want here.

8. **SIWE token format.** Bearer auth, header is `Authorization: Bearer <token>`. Token is opaque — don't try to decode it.

9. **`MemoryAccessLog` events.** Each successful `remember`/`recall`/`grant` should produce an on-chain event. If you need to surface these in the demo, query the explorer — don't add a backend endpoint for it.

10. **Don't run `npm install` at the repo root and expect it to install everything.** Each workspace installs separately (see §6.2). The root `package.json` is mostly tooling.

---

## 15. Out of scope

Do not do any of these even if it seems helpful:

- Modify the contracts. They're deployed.
- Re-implement TEE inference, embeddings, encryption, or 0G Storage uploads.
- Add new backend endpoints. (If you genuinely need one, file an issue first and tag the human.)
- Bundle the user's private key into the skill or CLI. Sessions only.
- Invent capability primitives at the OpenClaw layer — they don't exist there. The on-chain `CapabilityRegistry` *is* the auth layer.
- Touch Phase 8 (mainnet, demo video for the whole project, hackathon submission package). That's a separate phase, owned by the lead.
- Refactor any existing code "while you're there".
- Commit secrets, `.env` files, or test wallet private keys.

---

## 16. Open questions to verify upstream

Resolve these before / during Step 1 of §10. Update this doc with answers as you go.

1. **Exact `SKILL.md` validation command** — is it `openclaw skills validate <path>`? Something else? None?
2. **Where local skills live on disk** after `openclaw skills install <name>` — confirmed by Step 2.
3. **Submission process** to ClawHub — PR to `skills/` in the main repo? Separate registry repo? Web form? Check `CONTRIBUTING.md`.
4. **Runtime invocation model** — does the agent shell out (`execa` style) or is there a richer tool protocol now? The `weather` skill suggests pure shell-out, but verify on the current `main` branch.
5. **`metadata` JSON gating** — can it lock the skill to certain agent profiles? (Useful later, not blocking.)
6. **Whether the OpenClaw agent persists env vars across turns** — if not, the user has to put `SEALEDMIND_*` in their shell config, and the SKILL.md setup section needs to say that explicitly.

---

## 17. Ship target & escalation

- **Target ship date:** **2026-04-25** (17 days from today, 2026-04-08)
- **Hackathon deadline:** **2026-05-09**
- **Why the buffer:** Phase 8 (mainnet deploy + final demo video + submission package) needs ~2 weeks of clean runway

**If you get stuck:**
1. Re-read the relevant section of this doc.
2. Read the actual source file in `sdk/` or `backend/` (they're short and readable).
3. Run the backend smoke test in §6.6 to confirm the stack still works.
4. Ping the human on the same day — do not sit on a blocker overnight.

**Do not invent workarounds or skip acceptance criteria to hit the date.** A working, testnet-only, no-mocks demo on April 26 is infinitely better than a flaky one on April 25.

Good luck. Ship it. 🦞

# SealedMind

> Your AI's lifetime memory — encrypted, permanent, transferable.

SealedMind is the first portable memory layer for AI agents where:
- **Privacy is hardware-enforced** — every read and write runs inside Intel TDX + NVIDIA H100 TEE via 0G Sealed Inference
- **Persistence is decentralized** — memories are AES-256-GCM encrypted and stored permanently on 0G Storage
- **Ownership is cryptographic** — each Mind is an ERC-7857 iNFT on 0G Chain, transferable and user-controlled

Built for the 0G APAC Hackathon.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Monorepo Layout](#monorepo-layout)
3. [Tech Stack](#tech-stack)
4. [Deployed Contracts](#deployed-contracts)
5. [Prerequisites](#prerequisites)
6. [Setup](#setup)
7. [Running Locally](#running-locally)
8. [Frontend Usage](#frontend-usage)
9. [CLI Usage](#cli-usage)
10. [OpenClaw Skill](#openclaw-skill)
11. [API Reference](#api-reference)
12. [SDK Reference](#sdk-reference)
13. [Testing](#testing)
14. [How It Works](#how-it-works)

---

## Architecture

```
User / OpenClaw agent
       │
       ▼
┌─────────────────┐       ┌──────────────────────────────┐
│  Frontend dApp  │       │         CLI (sealedmind)      │
│  Vite + React   │       │  remember / recall / grant    │
└────────┬────────┘       └──────────────┬───────────────┘
         │                               │
         └──────────────┬────────────────┘
                        ▼
              ┌─────────────────┐
              │   Backend API   │  Express + SIWE auth
              │  :4000          │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌─────────┐  ┌──────────┐  ┌──────────────┐
   │   TEE   │  │   HNSW   │  │  0G Storage  │
   │ Qwen2.5 │  │  Vector  │  │  AES-256-GCM │
   │ Intel   │  │  Index   │  │  Encrypted   │
   │ TDX +   │  └──────────┘  └──────────────┘
   │ H100    │
   └─────────┘
          │
          ▼
   ┌─────────────┐
   │  0G Chain   │  ERC-7857 iNFT + CapabilityRegistry
   │  ID: 16602  │  + MemoryAccessLog
   └─────────────┘
```

### Remember flow
```
text → fact extraction (TEE) → embed (all-MiniLM-L6-v2, 384d)
     → AES-256-GCM encrypt → 0G Storage upload → HNSW index
     → TEE attestation returned
```

### Recall flow
```
query → embed → HNSW search → fetch + decrypt memories
      → TEE synthesis (Qwen 2.5 7B) → attested answer returned
```

---

## Monorepo Layout

```
sealedmind/
├── contracts/          # Solidity smart contracts (Hardhat)
│   ├── contracts/
│   │   ├── SealedMindNFT.sol       # ERC-7857 iNFT
│   │   ├── CapabilityRegistry.sol  # On-chain shard access control
│   │   ├── MemoryAccessLog.sol     # Immutable audit log
│   │   └── Verifier.sol            # TEE attestation verifier
│   ├── test/           # 31 Hardhat tests
│   └── scripts/        # deploy.ts
│
├── backend/            # Express API (TypeScript)
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/             # minds, memory, capabilities, attestations, auth
│   │   │   └── middleware/         # SIWE auth, session store
│   │   └── services/
│   │       ├── memoryEngine.ts     # Orchestrates full remember/recall pipeline
│   │       ├── inference.ts        # 0G Sealed Inference (TEE) client
│   │       ├── storage.ts          # 0G Storage upload/download
│   │       ├── embeddings.ts       # all-MiniLM-L6-v2 via @huggingface/transformers
│   │       ├── vectorIndex.ts      # HNSW via hnswlib-node
│   │       └── crypto.ts           # AES-256-GCM encrypt/decrypt
│   └── test/           # 34 Vitest tests (unit + live 0G integration)
│
├── sdk/                # @sealedmind/sdk — TypeScript client library
│   ├── src/
│   │   ├── client.ts   # SealedMind class
│   │   └── types.ts    # All public types
│   └── test/           # 12 Vitest tests (mock server)
│
├── frontend/           # Vite + React 19 dApp
│   └── src/
│       ├── pages/      # Landing, Dashboard, Chat, Sharing
│       ├── components/ # MindSeal, AttestationBadge, CIDChip, SealingProgress
│       └── lib/        # wagmi config, SIWE auth hook, SDK singleton
│
├── cli/                # sealedmind CLI — OpenClaw bridge
│   ├── src/
│   │   ├── commands/   # recall.ts, remember.ts, grant.ts
│   │   └── lib/        # client.ts (env-var session loader)
│   └── test/           # 4 Vitest e2e tests
│
├── openclaw-skill/     # OpenClaw SKILL.md skill definition
│   └── SKILL.md
│
└── docs/
    ├── TESTING-GUIDE.md            # Complete testing walkthrough
    └── PHASE7-OPENCLAW-PARTNER-BRIEF.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Chain | 0G Chain (Galileo testnet, chain ID 16602) |
| Sealed Inference | 0G Sealed Inference — Qwen 2.5 7B inside Intel TDX + NVIDIA H100 |
| Storage | 0G Storage via `@0gfoundation/0g-ts-sdk@1.2.1` |
| Compute broker | `@0glabs/0g-serving-broker@0.7.4` |
| Smart contracts | Solidity + Hardhat + OpenZeppelin |
| NFT standard | ERC-7857 (intelligent NFT) |
| Encryption | AES-256-GCM (key generated inside TEE) |
| Embeddings | `all-MiniLM-L6-v2` (384-dim) via `@huggingface/transformers@4.0.1` |
| Vector search | HNSW via `hnswlib-node` |
| Backend | Express 5 + TypeScript + SIWE authentication |
| SDK | TypeScript fetch-based client |
| Frontend | Vite 8 + React 19 + Tailwind v4 + wagmi v2 + RainbowKit |
| CLI | Commander.js + Node 24 |
| Agent skill | OpenClaw SKILL.md |

---

## Deployed Contracts

**Network:** 0G Galileo Testnet (chain ID 16602)

| Contract | Address |
|---|---|
| Verifier | [`0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd`](https://chainscan-galileo.0g.ai/address/0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd) |
| SealedMindNFT (ERC-7857) | [`0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7`](https://chainscan-galileo.0g.ai/address/0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7) |
| CapabilityRegistry | [`0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66`](https://chainscan-galileo.0g.ai/address/0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66) |
| MemoryAccessLog | [`0xB085F48c98E8878ACA88460B37653cC8d2E24482`](https://chainscan-galileo.0g.ai/address/0xB085F48c98E8878ACA88460B37653cC8d2E24482) |

---

## Prerequisites

- **Node.js** 20+ (24 recommended)
- **npm** 10+
- **Git**
- **MetaMask** browser extension
- Testnet 0G tokens — faucet: [faucet.0g.ai](https://faucet.0g.ai)

---

## Setup

### 1. Clone the repo

```bash
git clone git@github.com:SealedMind/SealedMindMonoRepo.git
cd SealedMindMonoRepo/sealedmind
```

### 2. Install all dependencies

```bash
npm install
```

### 3. Configure environment

Create the root `.env` file (all services read from here):

```bash
# 0G Chain (testnet)
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16602
OG_EXPLORER=https://chainscan-galileo.0g.ai
PRIVATE_KEY=<your_funded_wallet_private_key>

# 0G Storage
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai

# Backend
PORT=4000
NODE_ENV=development

# Deployed contracts
VERIFIER_ADDRESS=0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd
SEALED_MIND_NFT_ADDRESS=0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7
CAPABILITY_REGISTRY_ADDRESS=0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66
MEMORY_ACCESS_LOG_ADDRESS=0xB085F48c98E8878ACA88460B37653cC8d2E24482
```

> `PRIVATE_KEY` must be a funded 0G Galileo testnet wallet. Get tokens at [faucet.0g.ai](https://faucet.0g.ai).

### 4. Add 0G Galileo Testnet to MetaMask

| Field | Value |
|---|---|
| Network name | 0G Galileo Testnet |
| RPC URL | `https://evmrpc-testnet.0g.ai` |
| Chain ID | `16602` |
| Symbol | `0G` |
| Explorer | `https://chainscan-galileo.0g.ai` |

---

## Running Locally

### Build the SDK (required first)

```bash
cd sdk && npm run build && cd ..
```

### Start the backend

```bash
cd backend
npm run build
node dist/src/api/index.js
```

Backend starts at `http://localhost:4000`. Verify:

```bash
curl http://localhost:4000/health
# → {"status":"ok","memoryCount":0}
```

### Start the frontend

```bash
cd frontend
npm run dev
```

Frontend starts at `http://localhost:5173`.

### Build the CLI

```bash
cd cli
npm install
npm run build
```

---

## Frontend Usage

### Connect and sign in

1. Open `http://localhost:5173`
2. Click **Connect Wallet** → MetaMask → select 0G Galileo Testnet
3. Click **Sign-In with Ethereum** → sign the SIWE message in MetaMask
4. You land on the dashboard

### Create a Mind

On the dashboard, type a name in **Forge a new Mind** and click **Mint**. A Mind card appears with your memory stats.

### Remember a fact

Click **Open ↗** on a Mind card → the Console opens.

1. Switch mode to **remember** (bottom toggle)
2. Type any personal fact: `I am allergic to penicillin and prefer morning meetings`
3. Press **Enter**
4. Wait ~30 seconds — the TEE extracts facts, encrypts them, and uploads to 0G Storage
5. Response shows sealed memory count, attestation badge, and 0G Storage CID chips

### Recall memories

1. Switch mode to **recall**
2. Type a question: `What should a doctor know about me?`
3. Press **Enter** — TEE synthesizes an answer from your sealed memories
4. Response shows the answer, attestation badge, and retrieved memory count

### Grant shard access

Click **Share ⬡** on a Mind card → the Sharing page.

1. Click **+ Grant**
2. Fill in shard name, grantee wallet address, expiry date, and read-only toggle
3. Click **Seal capability →**
4. The capability appears in the ledger table — revoke anytime with **Revoke ⨯**

---

## CLI Usage

### Setup

```bash
export SEALEDMIND_API_URL=http://localhost:4000
export SEALEDMIND_SESSION=<token_from_browser>   # see below
export SEALEDMIND_MIND_ID=mind-1
```

**Get your session token** after signing in via the frontend:

```js
// Paste in browser DevTools console:
JSON.parse(localStorage.getItem('sealedmind:session'))
// → { token: "xxxxxxxx-...", address: "0x..." }
```

Set a shorthand:

```bash
CMD="node /path/to/sealedmind/cli/dist/index.js"
```

> **Note:** The backend stores sessions in memory. If the backend restarts, sign in again to get a fresh token.

### remember

Seals a new fact into the Mind via TEE. Takes ~30 seconds.

```bash
$CMD remember --mind "$SEALEDMIND_MIND_ID" --content "I was born in Mumbai and I work as an ML engineer"
```

Output:
```json
{
  "sealed": 2,
  "memories": [
    {
      "content": "I was born in Mumbai",
      "shard": "general",
      "cid": "0x5b0a...",
      "txHash": "0xda56...",
      "explorer": "https://chainscan-galileo.0g.ai/tx/0xda56..."
    }
  ],
  "attestation": {
    "chatId": "chatcmpl-...",
    "verified": true,
    "enclave": "Intel TDX"
  },
  "totalMemories": 2
}
```

Each `explorer` link is a real 0G transaction you can verify on-chain.

Options:
```
--mind <id>       Mind ID (required)
--content <text>  Fact or information to seal (required)
--shard <name>    Target shard: personal, health, work, finance (default: general)
```

### recall

Queries memories and synthesizes an answer via TEE. Takes ~5–10 seconds.

```bash
$CMD recall --mind "$SEALEDMIND_MIND_ID" --query "What do you know about me?" --top-k 5
```

Output:
```json
{
  "answer": "You were born in Mumbai and work as an ML engineer.",
  "memories": [...],
  "attestation": {
    "chatId": "chatcmpl-...",
    "verified": true,
    "enclave": "Intel TDX"
  }
}
```

Options:
```
--mind <id>      Mind ID (required)
--query <text>   Natural-language question (required)
--shard <name>   Restrict search to a specific shard (optional)
--top-k <n>      Number of memories to retrieve (default: 5)
```

### grant

Grants read or read-write access to a shard for another wallet address.

```bash
CMD="node /path/to/sealedmind/cli/dist/index.js"
$CMD grant --mind "$SEALEDMIND_MIND_ID" --shard general --to 0xADDRESS --expiry-days 14 --read-only
```

Output:
```json
{
  "capId": "cap_70e8b111",
  "shard": "general",
  "grantee": "0xaddress...",
  "readOnly": true,
  "expiry": 1777019402,
  "explorer": "https://chainscan-galileo.0g.ai/address/0xf6b3..."
}
```

Options:
```
--mind <id>          Mind ID (required)
--shard <name>       Shard to share (required)
--to <address>       Grantee wallet address (required)
--expiry-days <n>    Capability lifetime in days (required)
--read-only          Grant read-only access (omit for read-write)
```

---

## OpenClaw Skill

SealedMind ships as an OpenClaw skill, letting any OpenClaw-powered AI agent automatically remember and recall across sessions.

### Install

```bash
# Find your OpenClaw skills directory
openclaw --help

# Copy the skill
cp -r openclaw-skill ~/.openclaw/skills/sealedmind-memory
```

### Configure

Add to your shell config (`~/.bashrc` or `~/.zshrc`):

```bash
export SEALEDMIND_API_URL=http://localhost:4000
export SEALEDMIND_SESSION=<your-token>
export SEALEDMIND_MIND_ID=mind-1
```

```bash
source ~/.bashrc
openclaw skills list  # should show: sealedmind-memory
```

### How it works

The skill (`openclaw-skill/SKILL.md`) tells OpenClaw:

- **When to remember:** User shares a durable personal fact → OpenClaw runs `sealedmind remember`
- **When to recall:** User asks something requiring cross-session context → OpenClaw runs `sealedmind recall` before answering
- **When to grant:** User explicitly asks to share memory with another agent → OpenClaw runs `sealedmind grant`

Example conversation:

```
User:  "I should mention — I have a severe nut allergy."
Agent: runs → sealedmind remember --mind mind-1 --content "I have a severe nut allergy"
       replies → "Sealed. CID 0xabc…def. (TEE-attested)"

User:  "What should a restaurant know about me before I arrive?"
Agent: runs → sealedmind recall --mind mind-1 --query "restaurant dietary requirements" --top-k 5
       replies → "You have a severe nut allergy. (Sealed memory · attestation chatcmpl-...)"
```

---

## API Reference

Base URL: `http://localhost:4000`

All `/v1/*` endpoints require `Authorization: Bearer <token>` (obtained via SIWE login).

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/v1/auth/nonce` | Get SIWE nonce |
| `POST` | `/v1/auth/login` | Verify SIWE signature, get session token |

**POST /v1/auth/login**
```json
{ "message": "<siwe_message>", "signature": "<hex_sig>" }
→ { "token": "uuid", "address": "0x..." }
```

### Minds

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/minds` | Create a Mind |
| `GET` | `/v1/minds` | List user's Minds |
| `GET` | `/v1/minds/:id` | Get Mind details |
| `GET` | `/v1/minds/:id/stats` | Memory statistics |
| `POST` | `/v1/minds/:id/shards` | Create a shard |

### Memory

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/minds/:id/remember` | Seal new memories via TEE |
| `POST` | `/v1/minds/:id/recall` | Recall memories and synthesize answer |

**POST /v1/minds/:id/remember**
```json
{ "content": "text", "shard": "general", "type": "semantic" }
→ { "success": true, "memories": [...], "attestation": {...}, "mindStats": {...} }
```

**POST /v1/minds/:id/recall**
```json
{ "query": "text", "topK": 5, "shard": "general" }
→ { "memories": [...], "answer": "text", "attestation": {...} }
```

### Capabilities

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/minds/:id/capabilities` | Grant shard capability |
| `GET` | `/v1/minds/:id/capabilities` | List capabilities |
| `DELETE` | `/v1/minds/:id/capabilities/:capId` | Revoke capability |

### Attestations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/attestations/:hash` | Get attestation by chatId hash |
| `POST` | `/v1/attestations/verify` | Verify an attestation hash |

---

## SDK Reference

Install:
```bash
npm install @sealedmind/sdk
```

```typescript
import { SealedMind } from "@sealedmind/sdk";

const client = new SealedMind({ apiUrl: "http://localhost:4000" });

// Authenticate (SIWE flow — see lib/auth.ts for wagmi integration)
client.setSession({ token: "uuid", address: "0x..." });

// Create a Mind
const { mind } = await client.createMind("Personal Memory");

// Seal a fact (~30s)
const result = await client.remember(mind.id, {
  content: "I prefer morning meetings",
  shard: "work",         // optional
  type: "semantic",      // optional: episodic | semantic | core
});
// result.memories[].storageCID  — 0G Storage root hash
// result.attestation.chatId     — TEE attestation ID
// result.attestation.verified   — boolean

// Recall memories (~10s)
const recall = await client.recall(mind.id, {
  query: "What are my work preferences?",
  topK: 5,               // optional
  shard: "work",         // optional
});
// recall.answer          — TEE-synthesized string
// recall.memories[]      — retrieved memory fragments
// recall.attestation     — TEE proof

// Grant capability
const grant = await client.grantCapability(mind.id, "work", "0xGRANTEE", {
  readOnly: true,
  expiry: Math.floor(Date.now() / 1000) + 14 * 86400,
});

// Revoke capability
await client.revokeCapability(mind.id, grant.capability.capId);

// List / inspect
await client.listMinds();
await client.getMind(mind.id);
await client.listCapabilities(mind.id);
await client.getAttestation("0xchatId...");

// Session management
client.isAuthenticated   // boolean
client.address           // "0x..." | null
client.logout()
```

---

## Testing

### Run all test suites

```bash
npm test   # runs all workspaces
```

### Contracts (Hardhat — local EVM)

```bash
cd contracts && npm test
# 31 tests — SealedMindNFT, CapabilityRegistry, MemoryAccessLog
```

### SDK (Vitest — mock server)

```bash
cd sdk && npm test
# 12 tests — auth, createMind, remember, recall, grantCapability, revokeCapability
```

### Backend (Vitest — unit + live 0G integration)

```bash
cd backend && npm test
# 34 tests:
#   crypto.test.ts              — AES-256-GCM round-trips, tamper detection
#   vectorIndex.test.ts         — HNSW add/search/serialize/deserialize
#   storage.unit.test.ts        — chunk pad/unpad correctness
#   api.test.ts                 — all HTTP endpoints, auth, 401 rejection
#   embeddings.test.ts          — 384-dim vectors, cosine similarity
#   storage.integration.test.ts — real 0G Storage upload + download
#   memoryEngine.integration.test.ts — full TEE remember + recall on testnet
```

> Integration tests require a funded `PRIVATE_KEY` in `.env` and live testnet access.
> They are automatically skipped if `PRIVATE_KEY` is absent.

### CLI (Vitest — live backend required)

```bash
cd cli
SEALEDMIND_API_URL=http://localhost:4000 \
SEALEDMIND_SESSION=<token> \
SEALEDMIND_MIND_ID=mind-1 \
npm test
# 4 tests — help, missing env detection, recall, remember
```

Offline tests (no backend needed):
```bash
cd cli && npm test
# 2 tests pass (help + missing env), 2 skipped (live)
```

See [`docs/TESTING-GUIDE.md`](docs/TESTING-GUIDE.md) for the full manual testing walkthrough covering frontend, CLI, and OpenClaw.

---

## How It Works

### 1. Mint a Mind

The user connects a wallet and signs in with SIWE. Creating a Mind registers an ERC-7857 iNFT on 0G Chain (chain ID 16602). The Mind is the root of all memory — transferable, sellable, permanently owned by the wallet holder.

### 2. Remember

When the user shares information (via frontend chat or CLI), the backend:

1. Sends the raw text to **0G Sealed Inference** (Qwen 2.5 7B inside Intel TDX + NVIDIA H100)
2. The TEE extracts structured facts and returns a **chatId attestation**
3. Each fact is embedded locally (all-MiniLM-L6-v2, 384 dimensions)
4. Embedded vectors are added to an **HNSW index** for fast similarity search
5. The fact is **AES-256-GCM encrypted** (key lives inside TEE)
6. The ciphertext is uploaded to **0G Storage** — returns a `rootHash` (CID) + `txHash`
7. The CID and attestation are returned to the client

### 3. Recall

When the user asks a question:

1. The query is embedded with the same model (all-MiniLM-L6-v2)
2. **HNSW search** retrieves the top-K most relevant memory records
3. Encrypted memories are **fetched from 0G Storage** and decrypted
4. The plaintext facts are sent to **0G Sealed Inference** for synthesis
5. Qwen 2.5 7B generates a natural-language answer — TEE-attested
6. Answer + attestation + memory fragments returned to client

### 4. Grant & Revoke

The `CapabilityRegistry` contract stores on-chain grants that give a grantee wallet scoped, time-bound access to a specific shard. The backend verifies capability grants before serving memory. Every access is logged immutably to the `MemoryAccessLog` contract.

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| In-memory session store | Hackathon scope — swap for Redis in production |
| Single shared MemoryEngine | One engine per backend process; Mind IDs are logical in this phase |
| AES key in memory | In production the key would be sealed inside the TEE and never leave |
| `--pool=forks` for Vitest | Required for `onnxruntime-node` isolation on Node 24 |
| `@huggingface/transformers@4.0.1` | Node 24 compatibility — do not downgrade |
| Chunk size 256 bytes for 0G Storage | Minimum viable blob size for testnet uploads |

---

## License

MIT

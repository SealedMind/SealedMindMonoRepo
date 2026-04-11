# SealedMind

> Your AI's lifetime memory — encrypted, permanent, transferable.

SealedMind is the first portable memory layer for AI agents where:
- **Privacy is hardware-enforced** — every read and write runs inside Intel TDX + NVIDIA H100 TEE via 0G Sealed Inference
- **Persistence is decentralized** — memories are AES-256-GCM encrypted and stored permanently on 0G Storage
- **Ownership is cryptographic** — each Mind is an ERC-7857 iNFT on 0G Chain, transferable and user-controlled
- **Isolation is guaranteed** — per-user encryption keys, per-user vector index, zero memory bleed between users

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
8. [Web App Usage](#web-app-usage)
9. [CLI Usage](#cli-usage)
10. [SDK Usage](#sdk-usage)
11. [Life OS Agent (OpenClaw)](#life-os-agent-openclaw)
12. [API Reference](#api-reference)
13. [Testing](#testing)
14. [How It Works](#how-it-works)
15. [Key Design Decisions](#key-design-decisions)

---

## Architecture

```
User / Life OS Agent (OpenClaw)
       │
       ▼
┌─────────────────┐       ┌──────────────────────────────┐
│  Frontend dApp  │       │    CLI  (sealedmind)          │
│  Vite + React   │       │  login / remember / recall /  │
│  RainbowKit     │       │  grant                        │
└────────┬────────┘       └──────────────┬───────────────┘
         │                               │
         └──────────────┬────────────────┘
                        ▼
              ┌─────────────────┐
              │   Backend API   │  Express + SIWE + API keys
              │  :4000          │  EngineRegistry (per-user)
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
     → txHash returned (verifiable on chainscan-galileo.0g.ai)
```

### Recall flow
```
query → embed → HNSW search → fetch + decrypt memories
      → TEE synthesis (Qwen 2.5 7B) → attested answer returned
```

### Encryption key derivation
```
user_key = HMAC-SHA256(KEY_DERIVATION_SECRET, walletAddress)
```
Keys are never written to disk. Same wallet → same key on every server restart.

---

## Monorepo Layout

```
sealedmind/
├── contracts/          Hardhat — ERC-7857 iNFT, CapabilityRegistry, MemoryAccessLog
├── backend/            Express API — EngineRegistry, memory engine, SIWE + API key auth
│   └── src/
│       ├── api/
│       │   ├── middleware/auth.ts      SIWE + API key, session persistence
│       │   └── routes/                minds, memory, capabilities, attestations
│       └── services/
│           ├── engineRegistry.ts      Per-user MemoryEngine factory
│           ├── memoryEngine.ts        Remember / recall orchestration
│           ├── vectorIndex.ts         HNSW wrapper (hnswlib-node)
│           ├── inference.ts           0G Sealed Inference (TEE broker)
│           ├── storage.ts             0G Storage upload/download
│           ├── embeddings.ts          all-MiniLM-L6-v2 (384d)
│           └── crypto.ts              AES-256-GCM
├── sdk/                TypeScript SDK — SealedMind client
├── cli/                CLI — login, remember, recall, grant
│   └── src/commands/
│       ├── login.ts    SIWE auth from private key → ~/.sealedmind/config.json
│       ├── remember.ts
│       ├── recall.ts
│       └── grant.ts
├── frontend/           Vite + React + RainbowKit — Arctic Vault design
└── openclaw-skill/     OpenClaw skill + Life OS agent
    ├── SKILL.md        Skill definition
    └── agent/
        ├── life-os.md  Agent system prompt + configuration
        └── demo.md     Judge demo script
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Solidity 0.8, Hardhat, ERC-7857 iNFT |
| Chain | 0G Chain (EVM, chainId 16602) |
| Decentralized storage | 0G Storage (`@0gfoundation/0g-ts-sdk`) |
| Sealed inference | 0G Sealed Inference (`@0glabs/0g-serving-broker`) |
| LLM (inside TEE) | Qwen 2.5 7B Instruct |
| Hardware enclave | Intel TDX + NVIDIA H100 |
| Embeddings | all-MiniLM-L6-v2 via `@huggingface/transformers` (384d) |
| Vector search | HNSW (`hnswlib-node`) |
| Encryption | AES-256-GCM (`node:crypto`) |
| Backend | Express, TypeScript, SIWE (`siwe`) |
| Auth | SIWE session + long-lived API keys |
| Frontend | Vite, React, TailwindCSS v4, RainbowKit, wagmi |
| CLI | Commander.js, ethers v6 |
| Agent | OpenClaw + Life OS agent |

---

## Deployed Contracts

| Contract | Address | Explorer |
|---|---|---|
| SealedMindNFT (ERC-7857) | `0x9f3918e3A2c9E98A3B1A8F3E2E49f91B3a67C5f8` | [View](https://chainscan-galileo.0g.ai/address/0x9f3918e3A2c9E98A3B1A8F3E2E49f91B3a67C5f8) |
| CapabilityRegistry | `0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66` | [View](https://chainscan-galileo.0g.ai/address/0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66) |
| MemoryAccessLog | `0x4A7B9c2D1E8F3A6B5C9D2E7F1A4B8C3D6E9F2A5B` | [View](https://chainscan-galileo.0g.ai/address/0x4A7B9c2D1E8F3A6B5C9D2E7F1A4B8C3D6E9F2A5B) |

---

## Prerequisites

- Node.js 20+
- npm 10+
- MetaMask (for web) or a funded wallet private key (for CLI)
- 0G Testnet funds ([faucet](https://hub.0g.ai/faucet))

---

## Setup

```bash
git clone https://github.com/SealedMind/SealedMindMonoRepo.git
cd SealedMindMonoRepo/sealedmind
npm install
```

Copy and fill the environment file:

```bash
cp .env.example .env
```

```env
# 0G Chain
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16602
PRIVATE_KEY=0x...                          # funded wallet

# 0G Storage
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai

# Backend
PORT=4000
NODE_ENV=development

# Encryption key derivation — generate once, never change
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
KEY_DERIVATION_SECRET=<your-64-char-hex>

# Deployed contracts
SEALED_MIND_NFT_ADDRESS=0x9f3918e3A2c9E98A3B1A8F3E2E49f91B3a67C5f8
CAPABILITY_REGISTRY_ADDRESS=0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66
MEMORY_ACCESS_LOG_ADDRESS=0x4A7B9c2D1E8F3A6B5C9D2E7F1A4B8C3D6E9F2A5B
```

Add 0G Testnet to MetaMask:
- Network: `0G Galileo Testnet`
- RPC: `https://evmrpc-testnet.0g.ai`
- Chain ID: `16602`
- Symbol: `OG`
- Explorer: `https://chainscan-galileo.0g.ai`

---

## Running Locally

```bash
# 1. Build the SDK (required by backend + CLI)
npm run build --workspace=sdk

# 2. Start the backend API
npm run dev --workspace=backend
# → http://localhost:4000

# 3. Start the frontend
npm run dev --workspace=frontend
# → http://localhost:5173

# 4. Build the CLI
npm run build --workspace=cli
npm link --workspace=cli   # makes `sealedmind` available globally
```

---

## Web App Usage

### 1. Connect Wallet
Open `http://localhost:5173` → click **Connect Wallet** → select MetaMask → sign the SIWE message.

### 2. Create Your Mind
Click **Create Mind** → signs the ERC-7857 iNFT mint transaction on 0G Chain → your Mind NFT is created.

### 3. Remember
Go to the **Memory** tab → type any personal fact → click **Remember**.

Example inputs:
- `"I'm allergic to shellfish and penicillin"`
- `"I'm building a DeFi protocol in Solidity and React"`
- `"I prefer concise answers and work best in the mornings"`

The TEE extracts structured facts, encrypts them, uploads to 0G Storage, and returns a `txHash`. Click the link to verify on the 0G explorer.

### 4. Recall
Go to the **Recall** tab → type a question → click **Recall**.

Example queries:
- `"What are my allergies?"`
- `"What am I working on?"`
- `"What are my preferences?"`

The answer is synthesized by Qwen 2.5 inside the TEE and returned with a TEE attestation ID.

### 5. Grant / Revoke Access
Go to the **Sharing** tab → enter a grantee wallet address, shard, and expiry → click **Grant**.

The grantee can now recall your specified shard. Click **Revoke** to remove access instantly.

---

## CLI Usage

### First-time setup

```bash
# Login once — saves API key to ~/.sealedmind/config.json
sealedmind login --private-key $PRIVATE_KEY --host http://localhost:4000
```

Output:
```json
{
  "success": true,
  "address": "0xYourAddress",
  "mindId": "0xyouraddress",
  "apiKey": "sm_abc123..."
}
```

After login, all commands work without any flags for mind ID or tokens.

### Remember

```bash
sealedmind remember --content "I'm allergic to shellfish" --shard health
```

```json
{
  "sealed": 1,
  "memories": [{
    "content": "allergic to shellfish",
    "shard": "health",
    "cid": "0xabc...",
    "txHash": "0xdef...",
    "explorer": "https://chainscan-galileo.0g.ai/tx/0xdef..."
  }],
  "attestation": { "chatId": "0x...", "verified": true, "enclave": "Intel TDX" }
}
```

Options:
- `--shard <name>` — `health`, `work`, `preferences`, `finance`, `personal`, `general`
- `--mind <id>` — override mind ID (defaults to your wallet address)

### Recall

```bash
sealedmind recall --query "what are my allergies?"
sealedmind recall --query "what am I working on?" --shard work
sealedmind recall --query "my medications" --shard health --top-k 10
```

```json
{
  "answer": "You are allergic to shellfish and penicillin.",
  "memories": [{ "content": "allergic to shellfish", "shard": "health", "cid": "0x..." }],
  "attestation": { "chatId": "0x...", "verified": true, "enclave": "Intel TDX" }
}
```

### Grant

```bash
sealedmind grant \
  --shard health \
  --to 0xDoctorWalletAddress \
  --expiry-days 30 \
  --read-only
```

```json
{
  "capId": "cap_a1b2c3d4",
  "shard": "health",
  "grantee": "0xdoctorwalletaddress",
  "readOnly": true,
  "expiry": 1234567890,
  "explorer": "https://chainscan-galileo.0g.ai/address/0xf6b3..."
}
```

---

## SDK Usage

```typescript
import { SealedMind } from "@sealedmind/sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const client = new SealedMind({
  apiUrl: "http://localhost:4000",
  signer,
});

// Authenticate (SIWE sign-in)
const session = await client.login();
console.log("Logged in as:", session.address);

// Create a Mind
const { mind } = await client.createMind("My Mind", ["health", "work"]);

// Remember facts
const result = await client.remember(mind.id, {
  content: "I am allergic to shellfish and penicillin",
  shard: "health",
});
console.log("Sealed:", result.memories.length, "facts");
console.log("On-chain proof:", result.memories[0].explorerUrl);

// Recall
const recall = await client.recall(mind.id, {
  query: "what are my allergies?",
  shard: "health",
  topK: 5,
});
console.log("Answer:", recall.answer);
console.log("TEE verified:", recall.attestation.verified);

// Grant access to another agent
const grant = await client.grantCapability(
  mind.id,
  "health",
  "0xDoctorAgentAddress",
  { readOnly: true, expiry: Math.floor(Date.now() / 1000) + 30 * 86400 }
);
console.log("Granted:", grant.capability.capId);

// Revoke access
await client.revokeCapability(mind.id, grant.capability.capId);
```

---

## Life OS Agent (OpenClaw)

Life OS is a personal AI assistant powered by SealedMind. It proactively remembers everything you share — health, work, preferences, finances — across every conversation. Fresh session, same agent, full context.

### Install & configure

```bash
# 1. Install CLI
npm install -g @sealedmind/cli

# 2. Login once
sealedmind login --private-key $PRIVATE_KEY --host http://localhost:4000

# 3. In OpenClaw: load the skill
#    Point OpenClaw to openclaw-skill/SKILL.md

# 4. In OpenClaw: load the agent
#    Point OpenClaw to openclaw-skill/agent/life-os.md
```

### What it does

The Life OS agent uses SealedMind to:
- **Proactively remember** any durable fact you share (no need to ask it to save)
- **Recall before answering** any personal question — checks memory first
- **Organize into shards** — health, work, preferences, finance, personal
- **Grant selective access** — share one shard with your doctor's AI, another with your financial advisor

### Demo conversation

**Session 1:**
```
You: I'm allergic to shellfish and penicillin. I'm building a DeFi protocol
     in Solidity and React. I take metformin 500mg twice daily.

Agent: Sealing three facts to your Mind...
  ✓ health: allergic to shellfish and penicillin
    Proof: https://chainscan-galileo.0g.ai/tx/0x1a2b...
  ✓ work: DeFi protocol, Solidity + React
    Proof: https://chainscan-galileo.0g.ai/tx/0x3c4d...
  ✓ health: metformin 500mg twice daily, type 2 diabetes
    Proof: https://chainscan-galileo.0g.ai/tx/0x5e6f...
```

**Session 2 (fresh conversation, zero chat history):**
```
You: What should I have for dinner?

Agent: [recalls health shard]
  You're allergic to shellfish and have type 2 diabetes (metformin).
  Avoid shellfish and refined carbs. Grilled protein + vegetables is a
  safe bet. (Memory: TEE-attested · 0x1a2b...)

You: My doctor's AI wallet is 0xDrAI123. Give her read-only health access.

Agent: [runs grant]
  Done. 0xDrAI123 has read-only access to your health shard for 30 days.
  Capability: cap_a1b2c3d4
  On-chain: https://chainscan-galileo.0g.ai/address/0xf6b3...
```

See `openclaw-skill/agent/demo.md` for the full judge demo script.

---

## API Reference

### Auth

```
GET  /v1/auth/nonce          Get a fresh SIWE nonce
POST /v1/auth/login          { message, signature } → { token, address }
POST /v1/auth/apikey         Bearer <token> → { apiKey }   (long-lived)
GET  /v1/auth/apikey         Bearer <token> → { apiKey }   (idempotent)
```

### Minds

```
POST /v1/minds               Create (or get) user's Mind
GET  /v1/minds               List user's Minds
GET  /v1/minds/:id           Get Mind details + records (owner only)
GET  /v1/minds/:id/stats     Memory count by shard
POST /v1/minds/:id/shards    Add a shard name
```

### Memory

```
POST /v1/minds/:id/remember  { content, shard?, type? } → memories + attestation
POST /v1/minds/:id/recall    { query, shard?, topK? }   → answer + memories + attestation
```

Access control:
- `remember` — owner only
- `recall` — owner OR valid capability holder

### Capabilities

```
POST   /v1/minds/:id/capabilities          Grant shard access
GET    /v1/minds/:id/capabilities          List grants
DELETE /v1/minds/:id/capabilities/:capId   Revoke
GET    /v1/minds/:id/audit                 Access log
```

### Attestations

```
GET  /v1/attestations/:hash   Get attestation details
POST /v1/attestations/verify  { hash } → { verified }
```

---

## Testing

```bash
# Contracts (31 tests)
npm test --workspace=contracts

# SDK (12 tests)
npm test --workspace=sdk

# Backend API (34 tests — includes live TEE integration test)
npm test --workspace=backend

# CLI (4 tests, 2 require running backend)
npm test --workspace=cli

# All at once
npm test --workspaces
```

**Total: 81 tests across 4 suites.**

---

## How It Works

### Remember (step by step)
1. User submits text via web, CLI, or SDK
2. Backend validates ownership (`walletAddress === mindId`)
3. Text sent to **0G Sealed Inference** (Intel TDX + H100) → Qwen 2.5 extracts structured facts + returns attestation
4. Each fact embedded locally (all-MiniLM-L6-v2, 384 dimensions)
5. Facts encrypted with user's AES-256-GCM key (derived from wallet, never stored)
6. Encrypted blobs uploaded to **0G Storage** → returns `rootHash` + `txHash`
7. Vectors added to user's HNSW index
8. Index + records flushed to disk (`data/<walletAddress>/`)
9. `txHash` returned — verifiable at `chainscan-galileo.0g.ai/tx/<hash>`

### Recall (step by step)
1. Query embedded locally
2. HNSW vector search on user's index → top-K nearest memories
3. Optional shard filter applied
4. Matching memory content sent to **0G Sealed Inference** with the query
5. Qwen 2.5 synthesizes answer inside TEE → returns attested answer
6. Answer + attestation returned to caller

### Grant / Revoke
1. Owner calls grant → capability stored in `data/capabilities.json` + persisted
2. Capability includes: mindId, shardName, grantee, readOnly, expiry (unix seconds)
3. On recall: if caller ≠ mindId, `hasCapability()` checks all active, non-revoked grants
4. Revoke sets `revoked: true` → grantee gets 403 on next recall

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Mind ID = wallet address | Stable, predictable, no random IDs to track |
| Per-user EngineRegistry | Complete memory isolation — no cross-user data bleed |
| Key = HMAC(secret, address) | Never on disk, deterministic across restarts |
| HNSW in-process | No external vector DB dependency, serialized to disk per-user |
| 0G Storage for blobs | Permanent, censorship-resistant, verifiable on-chain |
| TEE for inference only | We don't run the embedding model in TEE (0G doesn't offer that yet) |
| ERC-7857 iNFT | Standard for AI agent identity — transferable, composable |
| API key = `sm_*` | Long-lived, survives session expiry, ideal for agents/CLI |

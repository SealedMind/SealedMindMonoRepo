# SealedMind

> Your AI's lifetime memory — encrypted, permanent, transferable.

## ❶ Problem (one line)

> **AI agents accumulate deeply personal knowledge about us — but today that memory is locked on someone else's server, with no ownership, no privacy proof, and no portability.** SealedMind fixes all three on 0G.

SealedMind is the first portable memory layer for AI agents where:
- **Privacy is hardware-enforced** — every read and write runs inside Intel TDX + NVIDIA H100 TEE via 0G Sealed Inference
- **Persistence is decentralized** — memories are AES-256-GCM encrypted and stored permanently on 0G Storage
- **Ownership is cryptographic** — each Mind is an ERC-7857 iNFT on 0G Chain, transferable and user-controlled
- **Isolation is guaranteed** — per-user encryption keys, per-user vector index, zero memory bleed between users

Built for the 0G APAC Hackathon. Now shipping as a real product.

---

## 🎥 Demo Video

**▶ Watch the 3-min walkthrough:** <DEMO_VIDEO_URL>

> Spawn a Mind → remember a fact → recall it from a fresh session → grant a doctor's AI read-only access → revoke. Every step returns a chainscan-clickable on-chain proof.

---

## 🧠 The Problem

Every useful AI agent — your coding copilot, your therapist bot, your trading assistant — gets smarter with memory. But today that memory:

1. **Lives on someone else's server.** ChatGPT owns your secrets. Replika owns your relationships. Switch tools and you start over.
2. **Has no ownership semantics.** You can't sell it, can't will it, can't lease it. Your AI's memory isn't an asset — it's a row in a SaaS database.
3. **Has no privacy proof.** "We don't read your data" is policy, not math. There's no cryptographic receipt that the LLM saw your data inside a sealed environment.

**SealedMind is the missing primitive.** Memory you actually own (ERC-7857 iNFT), encrypted under your wallet key, processed inside a hardware-attested TEE, with every read and write logged immutably on-chain.

---

## 🛰 0G Stack Components Used

SealedMind is a maximum-leverage demo of the 0G stack — every layer is load-bearing:

| 0G Layer | How SealedMind uses it |
|---|---|
| **0G Storage** | Every encrypted memory blob (AES-256-GCM ciphertext) is uploaded to 0G Storage via `@0gfoundation/0g-ts-sdk`. RootHash + txHash returned per memory; auditable on chainscan. |
| **0G Compute (Sealed Inference)** | Qwen 2.5 7B Instruct runs inside Intel TDX + NVIDIA H100 confidential GPU via the `@0glabs/0g-serving-broker`. Used for fact extraction (`remember`) and synthesis (`recall`). Returns a TEE attestation per call. |
| **0G Chain (16602 / 16661)** | Three on-chain primitives we deployed and source-verified: `CapabilityRegistry` (revocable shared access), `MemoryAccessLog` (immutable audit trail), `Verifier` (TEE attestation validator). |
| **Agentic ID (ERC-7857)** | Each user's Mind is an `SealedMindNFT` — ERC-7857 intelligent NFT, the 0G-native standard for AI agent identity. Holds storage CIDs + shard registry + authorized-user list. Transferable, composable, owned by the wallet. |

No other chain offers all four natively. SealedMind would be impossible to build elsewhere without stitching together AWS, a vector DB, a separate TEE provider, and a custom permissioning system.

---

## ✅ What's shipped, on-chain, today

- **8 contracts deployed + source-verified** on 0G Mainnet (16661) AND Galileo Testnet (16602)
- **Every `remember` / `recall` / `chat` emits an on-chain `MemoryAccessLog` tx** — immutable audit trail, chainscan-clickable from the Verify Proof button
- **Hardware-attested LLM inference** — Qwen 2.5 7B in Intel TDX + NVIDIA H100, every reply returns a TEE attestation
- **Four SDKs published** — `@sealedmind/sdk` (npm), `@sealedmind/mcp` (npm MCP server), `sealedmind` (PyPI), `evermemos-sealedmind` (PyPI, 0G Memory addon)
- **Live two-agent capability demo** at sealedmind.vercel.app/demo — wallet sign-in, on-chain grant, instant revoke
- **No admin keys, no trusted setup** — contracts are immutable; encryption keys derive from your wallet, never persisted

---

## ⚡ Live & hosted

| Surface | URL |
|---|---|
| Live two-agent demo | https://sealedmind.vercel.app/demo |
| System architecture + threat model | https://sealedmind.vercel.app/architecture |
| Pitch (one-page product overview) | https://sealedmind.vercel.app/pitch |
| Developer onboarding (get an API key) | https://sealedmind.vercel.app/developer |
| Docs (integration paths + ABIs) | https://sealedmind.vercel.app/docs |
| SealedMind backend API | https://sealedmind-backend-production.up.railway.app |
| Hosted agent bridge (FastAPI + bundled zgs_kv) | https://sealedmindsdk-production.up.railway.app |

## 📦 Published packages

```bash
npm  install @sealedmind/sdk          # TypeScript / JavaScript SDK
npx  -y @sealedmind/mcp               # MCP server for Claude Desktop / Cursor / Cline / Foundry
pip  install sealedmind               # Python SDK (generic agent stacks)
pip  install evermemos-sealedmind     # 0G Memory drop-in addon
```

| Package | Registry | Use case |
|---|---|---|
| [`@sealedmind/sdk`](https://www.npmjs.com/package/@sealedmind/sdk) | npm | Browser / Node — wraps the hosted backend |
| [`@sealedmind/mcp`](https://www.npmjs.com/package/@sealedmind/mcp) | npm | **Model Context Protocol** server — drop into Claude Desktop, Cursor, Cline, Foundry, or any MCP host to give an agent encrypted, TEE-attested memory |
| [`sealedmind`](https://pypi.org/project/sealedmind/) | PyPI | Python — wraps the hosted backend |
| [`evermemos-sealedmind`](https://pypi.org/project/evermemos-sealedmind/) | PyPI | Plugs into [`0gfoundation/0g-memory`](https://github.com/0gfoundation/0g-memory) as the encrypted memory layer |

## 🔌 Three integration paths

| Path | Best for | Effort |
|---|---|---|
| **A · 0G Memory addon** — `pip install evermemos-sealedmind` + 1 env var | Projects already on `0gfoundation/0g-memory` | 5 min |
| **B · Hosted SDK** — `@sealedmind/sdk` or `sealedmind` (Python) | Any agent stack — LangGraph, smolagents, custom | 3 lines |
| **C · Direct contracts** — call our `CapabilityRegistry` from any web3 lib | Your own backend, no deps on us | Permissionless |

Full walkthrough on https://sealedmind.vercel.app/docs and in [`OVERVIEW.md`](./OVERVIEW.md).

---

## 🔥 Early traction (real, public, on-chain)

SealedMind isn't a private hackathon submission — it's a primitive other 0G builders are already composing on, with public engagement on X and live integrations on chain.

### 🤝 Real builders shipping on SealedMind

- **[Daimon](../FAMILIAR_BUILD_GUIDE.md)** — *Train it. Own it. Pass it on.* Consumer dApp where every user spawns a tradeable AI trading agent. The agent's brain is a SealedMind ERC-7857 iNFT; trades route through VeilSolver. Marketplace contract live on Galileo + 0G mainnet at `0xb9D42824955b492BE4cBf13988C3d0Ad9985F807`. **First third-party project shipping on the SealedMind primitive.**
- **[VeilSolver](https://veil-resolver-frontend.vercel.app)** — MEV-resistant intent solver on 0G. They replaced their bespoke encrypted-storage layer with `@sealedmind/sdk` calls; their strategy registry, audit trail, and compliance log all run on SealedMind now. Joint integration guide: [`/VEILSOLVER_INTEGRATION.md`](../VEILSOLVER_INTEGRATION.md).
- **[Foundry Protocol](https://www.foundryprotocol.xyz/docs/0g-hackathon)** — co-owned AI model marketplace on 0G. Integration is **live now**: [`@sealedmind/mcp`](https://www.npmjs.com/package/@sealedmind/mcp) on npm pairs with `@foundryprotocol/mcp` in any MCP-compatible runtime — any Foundry Ingot-powered agent gets TEE-attested, on-chain-audited memory with one config block. Source: [`sdk-mcp/`](./sdk-mcp).

> **Talked with 10+ teams in the 0G ecosystem. Three confirmed integrations.** Three categories of project (consumer / DeFi / model marketplace), one memory primitive underneath all of them.

### ⬆ Upstream contribution to the 0G stack itself

We didn't only build *on top of* 0G. We **extended 0G's own `0gfoundation/0g-memory` project** with a sanctioned drop-in addon. Any existing 0G Memory deployment can install `evermemos-sealedmind` from PyPI, set one env var, and inherit encrypted-under-wallet-key memory + on-chain audit. **A contributor to the 0G stack, not just a consumer of it.**

### 📣 Live X (Twitter) thread coverage

- 🧵 [SealedMind launch thread on X](https://x.com/SealedMind_0G/status/2054824236494319702) — *"SealedMind is live on 0G mainnet. Encrypted AI memory. Hardware-attested inference. Capability-based sharing."*
- 🧵 [SealedMind product update thread](https://x.com/SealedMind_0G/status/2055196827583181076) — on-chain MemoryAccessLog wiring + chainscan-clickable verify proof
- 🧵 [VeilSolver × SealedMind ecosystem thread](https://x.com/VeilSolver/status/2052236211167821961) — partner project amplifying the joint stack story
- Follow [@SealedMind_0G](https://x.com/SealedMind_0G) for live updates.

### 🏛 0G ecosystem presence — since day one

- Attended **every** 0G builder showcase since the program launched
- Attended **every** 0G builder meet — APAC track from day one
- Coordinated with the 0G team across product + DevRel
- Three-project ecosystem submission to the 0G APAC Hackathon (Daimon + VeilSolver + SealedMind)

### 📦 Distribution proof

- **[`@sealedmind/sdk` on npm](https://www.npmjs.com/package/@sealedmind/sdk)** — installable, MIT-licensed, full TypeScript typings
- **[`sealedmind` on PyPI](https://pypi.org/project/sealedmind/)** — async Python SDK
- **[`evermemos-sealedmind` on PyPI](https://pypi.org/project/evermemos-sealedmind/)** — drop-in addon for `0gfoundation/0g-memory` (top-of-funnel into every 0G Memory project)
- **[`@sealedmind/mcp` on npm](https://www.npmjs.com/package/@sealedmind/mcp)** — Model Context Protocol server, the MCP-runtime side of the Foundry × SealedMind collab
- All 8 contracts source-verified on chainscan (mainnet + testnet) — anyone can read the bytecode

### 🏛 Ecosystem context

> **SealedMind** (memory primitive) + **VeilSolver** (execution primitive) + **Daimon** (consumer surface) + **Foundry Protocol** (co-owned model marketplace) — four projects, one memory primitive underneath them all, all composed natively on 0G Storage / Compute / Chain.

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
├── sdk/                @sealedmind/sdk — TypeScript SDK (published on npm)
├── sdk-mcp/            @sealedmind/mcp — Model Context Protocol server (published on npm)
├── python-sdk/         sealedmind — Python SDK (published on PyPI)
├── evermemos-sealedmind/  0G Memory drop-in addon (published on PyPI)
│   ├── evermemos_sealedmind/
│   │   ├── kv_storage/    SealedMindKVStorage + UserAwareSealedMindKVStorage
│   │   ├── auth/          WalletVault — encrypted user_secret_backup replacement
│   │   ├── capabilities/  CapabilityClient (web3.py against CapabilityRegistry)
│   │   ├── inference/     SealedInferenceClient (hosted Qwen-in-TDX)
│   │   ├── crypto/        HKDF + AES-256-GCM envelope + HMAC key blinding
│   │   └── components/    @component lifespan override for KV_STORAGE_TYPE=sealedmind
│   ├── examples/
│   │   ├── agent_server.py   FastAPI+WS bridge for the live demo
│   │   ├── agent_demo.py     Cinematic terminal two-agent demo
│   │   └── agents/           LangGraph MemoryAgent + LLM backends + tools + personas
│   ├── Dockerfile + docker-entrypoint.sh   Hosts the bridge + bundled zgs_kv
│   └── tests/             7 unit + 2 integration (gated by RUN_INTEGRATION=1)
├── cli/                @sealedmind/cli — login, remember, recall, grant
│   └── src/commands/
│       ├── login.ts    SIWE auth from private key → ~/.sealedmind/config.json
│       ├── remember.ts
│       ├── recall.ts
│       └── grant.ts
├── frontend/           Vite + React 19 + RainbowKit — Arctic Vault design
│   └── src/pages/      Landing, Pitch, Developer, Demo, Docs, Dashboard, Chat, Sharing
├── openclaw-skill/     OpenClaw skill + Life OS agent
│   ├── SKILL.md        Skill definition
│   └── agent/
│       ├── life-os.md  Agent system prompt + configuration
│       └── demo.md     Judge demo script
└── OVERVIEW.md         Single share-this-link product doc
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Solidity 0.8.24, Hardhat, ERC-7857 iNFT |
| Chain | 0G Mainnet (16661) + Galileo Testnet (16602) |
| Decentralized storage | 0G Storage (`@0gfoundation/0g-ts-sdk` Node, `zg-storage` Python) |
| Sealed inference | 0G Sealed Inference (`@0glabs/0g-serving-broker`) |
| LLM (inside TEE) | Qwen 2.5 7B Instruct |
| Hardware enclave | Intel TDX + NVIDIA H100 |
| Embeddings | all-MiniLM-L6-v2 via `@huggingface/transformers` (384d) |
| Vector search | HNSW (`hnswlib-node`) |
| Encryption | AES-256-GCM (`node:crypto`, `cryptography`) |
| Key derivation | HKDF-SHA256 + HMAC-SHA256 key blinding |
| Backend | Express, TypeScript, SIWE (`siwe`) — hosted on Railway |
| Auth | SIWE session + long-lived API keys + operator keys for headless integrations |
| Frontend | Vite, React 19, TailwindCSS v4, RainbowKit, wagmi — hosted on Vercel |
| Python addon | `evermemos-sealedmind` — plugs into 0G Memory's `memsys.addons` entry point |
| Python SDK | `sealedmind` — async httpx wrapper over the backend |
| Live demo agents | LangGraph state graph + Anthropic Claude (Aria) + Qwen 2.5 7B in TDX (Doctor) |
| Agent bridge | FastAPI + WebSocket + bundled `zgs_kv` — Dockerized, hosted on Railway |
| CLI | Commander.js, ethers v6 |
| Agent (showcase) | OpenClaw + Life OS agent |

---

## Deployed Contracts

### Mainnet — 0G Mainnet (Chain ID: 16661)

| Contract | Address | Explorer |
|---|---|---|
| SealedMindNFT (ERC-7857) | `0x091CfC4b9E6FF0026F384b8c4664B8C03Af21EA6` | [View](https://chainscan.0g.ai/address/0x091CfC4b9E6FF0026F384b8c4664B8C03Af21EA6) |
| CapabilityRegistry | `0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45` | [View](https://chainscan.0g.ai/address/0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45) |
| MemoryAccessLog | `0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad` | [View](https://chainscan.0g.ai/address/0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad) |
| Verifier | `0x6D5B3B81119F78366B767DB81C2dd6625d5648Af` | [View](https://chainscan.0g.ai/address/0x6D5B3B81119F78366B767DB81C2dd6625d5648Af) |

Deployer: `0x21fc05b215FBDB9bfAdDc5EC12595E1154DE2302`

### Testnet — 0G Galileo Testnet (Chain ID: 16602)

| Contract | Address | Explorer |
|---|---|---|
| SealedMindNFT (ERC-7857) | `0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7` | [View](https://chainscan-galileo.0g.ai/address/0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7) |
| CapabilityRegistry | `0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66` | [View](https://chainscan-galileo.0g.ai/address/0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66) |
| MemoryAccessLog | `0xB085F48c98E8878ACA88460B37653cC8d2E24482` | [View](https://chainscan-galileo.0g.ai/address/0xB085F48c98E8878ACA88460B37653cC8d2E24482) |
| Verifier | `0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd` | [View](https://chainscan-galileo.0g.ai/address/0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd) |

Deployer: `0xE74686Fd89ACB480B3903724C367395d86ED4519`

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

# Deployed contracts (0G Galileo Testnet — chainId 16602)
SEALED_MIND_NFT_ADDRESS=0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7
CAPABILITY_REGISTRY_ADDRESS=0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66
MEMORY_ACCESS_LOG_ADDRESS=0xB085F48c98E8878ACA88460B37653cC8d2E24482
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

### Inference (TEE-attested LLM, no Mind required)

```
POST /v1/inference/chat   { messages, maxTokens?, temperature? } → { content, model, chatId, attestationValid, enclave }
```

Auth: requires Bearer token (user API key OR operator key via
`SEALEDMIND_OPERATOR_KEYS` env). Rate-limited: 30 req / 60s per key.
Backend is Qwen 2.5 7B inside Intel TDX via the 0G Compute broker.

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

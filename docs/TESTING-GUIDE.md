# SealedMind — Complete Testing Guide

Everything you need to test, demo, or record every feature of SealedMind end-to-end.
Covers the web frontend, CLI, and OpenClaw skill integration.

---

## Prerequisites

### 1. Start the servers

**Backend** (port 4000):
```bash
cd /downloads/OG-hackquest/sealedmind/backend
node dist/src/api/index.js &
```

Verify:
```bash
curl http://localhost:4000/health
# → {"status":"ok","memoryCount":0}
```

**Frontend** (port 5173):
```bash
cd /downloads/OG-hackquest/sealedmind/frontend
npm run dev &
```

Open: `http://localhost:5173`

### 2. MetaMask — add 0G Galileo Testnet

| Field | Value |
|---|---|
| Network name | 0G Galileo Testnet |
| RPC URL | `https://evmrpc-testnet.0g.ai` |
| Chain ID | `16602` |
| Symbol | `0G` |
| Explorer | `https://chainscan-galileo.0g.ai` |

Make sure your wallet has testnet 0G (faucet: `faucet.0g.ai`).

### 3. CLI env vars

After signing in (step 2 below), set these once per terminal session:
```bash
export SEALEDMIND_API_URL=http://localhost:4000
export SEALEDMIND_SESSION=<your-token>
export SEALEDMIND_MIND_ID=mind-1
```

---

## Part 1 — Web Frontend

### 1.1 Landing Page

**URL:** `http://localhost:5173`

**What to do:**
- Open the page and scroll from top to bottom
- Read the hero: *"Your AI remembers everything. Nobody else can see it."*
- Scroll through the three pillars: **Sealed** (AES-256-GCM) · **Permanent** (0G Storage) · **Yours** (ERC-7857)
- Scroll to the live terminal receipt mockup showing the full flow
- Click **"Create your Mind"** — takes you to `/dashboard`

**What you should see:**
- Full-screen editorial layout with animated Mind Seal graphic
- Trust strip: `⬡ Built on 0G · ERC-7857 iNFT · Intel TDX + H100 TEE · Open source`

---

### 1.2 Connect Wallet + Sign In

**URL:** `http://localhost:5173/dashboard`

**What to do:**
1. Click **Connect Wallet** → choose MetaMask
2. Switch MetaMask to **0G Galileo Testnet** (chain ID 16602) if prompted
3. Approve the connection
4. Click **"Sign-In with Ethereum"**
5. MetaMask shows a SIWE message — click **Sign**

**What you should see:**
- Step 1: "Connect a wallet to claim your Mind" screen
- Step 2: "Sign the seal to prove the wallet is yours" screen
- After signing: dashboard loads showing "The vault is silent. Forge your first Mind above."

**Get your session token** (needed for CLI):
```js
// Paste in browser DevTools console:
JSON.parse(localStorage.getItem('sealedmind:session'))
// → { token: "xxxxxxxx-...", address: "0x..." }
```

---

### 1.3 Create a Mind

**URL:** `http://localhost:5173/dashboard`

**What to do:**
1. In the "Forge a new Mind" box, type a name: `Personal Memory`
2. Click **Mint**
3. Wait ~2 seconds

**What you should see:**
- A Mind card appears in the grid:
  - Name: `Personal Memory`
  - Memories: `0`
  - Shards: `0`
  - Created: today's date
  - Two buttons: **Open ↗** and **Share ⬡**

---

### 1.4 Remember via Frontend

**URL:** Click **Open ↗** on the Mind card → `/mind/mind-1/chat`

**What to do:**
1. The console opens. Notice the mode toggle at the bottom: **recall** | **remember**
2. Click **remember** (turns purple/rune color)
3. Type: `I am allergic to penicillin and I prefer morning meetings`
4. Press **Enter** or click **Send**
5. Wait ~30 seconds (TEE fact extraction + 0G Storage upload)

**What you should see:**
- A sealing progress animation while the TEE processes
- Mind response appears:
  - `Sealed 2 memories`
  - `Extracted: "I am allergic to penicillin"`
- Below the response: **Attestation badge** showing `verified · Intel TDX · chatcmpl-...`
- **CID chips** — one per sealed memory — showing the 0G Storage root hash

> **Why this matters:** The facts were extracted inside Intel TDX + NVIDIA H100 TEE, encrypted with AES-256-GCM, and uploaded to real 0G Storage nodes. The CID is proof of permanent storage.

---

### 1.5 Recall via Frontend

**URL:** Same chat page `/mind/mind-1/chat`

**What to do:**
1. Click **recall** on the mode toggle (turns teal/seal color)
2. Type: `What should a doctor know about me?`
3. Press **Enter**
4. Wait ~5–10 seconds (TEE synthesis)

**What you should see:**
- Mind response: `"You are allergic to penicillin."`
- Below: **Attestation badge** + **Memories Retrieved: 2 fragments**

> **Why this matters:** The TEE retrieved encrypted memories, decrypted them inside the enclave, synthesized an answer using Qwen 2.5 7B, and returned a TEE-attested response.

---

### 1.6 Grant Capability via Frontend

**URL:** Click **← Back to vault** → click **Share ⬡** on the Mind card → `/mind/mind-1/sharing`

**What to do:**
1. Click **+ Grant** (purple button, top right)
2. Fill in the form:
   - **Shard:** `general`
   - **Grantee address:** `0x73A5021c0935b79D46C2D650821b212dC5b3b9Eb`
   - **Expires:** pick any future date
   - Check **Read-only**
3. Click **Seal capability →**

**What you should see:**
- The capability appears in the ledger table:
  - Shard: `general`
  - Grantee: `0x73A5…b9Eb`
  - Mode: `read · only`
  - Expiry: the date you chose
  - Action: **Revoke ⨯**

---

### 1.7 Revoke Capability via Frontend

**URL:** Same sharing page `/mind/mind-1/sharing`

**What to do:**
1. Click **Revoke ⨯** on the capability row

**What you should see:**
- The row shows **Revoked** (in red) and becomes faded/dimmed
- Access for that grantee is immediately terminated

---

## Part 2 — CLI

Make sure env vars are set (see Prerequisites §3) and the CLI is built:
```bash
cd /downloads/OG-hackquest/sealedmind/cli
npm run build
```

All commands use this alias to avoid line-wrap issues:
```bash
CMD="node /downloads/OG-hackquest/sealedmind/cli/dist/index.js"
```

---

### 2.1 Remember via CLI

```bash
$CMD remember --mind "$SEALEDMIND_MIND_ID" --content "I was born in Mumbai, I drink green tea every morning, and I work as an ML engineer"
```

Takes ~30 seconds. Expected output:
```json
{
  "sealed": 3,
  "memories": [
    {
      "content": "I was born in Mumbai",
      "shard": "general",
      "cid": "0x5b0a...",
      "txHash": "0xda56...",
      "explorer": "https://chainscan-galileo.0g.ai/tx/0xda56..."
    },
    {
      "content": "I drink green tea every morning",
      "shard": "general",
      "cid": "0x32c6...",
      "txHash": "0x74c5...",
      "explorer": "https://chainscan-galileo.0g.ai/tx/0x74c5..."
    },
    {
      "content": "I work as an ML engineer",
      "shard": "general",
      "cid": "0x821f...",
      "txHash": "0x6113...",
      "explorer": "https://chainscan-galileo.0g.ai/tx/0x6113..."
    }
  ],
  "attestation": {
    "chatId": "chatcmpl-...",
    "verified": true,
    "enclave": "Intel TDX"
  },
  "totalMemories": 3
}
```

**What this proves:** TEE extracted 3 distinct facts from one sentence, each sealed separately with its own on-chain transaction.

---

### 2.2 Recall via CLI

```bash
$CMD recall --mind "$SEALEDMIND_MIND_ID" --query "What do you know about me?" --top-k 5
```

Takes ~5–10 seconds. Expected output:
```json
{
  "answer": "You were born in Mumbai, you drink green tea every morning, and you work as an ML engineer.",
  "memories": [
    { "content": "I was born in Mumbai", "shard": "general", "cid": "0x5b0a..." },
    { "content": "I drink green tea every morning", "shard": "general", "cid": "0x32c6..." },
    { "content": "I work as an ML engineer", "shard": "general", "cid": "0x821f..." }
  ],
  "attestation": {
    "chatId": "chatcmpl-...",
    "verified": true,
    "enclave": "Intel TDX"
  }
}
```

Try other queries:
```bash
$CMD recall --mind "$SEALEDMIND_MIND_ID" --query "Do I have any allergies?" --top-k 3
$CMD recall --mind "$SEALEDMIND_MIND_ID" --query "What is my morning routine?" --top-k 3
```

---

### 2.3 Grant via CLI

```bash
CMD="node /downloads/OG-hackquest/sealedmind/cli/dist/index.js"
$CMD grant --mind "$SEALEDMIND_MIND_ID" --shard general --to 0x73A5021c0935b79D46C2D650821b212dC5b3b9Eb --expiry-days 14 --read-only
```

Expected output:
```json
{
  "capId": "cap_70e8b111",
  "shard": "general",
  "grantee": "0x73a5021c0935b79d46c2d650821b212dc5b3b9eb",
  "readOnly": true,
  "expiry": 1777019402,
  "explorer": "https://chainscan-galileo.0g.ai/address/0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66"
}
```

The `explorer` link opens the CapabilityRegistry contract on 0G chain.

---

### 2.4 On-chain Proof

After running `remember`, copy an `explorer` URL from the output and open it in your browser. For example:

```
https://chainscan-galileo.0g.ai/tx/0xda5638266ca98b5201ffed76d9117114fa5690be559cc69321e73e7e771c58b8
```

**What you should see:** A confirmed transaction on 0G Galileo testnet — this is the actual on-chain record of your encrypted memory being stored permanently.

Also check the CapabilityRegistry contract directly:
```
https://chainscan-galileo.0g.ai/address/0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66
```

---

## Part 3 — OpenClaw Skill

### 3.1 Install the Skill

Find your OpenClaw skills directory:
```bash
openclaw --help
ls ~/.openclaw/skills/ 2>/dev/null
```

Copy the SealedMind skill into it:
```bash
cp -r /downloads/OG-hackquest/sealedmind/openclaw-skill ~/.openclaw/skills/sealedmind-memory
```

Verify OpenClaw sees it:
```bash
openclaw skills list
# should show: sealedmind-memory
```

### 3.2 Set env vars for OpenClaw

Add to your shell config (`~/.bashrc` or `~/.zshrc`) so OpenClaw's subprocess picks them up:
```bash
export SEALEDMIND_API_URL=http://localhost:4000
export SEALEDMIND_SESSION=<your-token>
export SEALEDMIND_MIND_ID=mind-1
```

Reload:
```bash
source ~/.bashrc
```

### 3.3 Test Remember via OpenClaw

Open OpenClaw and type a natural message that contains a personal fact:

> *"I should mention — I'm vegetarian and I have a severe nut allergy."*

**What OpenClaw does internally:**
1. Reads `SKILL.md` — detects a durable personal fact
2. Runs:
   ```bash
   sealedmind remember --mind "mind-1" --content "I'm vegetarian and I have a severe nut allergy."
   ```
3. Gets JSON back with sealed count + CID
4. Replies to you: *"Sealed. CID `0xabc…def`. (TEE-attested)"*

### 3.4 Test Recall via OpenClaw

Ask a question OpenClaw can't answer from context alone:

> *"What should a restaurant know about me before I arrive?"*

**What OpenClaw does internally:**
1. Detects this requires cross-session personal context
2. Runs:
   ```bash
   sealedmind recall --mind "mind-1" --query "What should a restaurant know about me before I arrive?" --top-k 5
   ```
3. Gets the TEE-synthesized answer
4. Replies: *"You are vegetarian and have a severe nut allergy. (Sealed memory · attestation `chatcmpl-...`)"*

### 3.5 What to Show on Screen

For the demo recording, show these three things side by side:

1. **Left:** OpenClaw chat window — natural language input/output
2. **Middle:** Terminal — the actual `sealedmind` CLI commands being invoked automatically
3. **Right:** Browser — `chainscan-galileo.0g.ai` showing the live on-chain tx

This demonstrates the full loop: **AI agent → TEE inference → 0G Storage → on-chain proof** — all triggered by a single natural sentence.

---

## Part 4 — Automated Test Suites

These run offline (no browser needed) to verify all layers of the stack.

### Contracts (Hardhat — local EVM)
```bash
cd /downloads/OG-hackquest/sealedmind/contracts
npm test
# 31 tests passing — SealedMindNFT, CapabilityRegistry, MemoryAccessLog
```

### SDK (Vitest — mock server)
```bash
cd /downloads/OG-hackquest/sealedmind/sdk
npm test
# 12 tests passing — auth, createMind, remember, recall, grantCapability, revokeCapability
```

### Backend (Vitest — unit + live 0G testnet)
```bash
cd /downloads/OG-hackquest/sealedmind/backend
npm test
# 34 tests passing:
#   crypto.test.ts        — AES-256-GCM round-trips, tamper detection
#   vectorIndex.test.ts   — HNSW add/search/serialize
#   storage.unit.test.ts  — chunk pad/unpad
#   api.test.ts           — all HTTP endpoints, auth, 401 rejection
#   embeddings.test.ts    — 384-dim vectors, cosine similarity
#   storage.integration   — real 0G Storage upload + download
#   memoryEngine.integration — full TEE remember + recall against live testnet
```

### CLI (Vitest — live backend required)
```bash
cd /downloads/OG-hackquest/sealedmind/cli
SEALEDMIND_API_URL=http://localhost:4000 \
SEALEDMIND_SESSION=<your-token> \
SEALEDMIND_MIND_ID=mind-1 \
npm test
# 4 tests passing — help, missing env, recall, remember
```

---

## Deployed Contracts (0G Galileo Testnet — chain ID 16602)

| Contract | Address | Explorer |
|---|---|---|
| Verifier | `0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd` | [view](https://chainscan-galileo.0g.ai/address/0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd) |
| SealedMindNFT (ERC-7857) | `0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7` | [view](https://chainscan-galileo.0g.ai/address/0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7) |
| CapabilityRegistry | `0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66` | [view](https://chainscan-galileo.0g.ai/address/0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66) |
| MemoryAccessLog | `0xB085F48c98E8878ACA88460B37653cC8d2E24482` | [view](https://chainscan-galileo.0g.ai/address/0xB085F48c98E8878ACA88460B37653cC8d2E24482) |

---

## Quick Reference — All Commands

```bash
# Setup
export SEALEDMIND_API_URL=http://localhost:4000
export SEALEDMIND_SESSION=<token>
export SEALEDMIND_MIND_ID=mind-1
CMD="node /downloads/OG-hackquest/sealedmind/cli/dist/index.js"

# Remember a fact (~30s)
$CMD remember --mind "$SEALEDMIND_MIND_ID" --content "your fact here"

# Recall from memory (~10s)
$CMD recall --mind "$SEALEDMIND_MIND_ID" --query "your question here" --top-k 5

# Grant shard access to another wallet
$CMD grant --mind "$SEALEDMIND_MIND_ID" --shard general --to 0xADDRESS --expiry-days 14 --read-only

# Show help
$CMD --help
$CMD remember --help
$CMD recall --help
$CMD grant --help
```

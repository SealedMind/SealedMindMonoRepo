# SealedMind — Project Overview

**The privacy primitive layer for AI agent memory, built on 0G.**

> Share this single document with anyone — judges, DevRel, integrators,
> investors — and they'll understand the whole product without needing
> to clone a single repo.

---

## Table of contents

1. [What SealedMind is, in one paragraph](#what-sealedmind-is-in-one-paragraph)
2. [The problem](#the-problem)
3. [The solution](#the-solution)
4. [How it works (architecture + data flow)](#how-it-works)
5. [The components](#the-components)
6. [Integration paths — how anyone uses SealedMind](#integration-paths)
7. [The live two-agent demo](#the-live-two-agent-demo)
8. [Deployed infrastructure](#deployed-infrastructure)
9. [Security model — what we defend, what we don't](#security-model)
10. [Real on-chain proofs](#real-on-chain-proofs)
11. [Repo structure](#repo-structure)
12. [Reproducing everything locally](#reproducing-everything-locally)
13. [Production roadmap](#production-roadmap)
14. [Built for, built by, built on](#built-for-built-by-built-on)
15. [FAQ](#faq)

---

## What SealedMind is, in one paragraph

SealedMind is the **encrypted, capability-gated memory layer for AI
agents**, built on the 0G stack. Every memory an agent stores is wrapped
in an AES-256-GCM envelope under a key the user (not us, not the agent)
controls. Sharing a memory shard with another agent goes through an
on-chain `CapabilityRegistry` contract — the data owner can grant a
30-day read-only capability with one tx and revoke it with another.
Sensitive reads run through a TEE-attested LLM (Qwen 2.5 7B in Intel
TDX) so even the inference step has a hardware-verified attestation.
Memories are anchored as ERC-7857 iNFTs so an agent's memory is
transferable property, not platform-locked data. Ship it as a one-line
addon to 0G Memory, or call our deployed contracts directly from any
agent stack.

---

## The problem

AI agents are only useful if they remember. But the existing memory
layers — including 0G Memory itself — have three holes that block real
production use:

### Hole 1 · Plaintext secrets at rest

`0g-memory/src/infra_layer/adapters/out/persistence/user_secret_backup.py`
writes user wallet keys, stream IDs, and AES encryption keys to
`./user_secrets_backup.json` **in plaintext JSON**. The file's own
docstring flags this. Lose the file → lose recovery. Leak the file →
leak every user's memory stream.

### Hole 2 · No client-side encryption on the storage layer

`ZeroGKVStorage` writes raw bytes to 0G Storage. If an attacker
compromises your local KV node, your indexer, or any storage node, they
read every memory ever written. There is no envelope, no per-user key,
no AAD binding to defeat swap attacks.

### Hole 3 · No primitive for sharing memory across agents or users

The whole point of an AI memory layer is that other agents can read
relevant context. But today there's no way to say *"share my fitness
shard with my doctor's agent for 30 days, read-only."* The only
workaround is to copy the data out, which defeats the entire premise.

### Bonus hole · No verifiable inference

When an agent reads memory and calls an LLM, you have no proof that the
LLM ran in a trusted environment. A malicious operator can log every
prompt and every memory chunk that flows through. For sensitive personal
data — health, finance, identity — this is the threat model that
matters.

---

## The solution

SealedMind ships four primitives that close these holes, all built on
the 0G stack:

| Primitive | What it does | Where it lives |
|---|---|---|
| **`SealedMindKVStorage`** | Drop-in replacement for `ZeroGKVStorage`. AES-256-GCM envelope per value, AAD-bound to a HMAC-blinded key handle. Local SQLite holds only opaque handles → 0G storage rootHashes. | Python addon `evermemos-sealedmind` |
| **`WalletVault`** | Drop-in for `UserSecretBackup`. Same static API, but the on-disk file is an AES-GCM envelope under a 32-byte master key the operator controls (or derived from a SIWE signature). | Python addon `evermemos-sealedmind` |
| **`CapabilityRegistry`** | On-chain contract for revocable, time-bound, scope-limited memory sharing between agents. Mind owner grants a capability → grantee uses the token to read → owner revokes any time → next read fails on chain. | Smart contract on 0G mainnet + testnet |
| **Sealed Inference gateway** | TEE-attested LLM (Qwen 2.5 7B running inside Intel TDX). Generic `/v1/inference/chat` endpoint any agent stack can call. Every response carries a chatId that can be re-verified against the attestation registry. | Backend at `sealedmind-backend-production.up.railway.app` |

Plus two pieces of glue that make the whole thing real:

| | |
|---|---|
| **`SealedMindNFT`** (ERC-7857) | Each user's memory collection is a transferable iNFT on 0G chain. Selling/transferring the iNFT = transferring the memory. |
| **`MemoryAccessLog`** | Immutable on-chain audit trail of every read/write/share. Users can prove who saw what, when. |

---

## How it works

### High-level architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Your Agent / Application                       │
│  (LangGraph, smolagents, custom Python, TS, anything)                │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
        ┌────────────────┴───────────────┬────────────────────┐
        │                                │                    │
        ▼                                ▼                    ▼
  evermemos-sealedmind        @sealedmind/sdk          web3.py / ethers
  (Python addon)              (TS/JS SDK)              (direct contract calls)
        │                                │                    │
        ▼                                ▼                    │
  SealedMindKVStorage           SealedMind backend            │
        │                       (Express + TS)                │
        │                                │                    │
        │                       ┌────────┼────────┐           │
        │                       ▼        ▼        ▼           │
        │                   /memory  /capabilities  /inference│
        │                                                      │
        ▼                                                      ▼
  AES-256-GCM envelope                              ┌──────────────────┐
        │                                           │  Smart Contracts │
        ▼                                           │  on 0G Chain     │
  CachedKvClient (zg_storage SDK)                   │                  │
        │                                           │  • Verifier      │
        ▼                                           │  • SealedMindNFT │
  local zgs_kv  ◀── synced from chain ───────────── │  • Capability-   │
        │                                           │    Registry      │
        ▼                                           │  • Memory-       │
   0G Storage (encrypted blobs by rootHash)         │    AccessLog     │
                                                    └──────────────────┘
                                                            ▲
                                                            │
                              ┌────────────────────────────┘
                              │
                       0G Sealed Inference
                       (Qwen 2.5 7B in Intel TDX)
                       attests every reply
```

### Data flow — write a memory

```
agent.remember("user prefers vegetarian meals")
        │
        ▼
SealedMindKVStorage.put(key, value)
        │
        ├──► HMAC(index_key, namespace || key)  → blinded handle
        ├──► HKDF(master_key, namespace)        → DEK
        ├──► AES-256-GCM(value, DEK, aad=blinded_handle)
        │
        ▼
CachedKvClient.set(stream, blinded_handle, envelope)
        │ background commit
        ▼
zgs_kv local node → 0G Storage (real on-chain tx, real rootHash)
```

### Data flow — share with another agent

```
patient_agent.share_with(doctor_address, shard="fitness", days=30)
        │
        ▼
CapabilityRegistry.grantCapability(
    mindId, "fitness", doctor_address, readOnly=true, expiry=now+30d
)  → emits CapabilityGranted, returns capId (32 bytes)
        │
        ▼
patient hands capId to doctor (out-of-band or via referral note)
```

### Data flow — read with a capability

```
doctor_agent.recall(key)
        │
        ▼
gateway: CapabilityRegistry.verifyCapability(capId, doctor_addr)
        │
        ├─ revoked / expired / wrong shard → ✗ deny
        │
        ▼
SealedMindKVStorage.get(key)
        │
        ├──► fetch envelope from 0G Storage by rootHash
        ├──► HKDF(master, namespace) → DEK
        ├──► AES-GCM decrypt + verify AAD = blinded_handle
        │
        ▼
plaintext → through Sealed Inference TEE for clinical summary
        │
        ▼
attested response back to doctor
```

### Data flow — revoke

```
patient_agent.revoke(capability_token)
        │
        ▼
CapabilityRegistry.revokeCapability(capId)
        │ → emits CapabilityRevoked
        ▼
next doctor_agent.recall(key) call:
  verifyCapability(...) returns false → access denied
        │
(no cache to wait for, no sync to chase — instantly enforced on chain)
```

---

## The components

### 1. Smart contracts (Solidity 0.8.24, deployed on 0G mainnet + testnet)

**`Verifier.sol`** — verifies ERC-7857 preimage proofs for iNFT minting.

**`SealedMindNFT.sol`** — ERC-7857 implementation. Each Mind = one
tokenId, stores `dataHashes`, `storageCID`, `shards[]`. Transfer
re-encrypts data for the new owner via TEE oracle.

**`CapabilityRegistry.sol`** — the headline primitive. Grant / verify /
revoke capabilities for `(mindId, shardName, grantee, readOnly,
expiry)`.

**`MemoryAccessLog.sol`** — immutable on-chain audit log of every
memory operation. Includes attestation hash + storage CID per entry.

### 2. SealedMind backend (Node 20 + Express + TS, deployed on Railway)

REST API at `https://sealedmind-backend-production.up.railway.app`:

| Method + path | Auth | What it does |
|---|---|---|
| `GET /health` | none | liveness |
| `GET /v1/auth/nonce` | none | SIWE nonce |
| `POST /v1/auth/login` | none | SIWE message + signature → bearer token |
| `POST /v1/auth/apikey` | bearer | issue long-lived API key |
| `POST /v1/minds` | bearer | create a Mind (mints iNFT, allocates engine) |
| `GET /v1/minds` | bearer | list user's Minds |
| `POST /v1/minds/:id/remember` | bearer | store memory (TEE fact-extraction → encrypted → 0G storage) |
| `POST /v1/minds/:id/recall` | bearer | RAG over user's memory in TEE |
| `POST /v1/minds/:id/capabilities` | bearer | grant capability |
| `GET /v1/minds/:id/capabilities` | bearer | list capabilities |
| `DELETE /v1/minds/:id/capabilities/:capId` | bearer | revoke |
| `GET /v1/minds/:id/audit` | bearer | read MemoryAccessLog entries |
| `GET /v1/attestations/:hash` | none | look up attestation by hash |
| `POST /v1/attestations/verify` | none | verify an attestation |
| `POST /v1/inference/chat` | ⚠️ none currently | generic Qwen 2.5 7B in TDX chat — **adding API keys next** |

### 3. `@sealedmind/sdk` (TypeScript / JavaScript)

Thin client over the backend. Used by the frontend, callable by any
TS/JS app.

```typescript
import { SealedMind } from "@sealedmind/sdk";
const client = new SealedMind({ apiUrl: "..." });
await client.login(signer);
const mind = await client.createMind({ storageCID: "..." });
await client.remember(mind.id, "patient ran 8km this morning");
const result = await client.recall(mind.id, "what's recent?");
```

### 4. `evermemos-sealedmind` (Python addon for 0G Memory)

Pip-installable addon that plugs into 0G Memory's `memsys.addons`
entry point. Adds three primary capabilities:

* `SealedMindKVStorage` — AES-256-GCM envelopes + HMAC-blinded keys on top of `CachedKvClient`
* `WalletVault` — encrypted replacement for `UserSecretBackup`
* `CapabilityClient` — Python wrapper around `CapabilityRegistry` (web3.py, EIP-1559 fees, real `estimate_gas`)
* `SealedInferenceClient` — Python client for the TEE inference gateway
* `UserAwareSealedMindKVStorage` — server-mode multi-user variant

### 5. SealedMind frontend (Vite + React + Tailwind, "Arctic Vault" design)

Routes:
* `/` — landing
* `/dashboard` — manage Minds
* `/mind/:id/chat` — talk to a Mind
* `/mind/:id/sharing` — issue / revoke capabilities
* `/demo` — live two-agent demo (Aria + Dr. Chen)

### 6. CLI (`@sealedmind/cli`)

Operational tooling for minting, granting, revoking from the terminal.

### 7. OpenClaw skill (`life-os-agent`)

A sample agent built with OpenClaw that uses SealedMind as its memory
layer end-to-end — proves the integration story for a non-trivial
real-world agent.

---

## Integration paths

Three ways another team can use SealedMind today, ordered by friction.

### Path A · You're already on 0G Memory: drop in our addon

**Best fit:** any project using `0gfoundation/0g-memory` (EverMemOS).

```bash
pip install evermemos-sealedmind   # (PyPI publish in flight)
```

Three env vars and you're done:

```bash
export MEMSYS_ENTRYPOINTS_FILTER=core,sealedmind
export KV_STORAGE_TYPE=sealedmind
export SEALEDMIND_BACKUP_KEY=<32-byte hex master key>
```

Your existing `memory.put()` / `memory.get()` calls now route through
encrypted envelopes on 0G Storage, with a HMAC-blinded local index and
optional on-chain capability gating. Zero code changes.

**Verdict:** ✅ Production-ready for the 0G Memory niche.

### Path B · You have your own agent stack

#### B1 — Use the smart contracts directly (zero deps on us)

```python
from web3 import Web3
w3 = Web3(Web3.HTTPProvider("https://evmrpc.0g.ai"))
registry = w3.eth.contract(
    address="0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45",
    abi=CAPABILITY_REGISTRY_ABI,
)
# patient grants doctor a capability for the "fitness" shard, 30 days
tx = registry.functions.grantCapability(
    mind_id, "fitness", doctor_address, True, expiry
).build_transaction({...})
```

Bring your own storage. We're just the on-chain capability primitive.

**Verdict:** ✅ Truly production-ready — contracts are immutable on
mainnet.

#### B2 — Use the hosted SealedMind backend

```typescript
import { SealedMind } from "@sealedmind/sdk";
const client = new SealedMind({ apiUrl: "https://sealedmind-backend-production.up.railway.app" });
```

We manage storage + encryption + TEE inference + capability checks.

**Verdict:** ⚠️ Hackathon-ready. Needs API keys + Postgres + npm publish
for production traffic (in our roadmap).

#### B3 — Self-host the SealedMind backend

```bash
git clone https://github.com/SealedMind/SealedMindMonoRepo
cd SealedMindMonoRepo/backend
cp ../.env.example .env  # add your own funded wallet
npm install && npm run build && npm start
```

You get a private gateway pointing at your own funded 0G wallet.

**Verdict:** ⚠️ Possible but undocumented for production — works
end-to-end as we've validated locally.

### Path C · Cherry-pick one piece

| What you want | What you call | Status |
|---|---|---|
| TEE-attested LLM only | `POST /v1/inference/chat` | ⚠️ adding API keys |
| On-chain capability sharing | `CapabilityRegistry` contract | ✅ |
| Encrypted KV storage as a Python lib | `from evermemos_sealedmind import SealedMindKVStorage` standalone | ✅ |
| ERC-7857 iNFT for agent memory ownership | `SealedMindNFT` contract | ✅ |
| Verifiable memory access log | `MemoryAccessLog` contract | ✅ |
| TypeScript SDK | `@sealedmind/sdk` | ⚠️ npm publish in flight |

---

## The live two-agent demo

**Story:** Alice is a runner with an AI assistant called Aria. Her
doctor (Dr. Chen) has her own clinical AI assistant. Alice wants Dr.
Chen's agent to read her fitness data — for 30 days, read-only,
revocable any time.

**Where to see it:** `frontend/src/pages/Demo.tsx`, route `/demo`.

**Brains:**
* Aria → Anthropic Claude Sonnet 4.6 (full agentic tool calling)
* Dr. Chen's assistant → Claude Sonnet 4.6 (orchestration) + Qwen 2.5 7B in Intel TDX (TEE-attested clinical summary of decrypted memory)

**Tools the agents can call:**
* `remember(content, shard)` — encrypts + writes via SealedMindKVStorage
* `recall(key)` — reads via gateway-verified capability
* `list_shard()` — discover available memories in an accessible shard
* `share_with(grantee_address, shard, days)` — on-chain `grantCapability`
* `revoke(capability_token)` — on-chain `revokeCapability`

**The 5-turn dialog you can re-record at any time:**

1. **Alice:** "Just finished an 8 km run in 45 minutes — felt great, splits were even."
2. **Alice:** "Share my fitness data with Dr. Chen's clinical assistant for 30 days. Their wallet is `0x21fc...`"
3. **Dr. Chen:** "What's the patient's most recent running activity?"
4. **Alice:** "Actually, revoke Dr. Chen's access."
5. **Dr. Chen:** "Has the patient logged any new activity since?"

Each turn shows: which tool the LLM picked, what happened on chain
(real tx hash + clickable explorer link), what the TEE attestation
returned (real chatId from Sealed Inference), and the final reply.

---

## Deployed infrastructure

### 0G Mainnet (chainId 16661) — explorer https://chainscan.0g.ai

| Contract | Address |
|---|---|
| `Verifier` | `0x6D5B3B81119F78366B767DB81C2dd6625d5648Af` |
| `SealedMindNFT` | `0x091CfC4b9E6FF0026F384b8c4664B8C03Af21EA6` |
| `CapabilityRegistry` | `0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45` |
| `MemoryAccessLog` | `0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad` |

### 0G Testnet (chainId 16602) — explorer https://chainscan-galileo.0g.ai

| Contract | Address |
|---|---|
| `Verifier` | `0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd` |
| `SealedMindNFT` | `0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7` |
| `CapabilityRegistry` | `0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66` |
| `MemoryAccessLog` | `0xB085F48c98E8878ACA88460B37653cC8d2E24482` |

### Live services

| Service | URL |
|---|---|
| Hosted backend | https://sealedmind-backend-production.up.railway.app |
| Frontend | https://sealedmind.vercel.app |
| Source — monorepo | https://github.com/SealedMind/SealedMindMonoRepo |
| Source — backend | https://github.com/SealedMind/sealedmind-backend |

### 0G stack we use

* **0G Chain** — EVM-compatible mainnet (16661) + testnet (16602)
* **0G Storage** — encrypted blob persistence via `@0gfoundation/0g-ts-sdk` (Node) and `zg-storage` (Python)
* **0G Compute / Sealed Inference** — Qwen 2.5 7B in Intel TDX + NVIDIA H100, accessed via `@0glabs/0g-serving-broker`
* **0G KV Server** (`zgs_kv`) — local KV node syncing from chain (used by 0G Memory and our addon)
* **0G Memory (EverMemOS)** — what our addon plugs into

---

## Security model

### Threat model — what SealedMind defends against

✅ **Stolen local SQLite index** — reveals nothing. Keys are HMAC-blinded
under a master key in memory; values are pointers to ciphertext.

✅ **Stolen 0G Storage blobs** — useless without the per-namespace DEK.
AAD-bound to the blinded key handle, so swap attacks fail.

✅ **Compromised storage node** — same as above.

✅ **Lost or leaked plaintext `user_secrets_backup.json`** — replaced
with an AES-GCM envelope under a 32-byte master key.

✅ **Unauthorized cross-agent reads** — gated by on-chain
`CapabilityRegistry.verifyCapability` which is checked on every read.
Revocation is instant (no cache to chase).

✅ **Untrusted LLM operator** — sensitive reads go through Sealed
Inference (Qwen in Intel TDX) with a real attestation per response.

### What SealedMind does NOT defend against

❌ **Compromised user wallet** — the wallet is the root of trust. If
someone steals the seed phrase, they can decrypt everything.

❌ **Compromised operator master key (`SEALEDMIND_BACKUP_KEY`)** — in
server-mode deployments, the operator holds a root key from which
per-user keys are derived via HKDF. If that root key is stolen, all
users' data is exposed. (Mitigation: HSM-backed root key, per-user SIWE
sessions in real production.)

❌ **Side-channel attacks against Intel TDX itself** — inheritance from
Intel TDX threat model. SealedMind doesn't add or remove any TEE
guarantees beyond what TDX provides.

❌ **Frontend XSS / wallet phishing** — standard browser threat model.
SealedMind's threat model assumes a non-malicious frontend.

❌ **Quantum adversary** — AES-256 + ECDSA secp256k1 are pre-quantum.
Long-term confidentiality against a future quantum adversary requires
post-quantum upgrades.

### Cryptographic primitives

| Use | Primitive |
|---|---|
| Master key derivation from SIWE signature | HKDF-SHA256 with domain separator |
| Per-namespace data encryption key | HKDF-SHA256, salt = namespace |
| Local key blinding | HMAC-SHA256 |
| Value encryption | AES-256-GCM (12-byte nonce, AAD = blinded key) |
| Capability signing | secp256k1 (ECDSA via web3 / wallet) |
| TEE attestation | Intel TDX DCAP quotes (verified by SealedMind backend; raw quotes available via `/v1/attestations`) |

---

## Real on-chain proofs

Run on 0G testnet during development — every link is verifiable.

| Event | Tx hash |
|---|---|
| SealedMindNFT.mint(tokenId=0) → patient wallet | [`0x76abb94f7af62b303c5b3da6cae6a4419dc57f16cc4764aedfcde416dead5e0f`](https://chainscan-galileo.0g.ai/tx/0x76abb94f7af62b303c5b3da6cae6a4419dc57f16cc4764aedfcde416dead5e0f) |
| Real encrypted blob upload to 0G Storage | rootHash `0xbdcf8d1673d5c157154f1064a079b546f782083432bedd1e12e6b21cf6071222` ([tx](https://chainscan-galileo.0g.ai/tx/0xbdcf8d1673d5c157154f1064a079b546f782083432bedd1e12e6b21cf6071222)) |
| SealedMindKVStorage commit through local zgs_kv → on-chain tx 59409 | (visible in `/tmp/log_SealedMindKVStorage_*.txt`) |
| `CapabilityRegistry.grantCapability` | [`0x55e163f29b72ab7575292902291b38372abd12f2fbf516a35f6f234c5bad5e33`](https://chainscan-galileo.0g.ai/tx/0x55e163f29b72ab7575292902291b38372abd12f2fbf516a35f6f234c5bad5e33) |
| Capability token issued | `0x21d10b5cb47f592d14ae15f249886138e86479cf3fd4ed281d0c34d257748821` |
| Doctor agent's TEE-attested recall (Sealed Inference chatId) | `0d7285d1-f216-45e0-aa0c-a8f0a159bf4f` (`attestationValid: True`, `enclave: Intel TDX`) |
| `CapabilityRegistry.revokeCapability` | [`0x458edf4a45669d9d0c2aa8ea05976928c815b381e4e003ecf3acc9f1c1ec4e04`](https://chainscan-galileo.0g.ai/tx/0x458edf4a45669d9d0c2aa8ea05976928c815b381e4e003ecf3acc9f1c1ec4e04) |
| Doctor's post-revoke `recall` denied | `verifyCapability(...)` returned `false` on chain |

Plus 7 unit tests passing for the crypto primitives (envelope round-trip,
tamper detection, AAD binding, key isolation per namespace, deterministic
SIWE-derived master key recovery).

---

## Repo structure

```
SealedMindMonoRepo/
├── README.md                       # dev-focused setup guide
├── OVERVIEW.md                     # ← you are here
│
├── contracts/                      # Solidity 0.8.24, Hardhat, ethers v6
│   ├── contracts/                  # Verifier, SealedMindNFT, CapabilityRegistry, MemoryAccessLog
│   ├── test/                       # Hardhat tests
│   └── deployments/                # mainnet + testnet deployment receipts
│
├── backend/                        # Express + TS, runs on Railway
│   └── src/
│       ├── api/                    # routes (auth, minds, memory, capabilities, attestations, inference)
│       └── services/               # MemoryEngine, InferenceService, StorageService, EmbeddingService, EngineRegistry
│
├── sdk/                            # @sealedmind/sdk — TS client over backend
│
├── frontend/                       # Vite + React 19 + Tailwind 4 + RainbowKit + wagmi/viem
│   └── src/
│       ├── pages/                  # Landing, Dashboard, Chat, Sharing, Demo
│       ├── components/             # Layout, MindSeal, AttestationBadge, etc
│       └── lib/                    # SDK wrapper + agent bridge client
│
├── cli/                            # @sealedmind/cli — operational tooling
│
├── openclaw-skill/                 # OpenClaw skill that uses SealedMind end-to-end
│   └── life-os-agent/              # the demo agent
│
└── evermemos-sealedmind/           # Python addon for 0G Memory
    ├── evermemos_sealedmind/
    │   ├── kv_storage/             # SealedMindKVStorage + UserAwareSealedMindKVStorage
    │   ├── auth/                   # WalletVault + SIWE verification
    │   ├── capabilities/           # CapabilityClient (web3.py)
    │   ├── inference/              # SealedInferenceClient
    │   ├── crypto/                 # HKDF + envelope + key blinding
    │   ├── components/             # @component lifespan override for KV_STORAGE_TYPE=sealedmind
    │   └── addon.py                # entry point for memsys.addons
    ├── tests/                      # 7 unit + 2 integration (gated by RUN_INTEGRATION=1)
    └── examples/
        ├── agent_demo.py           # cinematic terminal two-agent demo
        ├── agent_server.py         # FastAPI+WS bridge for the frontend Demo page
        ├── agents/                 # LangGraph MemoryAgent + LLM backends + tools + personas
        ├── verify_*.py             # standalone verification scripts (addon, storage, inference)
        ├── mint_testnet_mind.py    # mint a SealedMindNFT for testing
        ├── end_to_end_production_path.py  # exercises real production read/write
        ├── two_agent_live_demo.py  # cinematic capability-flow demo
        └── RECORD_DEMO.sh          # orchestrator for the recording session
```

---

## Reproducing everything locally

### Prerequisites

* Node 20+, Python 3.12+, `uv` or `pip`
* A funded 0G testnet wallet (faucet at https://faucet.0g.ai)
* Optional: Anthropic API key (only for the live agent demo)

### 1. Clone + install

```bash
git clone https://github.com/SealedMind/SealedMindMonoRepo
cd SealedMindMonoRepo

# evermemos-sealedmind addon
cd evermemos-sealedmind
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"

# (separate shell) backend
cd ../backend
npm install && npm run build

# (separate shell) frontend
cd ../frontend
npm install
```

### 2. Optional — clone 0G Memory next to the monorepo

```bash
cd ..  # parent of SealedMindMonoRepo
git clone https://github.com/0gfoundation/0g-memory
cd 0g-memory
./install.sh   # downloads zgs_kv, generates .0g_secrets, sets up Docker compose
```

### 3. Run unit tests

```bash
cd evermemos-sealedmind
.venv/bin/pytest                    # 7 unit tests (offline)
```

### 4. Verify end-to-end on 0G testnet

```bash
# (a) mint a Mind
SEALEDMIND_PRIVATE_KEY=0x... .venv/bin/python examples/mint_testnet_mind.py
#  prints tokenId — note it

# (b) run the cinematic demo
RUN_INTEGRATION=1 \
SEALEDMIND_NETWORK=testnet \
SEALEDMIND_PRIVATE_KEY=0x... \
SEALEDMIND_TEST_MIND_ID=<token id> \
SEALEDMIND_TEST_GRANTEE=0x... \
.venv/bin/pytest -v tests/test_capabilities_integration.py

# (c) run the live agent demo
ANTHROPIC_API_KEY=sk-... \
SEALEDMIND_PRIVATE_KEY=0x... \
DOCTOR_ADDRESS=0x... \
PATIENT_MIND_ID=<token id> \
ZEROG_STREAM_ID=$(grep ZEROG_STREAM_ID ../0g-memory/.0g_secrets | cut -d= -f2) \
SEALEDMIND_BACKUP_KEY=$(grep ZEROG_ENCRYPTION_KEY ../0g-memory/.0g_secrets | cut -d= -f2) \
PYTHONPATH=. \
.venv/bin/python examples/agent_demo.py
```

### 5. Frontend live demo

```bash
# terminal 1 — local KV node
cd ../0g-memory/0g_kv_server
./zgs_kv --config config_testnet_turbo.toml

# terminal 2 — agent bridge
cd evermemos-sealedmind
ANTHROPIC_API_KEY=sk-... <other env...> \
PYTHONPATH=. .venv/bin/python examples/agent_server.py

# terminal 3 — frontend
cd frontend && npm run dev
# open http://localhost:5173/demo
```

---

## Production roadmap

### Shipping now (in order)

1. **API keys + rate limit on `/v1/inference/chat`** ← currently anyone can drain wallet
2. **Verify all 8 contracts on chainscan** (mainnet + testnet)
3. **Publish `evermemos-sealedmind` to PyPI**
4. **Publish `@sealedmind/sdk` to npm**
5. **Docs site** at `docs.sealedmind.io`
6. **Postgres-backed sessions** (deferred for hackathon — not needed without real users)

### Next milestone

7. Per-user metrics + structured logging (Prometheus)
8. CI on GitHub Actions (lint + unit + integration on a cron)
9. Capability cache layer (60s in-memory, busted on revoke)
10. Mainnet integration test suite (weekly cron)

### Long horizon

11. ERC-7857 transfer flow integration with re-encryption oracle
12. Multi-region storage redundancy
13. Threshold capability signatures (k-of-n)
14. Reference TEE attestation verifier (full DCAP quote validation)

---

## Built for, built by, built on

* **Built for:** the 0G APAC Hackathon (May 2026)
* **Built on:**
  * 0G Chain (mainnet 16661, testnet 16602)
  * 0G Storage (`@0gfoundation/0g-ts-sdk`, `zg-storage`)
  * 0G Compute (Sealed Inference Qwen 2.5 7B in Intel TDX)
  * 0G Memory (EverMemOS) — for the addon path
  * Anthropic Claude Sonnet 4.6 (agent reasoning brain)
  * Hardhat, ethers v6, web3.py, viem/wagmi, RainbowKit
  * LangGraph (agent state graphs)
  * FastAPI (agent bridge for the frontend demo)
  * cryptography (Python AEAD), siwe, eth-account
* **Open source:** MIT license

---

## FAQ

**Q. Do I need 0G Memory to use SealedMind?**
A. No. 0G Memory integration is just one of three paths. You can call our
contracts directly (Path B1) or use the hosted backend (Path B2) from any
agent stack.

**Q. Is the encryption end-to-end? Who can read my data?**
A. Only the holder of the wallet whose SIWE-derived master key wraps the
data. In `KV_STORAGE_TYPE=sealedmind` server mode, the operator holds a
root from which per-user keys are derived via HKDF — same trust model as
any password-manager service. Self-host if you want zero operator trust.

**Q. What happens if I lose my wallet?**
A. You lose access to memories that were keyed under that wallet. Same as
losing the seed phrase to any crypto wallet. We don't have a backdoor.

**Q. How is this different from just encrypting locally?**
A. Three things: (1) the encryption key derivation is wallet-bound and
deterministic across devices — re-sign on a new device and recover; (2)
the storage is decentralized on 0G Storage, not on our servers; (3)
sharing with another agent is mediated by an on-chain capability the
data owner can revoke any time.

**Q. Why not just use IPFS + a regular AES key?**
A. You'd lose: deterministic recovery from re-signing, the on-chain
capability primitive, the TEE attestation, ERC-7857 ownership transfer,
and the audit log. SealedMind is the bundle.

**Q. What's the cost to use it?**
A. Contracts cost gas on 0G mainnet (cheap). 0G Storage charges for
durability. Sealed Inference charges per request (Qwen in TDX). The
addon and SDK are free / MIT.

**Q. What's the cost to deploy SealedMind from scratch?**
A. ~3 0G for the four contracts on mainnet (verified during deploy).
Backend hosting is whatever you pay for Railway/Render/Fly. Domain is
optional.

**Q. Is the threat model formally documented? Audited?**
A. Threat model section above. Not yet externally audited — that's a
Phase-2 ask once we have a budget. Crypto primitives are standard
(AES-256-GCM, HKDF-SHA256, secp256k1) — no novel cryptography.

**Q. Why "Sealed" in the name?**
A. Sealed = encrypted + attested + on-chain anchored. The user's memory
is sealed in three layers: hardware (TEE), cryptography (AES-GCM), and
chain (capability + iNFT).

---

*Last updated: 2026-04-30 · monorepo @ `SealedMind/SealedMindMonoRepo`*

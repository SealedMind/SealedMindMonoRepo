---
name: sealedmind-memory
description: Encrypted, user-owned long-term memory. Sealed inside Intel TDX + NVIDIA H100 TEE, stored permanently on 0G decentralized storage, anchored to an ERC-7857 iNFT the user controls. Use whenever the user expects you to remember facts across conversations.
homepage: https://github.com/SealedMind/SealedMindMonoRepo
user-invocable: true
---

# SealedMind Memory Skill

Give the agent durable, encrypted memory that lives in the user's ERC-7857 "Mind" NFT on 0G Chain. Every read and write is sealed inside an Intel TDX + NVIDIA H100 TEE and returns a verifiable on-chain attestation. Memories persist forever — across sessions, devices, and agents.

## When to use

- User shares a durable personal fact → call `remember`
  - "I'm allergic to penicillin"
  - "My partner's birthday is March 4th"
  - "I prefer TypeScript over JavaScript"
  - "I take metformin 500mg twice a day"
- User references something they expect you to know → call `recall` BEFORE answering
  - "What should the vet know about me?"
  - "What am I working on this week?"
  - "Do you remember my health conditions?"
  - "What are my coding preferences?"
- User wants to share memory with another agent or wallet → call `grant`

## When NOT to use

- Ephemeral chitchat ("lol", "ok thanks", "sounds good")
- Passwords, seed phrases, or private keys — refuse and warn the user
- Information about third parties without their explicit consent
- Something only relevant to the current conversation (no persistence needed)

## Setup (one-time)

```bash
# 1. Install the SealedMind CLI
npm install -g @sealedmind/cli

# 2. Login with your wallet private key — saves credentials to ~/.sealedmind/config.json
sealedmind login --private-key <YOUR_PRIVATE_KEY> --host http://localhost:4000

# Done. No env vars needed after this. The CLI reads from ~/.sealedmind/config.json.
```

That's it. No browser. No token copying. Run `sealedmind login` once and all commands work.

---

## recall — answer questions using the user's sealed memories

Call this BEFORE answering any question where the user expects personal context.

```bash
sealedmind recall --query "<the user's question or topic>" --top-k 5
```

Add `--shard <name>` to search a specific shard (`health`, `work`, `preferences`, `finance`).

**Output:**
```json
{
  "answer": "You are allergic to shellfish and penicillin.",
  "memories": [
    { "content": "allergic to shellfish", "shard": "health", "cid": "0x..." },
    { "content": "allergic to penicillin", "shard": "health", "cid": "0x..." }
  ],
  "attestation": { "chatId": "0x...", "verified": true, "enclave": "Intel TDX" }
}
```

Use `answer` as the basis of your reply. Always cite the attestation so the user can verify:
> You are allergic to shellfish and penicillin. *(Sealed memory · TEE-attested · `0x123…abc`)*

---

## remember — seal a new fact into the user's Mind

Run this whenever the user shares a durable personal fact worth keeping.

```bash
sealedmind remember --content "<the durable fact>" --shard <shard-name>
```

Use these shards:
| Shard | What goes in it |
|---|---|
| `health` | allergies, medications, conditions, vitals |
| `work` | projects, tech stack, deadlines, colleagues |
| `preferences` | communication style, food, aesthetics, tools |
| `finance` | goals, risk tolerance, budget rules |
| `personal` | family, relationships, life events |

**Output:**
```json
{
  "sealed": 2,
  "memories": [
    {
      "content": "allergic to shellfish",
      "shard": "health",
      "cid": "0xabc...",
      "txHash": "0xdef...",
      "explorer": "https://chainscan-galileo.0g.ai/tx/0xdef..."
    }
  ],
  "attestation": { "chatId": "0x...", "verified": true }
}
```

Confirm to the user in one line, include the explorer link:
> Sealed. Stored on 0G. [View proof](https://chainscan-galileo.0g.ai/tx/0x...)  *(TEE-attested)*

Note: `remember` takes ~20–40 seconds (TEE fact extraction + 0G Storage upload). This is normal — do not retry.

---

## grant — share a shard with another wallet or agent

Only run when the user **explicitly** asks to share with a specific address. Never infer this.

```bash
sealedmind grant \
  --shard health \
  --to 0xGRANTEE_ADDRESS \
  --expiry-days 30 \
  --read-only
```

**Output:**
```json
{
  "capId": "cap_a1b2c3d4",
  "shard": "health",
  "grantee": "0x...",
  "readOnly": true,
  "expiry": 1234567890,
  "explorer": "https://chainscan-galileo.0g.ai/address/0x..."
}
```

Surface both the `capId` and the explorer link:
> Granted. Capability `cap_a1b2c3d4` — `0xGrantee` can now read your `health` shard for 30 days. [View on-chain](https://chainscan-galileo.0g.ai/…)

---

## Failure modes

| Error | Fix |
|---|---|
| `error: not authenticated. Run sealedmind login` | Run `sealedmind login --private-key <key>` |
| HTTP 401 | Session expired — run `sealedmind login` again |
| HTTP 403 | No capability for this shard — tell user to grant access |
| Network timeout | Retry once. If fails again, surface the error and stop |
| `sealedmind: command not found` | Run `npm install -g @sealedmind/cli` |

# Life OS — Demo Script for Judges

This script shows the full SealedMind capability in ~5 minutes using the Life OS
OpenClaw agent. Every memory operation is real — TEE-attested, stored on 0G,
verifiable on-chain.

## Prerequisites

```bash
# Backend running
cd sealedmind/backend && npm start

# CLI logged in (one-time)
sealedmind login --private-key $PRIVATE_KEY --host http://localhost:4000

# OpenClaw running with Life OS agent loaded
```

---

## Act 1 — Building the Memory (Session 1)

**Goal:** Show the agent proactively remembering facts and returning on-chain proof.

---

> **User:** Hey, I should tell you a few things about myself.
> I'm allergic to shellfish and penicillin.
> I'm a software engineer building a DeFi protocol in Solidity and React.
> I prefer concise answers and I work best in the mornings.

**Agent does (invisibly):**
```bash
sealedmind remember --content "allergic to shellfish and penicillin" --shard health
sealedmind remember --content "software engineer building a DeFi protocol in Solidity and React" --shard work
sealedmind remember --content "prefers concise answers, works best in the mornings" --shard preferences
```

**Agent responds:**
```
Got it — sealing three facts to your Mind now (takes ~30s each)...

✓ Health: allergic to shellfish and penicillin
  Proof: https://chainscan-galileo.0g.ai/tx/0x1a2b...  (TEE-attested)

✓ Work: DeFi protocol, Solidity + React
  Proof: https://chainscan-galileo.0g.ai/tx/0x3c4d...  (TEE-attested)

✓ Preferences: concise answers, morning person
  Proof: https://chainscan-galileo.0g.ai/tx/0x5e6f...  (TEE-attested)

All three are now sealed in your ERC-7857 Mind NFT on 0G Chain.
They'll be here next session, next year, on any device.
```

**What to show judges:** Click one of the explorer links live. The transaction is real.

---

> **User:** I also take metformin 500mg twice daily for type 2 diabetes.
> My risk tolerance for investments is moderate — I don't want to lose more than 20%.

**Agent does:**
```bash
sealedmind remember --content "takes metformin 500mg twice daily for type 2 diabetes" --shard health
sealedmind remember --content "moderate investment risk tolerance, max drawdown 20%" --shard finance
```

**Agent responds:**
```
Sealed:
✓ Health: metformin 500mg twice daily, type 2 diabetes
  Proof: https://chainscan-galileo.0g.ai/tx/0x7a8b...

✓ Finance: moderate risk, max 20% drawdown
  Proof: https://chainscan-galileo.0g.ai/tx/0x9c0d...
```

---

## Act 2 — Recall Across Sessions (Session 2)

**Goal:** Close the previous conversation entirely, start a fresh one. Show zero context carryover from the chat — but memory is intact.

> *(Close the OpenClaw window. Reopen it. Start a new conversation.)*

---

> **User:** Hey, what should I have for dinner tonight?

**Agent does:**
```bash
sealedmind recall --query "dietary restrictions and food preferences" --shard health
```

**Agent responds:**
```
From your sealed memory (TEE-attested · 0x1a2b...):

You're allergic to shellfish and penicillin, and you have type 2 diabetes
(taking metformin). For dinner: avoid shellfish entirely. Go easy on refined
carbs — grilled protein + vegetables is a safe bet.

How about grilled chicken with roasted vegetables and a side salad?
```

**What to show judges:** No context was passed. The agent recalled this from encrypted storage on 0G — not from the chat history.

---

> **User:** What am I working on?

**Agent does:**
```bash
sealedmind recall --query "current work projects and tech stack" --shard work
```

**Agent responds:**
```
From your sealed memory (TEE-attested · 0x3c4d...):

You're building a DeFi protocol in Solidity and React.
Want me to help with something specific — smart contract review,
frontend architecture, or something else?
```

---

> **User:** Is Bitcoin a good investment for me right now?

**Agent does:**
```bash
sealedmind recall --query "investment risk tolerance and financial goals" --shard finance
```

**Agent responds:**
```
From your sealed memory (TEE-attested · 0x9c0d...):

Your risk tolerance is moderate with a max drawdown of 20%. Bitcoin historically
sees drawdowns of 50–80%, which exceeds your comfort level for a large position.
A small allocation (5–10% of portfolio) would stay within your parameters.
```

---

## Act 3 — Cross-Agent Sharing (The Power Move)

**Goal:** Show selective access control — grant a health coach AI read-only access to the health shard only.

---

> **User:** My health coach uses an AI assistant. Her wallet is 0xCoach7f3A.
> Can you give her read-only access to my health data for the next 30 days?

**Agent does:**
```bash
sealedmind grant \
  --shard health \
  --to 0xCoach7f3A \
  --expiry-days 30 \
  --read-only
```

**Agent responds:**
```
Done. Your health coach's AI (0xCoach7f3A) now has read-only access
to your health shard for 30 days.

Capability ID: cap_a1b2c3d4
On-chain grant: https://chainscan-galileo.0g.ai/address/0xf6b3...

She can see: allergies, medications, conditions.
She cannot see: your work, finances, or preferences.
You can revoke this any time — just ask me.
```

**What to show judges:** The grant is enforced at the API level — the health coach agent calling recall with a different wallet gets `health` shard only. Any other shard returns 403.

---

## Act 4 — The Proof (30 seconds)

Show the judge this:

1. Open any of the 0G explorer links from the remember outputs
2. Show the transaction is real, the hash is immutable
3. Say: *"That's not a database entry. That's a blockchain transaction proving this memory was processed inside a hardware enclave and stored permanently on decentralized storage. No company — including us — can delete or modify it."*

---

## Key judge questions + answers

**Q: Can you read the user's memories?**
A: No. Each user's memories are encrypted with a key derived from their wallet address. We never see the key. The TEE processes the data inside hardware we can't access.

**Q: What happens if your backend goes down?**
A: Memories are on 0G Storage permanently. The backend is just the access layer. Rebuild it, plug in the same `KEY_DERIVATION_SECRET`, same wallet → same memories.

**Q: Why not just use a regular database?**
A: Three reasons: (1) TEE attestation proves the AI processed it inside hardware — no prompt injection, no model swaps. (2) 0G Storage is permanent and censorship-resistant. (3) The ERC-7857 NFT makes the memory transferable — you can sell or migrate your Mind.

**Q: How is this different from ChatGPT memory?**
A: ChatGPT memory lives on OpenAI's servers. They can read it, delete it, and it disappears if you close your account. SealedMind memory is yours — on-chain, encrypted, hardware-verified.

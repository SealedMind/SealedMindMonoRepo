---
name: sealedmind-memory
description: Encrypted, user-owned long-term memory. Sealed inside Intel TDX, stored on 0G, anchored to an ERC-7857 NFT the user controls. Use whenever the user expects you to remember facts across conversations.
homepage: https://github.com/SealedMind/SealedMindMonoRepo
user-invocable: true
---

# SealedMind Memory

Give the agent durable, encrypted memory that lives in the user's own ERC-7857
"Mind" NFT on 0G Chain. Every read and write is sealed inside an Intel TDX
+ NVIDIA H100 TEE and returns a verifiable on-chain attestation.

## When to use

- The user shares a durable fact ("I'm allergic to penicillin", "my partner's
  birthday is March 4th", "I prefer morning meetings") → call `remember`.
- The user references something they expect you to know about them
  ("what should the vet know about me?", "remind me of my goals",
  "do you remember what I told you?") → call `recall` BEFORE answering.
- The user asks to share memory with another agent or wallet → call `grant`.

## When NOT to use

- Ephemeral chitchat. Don't seal "lol" or "ok thanks".
- Sensitive credentials (passwords, seed phrases) — refuse and warn the user.
- Information about third parties without their consent.
- When the user is clearly asking about something from the current conversation
  only (no cross-session persistence needed).

## Setup (one-time, by the user)

1. Install the CLI:
   ```bash
   npm install -g @sealedmind/cli
   ```
2. Sign in via the SealedMind dApp, mint a Mind, and copy your session token
   from the browser devtools (Application → Local Storage → `sealedmind:session`
   → `token`).
3. Set these environment variables in your shell config (`~/.zshrc`, `~/.bashrc`,
   or your OpenClaw `.env`):
   ```bash
   export SEALEDMIND_API_URL=https://api.sealedmind.xyz
   export SEALEDMIND_SESSION=<paste token from dApp>
   export SEALEDMIND_MIND_ID=<your mind id>
   ```
4. Restart OpenClaw (or reload the daemon) after setting env vars so they are
   picked up by the shell that runs skill commands.

## Recall — answer questions about the user

Call this before answering any question where the user expects you to know
personal context that may not be in the current conversation.

```bash
sealedmind recall --mind "$SEALEDMIND_MIND_ID" --query "<the user's question or topic>" --top-k 5
```

Optional: add `--shard <name>` to restrict the search to one shard
(`personal`, `health`, `finance`, or `work`).

The output is JSON:
```json
{
  "answer": "...",
  "memories": [{ "content": "...", "shard": "...", "cid": "0x..." }],
  "attestation": { "chatId": "0x...", "verified": true, "enclave": "..." }
}
```

Use `answer` as the basis of your reply. Cite the attestation `chatId` inline
so the user can verify the TEE proof — e.g.:
> You are allergic to penicillin. *(Sealed memory · attestation `0x123…abc`)*

## Remember — seal new facts

Run this whenever the user shares a durable personal fact worth keeping across
conversations.

```bash
sealedmind remember --mind "$SEALEDMIND_MIND_ID" --content "<the durable fact>"
```

Optional: add `--shard <name>` to file the memory in a specific shard.

The output is JSON with `sealed` (count of facts extracted), `memories[]` with
storage CIDs, and `attestation`. Confirm in one short sentence:
> Sealed. CID `0xabc…def`. *(TEE-attested)*

Note: `remember` takes ~30 seconds end-to-end due to TEE fact extraction and
0G Storage finality. This is normal — do not retry.

## Grant — share a shard with another wallet

Only run this when the user **explicitly** asks to share a shard with a specific
wallet address. Never infer this intent.

```bash
sealedmind grant \
  --mind "$SEALEDMIND_MIND_ID" \
  --shard health \
  --to 0xHEALTHCOACH_ADDRESS \
  --expiry-days 14 \
  --read-only
```

Omit `--read-only` only if the user explicitly wants to grant write access.

The output includes a `capId` and an `explorer` link to the on-chain
`CapabilityRegistry` transaction. Surface both to the user:
> Granted. Capability `cap_abc123`. [View on explorer](https://chainscan-galileo.0g.ai/…)

## Failure modes

- `error: missing env var SEALEDMIND_SESSION` → tell the user to re-auth in the
  dApp and paste the new token into `SEALEDMIND_SESSION`, then restart OpenClaw.
- HTTP 401 → session expired; same fix as above.
- HTTP 403 → the requested shard is not accessible to this Mind or session.
- Network error / timeout → retry once. If it fails again, surface the raw
  error message and stop — do not loop.
- `sealedmind: command not found` → the CLI is not installed or not on PATH;
  ask the user to run `npm install -g @sealedmind/cli` and confirm with
  `sealedmind --help`.

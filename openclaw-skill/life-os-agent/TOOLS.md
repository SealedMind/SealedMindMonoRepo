# Tools — SealedMind CLI Reference

All memory operations go through the `sealedmind` CLI.
After `sealedmind login`, no flags for mind ID or tokens are needed.

---

## sealedmind recall

Search the user's encrypted memory and synthesize an answer via TEE.

```bash
sealedmind recall --query "<question or topic>"
sealedmind recall --query "<question>" --shard <shard-name>
sealedmind recall --query "<question>" --shard <shard-name> --top-k <n>
```

**Shards:** `health` | `work` | `preferences` | `finance` | `personal` | `general`

**Output:**
```json
{
  "answer": "You are allergic to shellfish.",
  "memories": [
    { "content": "allergic to shellfish", "shard": "health", "cid": "0x..." }
  ],
  "attestation": { "chatId": "0x...", "verified": true, "enclave": "Intel TDX" }
}
```

Use `answer` as the basis of your reply. Cite attestation inline:
> You are allergic to shellfish. *(TEE-attested · `0x123…`)*

---

## sealedmind remember

Seal a new fact into the user's encrypted Mind.

```bash
sealedmind remember --content "<fact to seal>" --shard <shard-name>
```

**Output:**
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
  "attestation": { "chatId": "0x...", "verified": true }
}
```

Takes ~20–40 seconds (TEE processing + 0G Storage). Do not retry during this time.
Always surface the `explorer` link to the user as proof.

---

## sealedmind grant

Grant another wallet read (or read-write) access to a shard.

```bash
sealedmind grant \
  --shard <shard-name> \
  --to <wallet-address> \
  --expiry-days <n> \
  --read-only
```

Only run when user explicitly asks with a specific address. Always confirm before running.

**Output:**
```json
{
  "capId": "cap_a1b2c3d4",
  "shard": "health",
  "grantee": "0x...",
  "readOnly": true,
  "expiry": 1234567890,
  "explorer": "https://chainscan-galileo.0g.ai/address/0xf6b3..."
}
```

---

## Error handling

| Error | Action |
|---|---|
| `error: not authenticated` | Ask user to run `sealedmind login` |
| HTTP 401 | Same — session/key expired |
| HTTP 403 | Tell user they don't have access to that shard |
| Timeout / network error | Retry once, then surface the raw error |
| `command not found` | Ask user to run `npm install -g @sealedmind/cli` |

# @sealedmind/sdk

TypeScript / JavaScript SDK for **SealedMind** — encrypted, capability-gated
AI memory on 0G.

```bash
npm install @sealedmind/sdk
```

## Quickstart

Get an API key in two clicks at https://sealedmind.vercel.app/developer
(connect wallet → SIWE sign → copy `sm_*` key).

```typescript
import { SealedMind } from "@sealedmind/sdk";

const client = new SealedMind({
  apiUrl: "https://sealedmind-backend-production.up.railway.app",
  apiKey: "sm_...",
});

// Create a Mind (mints an iNFT for the wallet bound to the key)
const { mind } = await client.createMind("my-agent");

// Store a memory — encrypted before upload
await client.remember(mind.id, {
  content: "User prefers vegetarian meals",
  shard: "preferences",
});

// Recall — TEE-attested response from Qwen 2.5 7B in Intel TDX
const result = await client.recall(mind.id, {
  query: "What does the user prefer to eat?",
});
console.log(result.answer);
console.log("attested in:", result.attestation.enclave);
```

## Capability sharing across agents

```typescript
// Patient grants doctor's agent read-only access to "fitness" shard for 30 days
const grant = await client.grantCapability(mind.id, {
  grantee: "0x21fc...",
  shard: "fitness",
  readOnly: true,
  expiry: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
});

// ...later, patient revokes
await client.revokeCapability(mind.id, grant.capId);
```

Capabilities are real on-chain transactions on the SealedMind
`CapabilityRegistry` contract on 0G mainnet. Revocation is enforced by
`verifyCapability` returning `false` on the next read.

## What this gives your project

- **Memories encrypted client-side** with AES-256-GCM under a key bound
  to the user's wallet. The backend never sees plaintext.
- **On-chain capability primitive** for sharing memory between agents —
  revocable any time, no caches to invalidate.
- **TEE-attested inference** (Qwen 2.5 7B in Intel TDX) for sensitive
  reads — every response carries a chatId you can re-verify.
- **ERC-7857 iNFT ownership** — your Mind is a tradeable asset, not
  vendor-locked data.

## Already on 0G Memory?

Use the Python addon instead — drop-in for `KVStorageInterface`:

```bash
pip install evermemos-sealedmind
```

## Docs

Full overview, architecture, threat model, deployed contract addresses,
integration paths:
https://github.com/SealedMind/SealedMindMonoRepo/blob/main/OVERVIEW.md

## License

MIT — https://github.com/SealedMind/SealedMindMonoRepo

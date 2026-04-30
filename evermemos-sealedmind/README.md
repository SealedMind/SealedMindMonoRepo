# evermemos-sealedmind

Privacy adapter for **0G Memory (EverMemOS)**: encrypted-at-rest storage on real
0G Storage, wallet-bound secrets, and on-chain capability sharing via
SealedMind contracts on 0G mainnet/testnet.

Plugs in via 0G Memory's `memsys.addons` entry point. Zero fork. Opt-in.

## What it fixes

| 0G Memory issue                                       | This addon                                           |
|-------------------------------------------------------|------------------------------------------------------|
| Plaintext `user_secrets_backup.json` (flagged unsafe) | `WalletVault` — SIWE-derived master key, encrypted   |
| `ZeroGKVStorage` writes raw bytes                     | `SealedMindKVStorage` — AES-256-GCM envelope on 0G   |
| No cross-agent sharing primitive                      | `CapabilityClient` — on-chain grant / verify / revoke |
| LLM calls go to untrusted endpoints                   | `SealedInferenceClient` — TEE-attested Qwen 2.5 7B   |

## Install

```bash
pip install evermemos-sealedmind
```

Then enable in 0G Memory:

```bash
export MEMSYS_ENTRYPOINTS_FILTER=core,sealedmind
export KV_STORAGE_TYPE=sealedmind
export MEMSYS_AUTH_PROVIDER=sealedmind
export SEALEDMIND_NETWORK=mainnet              # or testnet
export SEALEDMIND_DOMAIN=app.example.com
export SEALEDMIND_INFERENCE_URL=https://...    # your sealed inference gateway
```

## Run the storage sidecar

The Python addon uses the official Node SDK (`@0gfoundation/0g-ts-sdk`)
through a small local HTTP sidecar. There is no maintained Python client for
0G Storage segment uploads — this is the production path.

```bash
cd sidecar
npm install
SEALEDMIND_RPC_URL=https://evmrpc.0g.ai \
SEALEDMIND_INDEXER_URL=https://indexer-storage.0g.ai \
SEALEDMIND_PRIVATE_KEY=0x...funded_wallet... \
node src/server.js
# listens on http://127.0.0.1:7878 by default
```

Bind to loopback (default) or a private VPC. There is no auth on the wire.

## Architecture

```
┌──────────────────┐    siwe sig     ┌────────────────┐
│  Wallet (user)   │────────────────▶│   WalletVault   │
└──────────────────┘                 │ (master key in  │
                                     │  RAM only)      │
                                     └───────┬─────────┘
                                             │ DEK / index key
                                             ▼
                              ┌────────────────────────────┐
0G Memory ──KV API──▶ SealedMindKVStorage  ──env──▶ Node sidecar ──▶ 0G Storage
                              │           │                              (real)
                              │           ▼
                              │   Capability check
                              ▼           │
                         SQLite          ▼
                       (blinded keys, web3.py ──▶ CapabilityRegistry
                        ciphertext refs)              MemoryAccessLog
                                                      (0G chain, real)
```

## What is real, what is not

| Path                                       | Real / on-chain                                         |
|--------------------------------------------|---------------------------------------------------------|
| AES-256-GCM envelope encryption            | Real (`cryptography`)                                   |
| Master / DEK / index key derivation        | Real HKDF-SHA256                                        |
| Local key-name blinding                    | Real HMAC-SHA256                                        |
| 0G Storage upload / download               | Real, via `@0gfoundation/0g-ts-sdk` in the sidecar      |
| `CapabilityRegistry.grant / revoke / verify` | Real, web3.py against the deployed contract           |
| `MemoryAccessLog.logAccess`                | Real, web3.py — only called with a real attestation     |
| SIWE verification                          | Real, `siwe` package; rejects bad domain / chainId      |
| Sealed inference                           | Real call to your gateway; attestation hash from quote  |

There are no mocks in production code paths. Tests use real testnet for the
on-chain integration suite (gated by `RUN_INTEGRATION=1`); pure-math crypto
tests run offline.

## Deployed contracts

**0G Mainnet (chainId 16661)** — explorer: https://chainscan.0g.ai

| Contract            | Address                                      |
|---------------------|----------------------------------------------|
| Verifier            | `0x6D5B3B81119F78366B767DB81C2dd6625d5648Af` |
| SealedMindNFT       | `0x091CfC4b9E6FF0026F384b8c4664B8C03Af21EA6` |
| CapabilityRegistry  | `0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45` |
| MemoryAccessLog     | `0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad` |

**0G Testnet (chainId 16602)** — explorer: https://chainscan-galileo.0g.ai

| Contract            | Address                                      |
|---------------------|----------------------------------------------|
| Verifier            | `0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd` |
| SealedMindNFT       | `0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7` |
| CapabilityRegistry  | `0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66` |
| MemoryAccessLog     | `0xB085F48c98E8878ACA88460B37653cC8d2E24482` |

## Tests

```bash
# unit (no network)
pip install -e ".[dev]"
pytest

# integration against real 0G testnet
# (requires sidecar up + funded wallet)
RUN_INTEGRATION=1 \
SEALEDMIND_TEST_PRIVATE_KEY=0x... \
pytest tests/test_kv_storage_integration.py -v
```

## Two-agent demo (live, on-chain)

```bash
RUN_DEMO=1 \
SEALEDMIND_NETWORK=testnet \
SEALEDMIND_PRIVATE_KEY=0x...patient... \
PATIENT_MIND_ID=42 \
DOCTOR_ADDRESS=0x... \
python examples/two_agent_demo.py
```

The doctor reads under a real on-chain capability; the patient revokes; the
next read fails on-chain (verified via `CapabilityRegistry.verifyCapability`).

## Status

Pre-release. Built for the 0G APAC Hackathon (2026-05-09) and pending review
by the 0G Memory team before being listed as the recommended privacy adapter.

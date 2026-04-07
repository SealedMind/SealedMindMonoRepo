# SealedMind

> Your AI's lifetime memory — encrypted, permanent, transferable. Built on 0G.

The first portable memory layer for AI agents where privacy is hardware-enforced (0G Sealed Inference / TEE), persistence is decentralized (0G Storage), and ownership is cryptographic (ERC-7857 iNFT on 0G Chain).

See [`SEALEDMIND.md`](../SEALEDMIND.md) for the full design blueprint.

## Monorepo layout

```
sealedmind/
├── contracts/   # Solidity (Hardhat) — SealedMindNFT, CapabilityRegistry, MemoryAccessLog
├── backend/     # Express + TS API
├── sdk/         # @sealedmind/sdk (npm)
├── frontend/    # Next.js 14 dApp
└── docs/        # 0G integration notes, architecture, API
```

## 0G testnet (Galileo)
- RPC: `https://evmrpc-testnet.0g.ai` · Chain ID: `16602`
- Explorer: https://chainscan-galileo.0g.ai · Faucet: https://faucet.0g.ai

## Quick start

```bash
cp .env.example .env   # fill PRIVATE_KEY
cd contracts && npm install && npm test
```

## Status

Phase 0 — scaffold. See `docs/0g-integration-notes.md` for pinned 0G SDK versions and known divergences from the blueprint.

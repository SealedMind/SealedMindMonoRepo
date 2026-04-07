# 0G Integration Notes (pinned from official docs, 2026-04-07)

These supersede SEALEDMIND.md §8 where they conflict — blueprint had placeholder package names. Architecture is unchanged.

## 0G Chain — Testnet (Galileo)
- RPC: `https://evmrpc-testnet.0g.ai`
- Chain ID: **16602** (blueprint §8.3 lists 16661 — that is mainnet)
- Explorer: `https://chainscan-galileo.0g.ai`
- Faucet: `https://faucet.0g.ai`
- Solidity: 0.8.19+ ; compile with `--evm-version cancun`

## 0G Storage SDK
- Package: **`@0gfoundation/0g-ts-sdk`** (peer dep: `ethers`)
- Imports: `import { ZgFile, Indexer, MemData } from '@0gfoundation/0g-ts-sdk'`
- Indexer (testnet turbo): `https://indexer-storage-testnet-turbo.0g.ai`
- Upload: `indexer.upload(...)`
- Download: `indexer.download(rootHash, outputPath, true)` (with Merkle proof)
- KV: `batcher.streamDataBuilder.set(...)` / `kvClient.getValue(...)`

## 0G Compute / Sealed Inference SDK
- Package: **`@0glabs/0g-serving-broker`**
- Init: `import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'; const broker = await createZGComputeNetworkBroker(wallet);`
- **Open question (Phase 2.5 spike):** can we run custom embedding models (e5-large-v2) inside the TEE, or only hosted models? Docs don't say. Verification involves signer-address match + Docker Compose hash + sigstore/dstack-verifier. Plan a fallback per §17: pre-compute embeddings outside TEE, encrypt/decrypt only inside, if custom models not supported.

## ERC-7857 (iNFT)
- **No npm package.** Vendor from `https://github.com/0gfoundation/0g-agent-nft` (branch `eip-7857-draft`).
- **Real interface differs from blueprint §7** — `_beforeTokenTransfer` override approach is wrong. Actual interface:
  ```solidity
  interface IERC7857 is IERC721 {
      function transfer(address from, address to, uint256 tokenId, bytes calldata sealedKey, bytes calldata proof) external;
      function clone(address to, uint256 tokenId, bytes calldata sealedKey, bytes calldata proof) external returns (uint256);
      function authorizeUsage(uint256 tokenId, address executor, bytes calldata permissions) external;
  }
  ```
- Our `SealedMindNFT.sol` will adapt: `mintMind` keeps blueprint shape, but transfer flows go through `transfer(...sealedKey, proof)` where `proof` is the TEE re-encryption attestation.

## Action items before Phase 1 coding
- [ ] Clone `0g-agent-nft@eip-7857-draft`, copy `IERC7857.sol` + base impl into `contracts/lib/erc7857/`
- [ ] Hardhat config: network `og_testnet` { url, chainId: 16602, accounts: [PRIVATE_KEY] }
- [ ] `.env.example` with all endpoints above

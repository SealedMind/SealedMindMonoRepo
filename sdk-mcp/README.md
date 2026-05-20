# @sealedmind/mcp

> **Model Context Protocol server for SealedMind** — encrypted, TEE-attested AI memory on 0G. Drop into any MCP-compatible runtime to give your agent persistent memory.

`@sealedmind/mcp` is a thin stdio MCP server that wraps SealedMind's hosted REST API. Add it to your MCP config alongside any other MCP servers (`@foundryprotocol/mcp`, filesystem, sqlite, etc.) and your agent immediately gets six tools for encrypted memory + on-chain audit.

- **Encrypted** under your wallet-derived key (AES-256-GCM, HKDF)
- **TEE-attested** — every recall runs Qwen 2.5 7B inside Intel TDX + NVIDIA H100
- **On-chain audited** — every operation emits a `MemoryAccessLog` tx on 0G, chainscan-clickable from the verify response
- **Capability-shareable** — grant another wallet read access to one shard, revoke any time, all on chain

## Install / configure (one block)

Add this to your MCP host config (Claude Desktop's `claude_desktop_config.json`, Cursor's `mcp.json`, Cline's settings, or any custom runtime):

```json
{
  "mcpServers": {
    "sealedmind": {
      "command": "npx",
      "args": ["-y", "@sealedmind/mcp"],
      "env": {
        "SEALEDMIND_API_KEY": "sm_live_xxxxxxxxxxxx",
        "SEALEDMIND_DEFAULT_MIND_ID": "0xYourWalletAddress"
      }
    }
  }
}
```

Get an API key at **https://sealedmind.vercel.app/developer** — connect wallet, sign once, key in 30 seconds.

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `SEALEDMIND_API_KEY` | **yes** | — | Long-lived API key. `sm_*` for end-user wallet, `sm_op_*` for platform operators. |
| `SEALEDMIND_DEFAULT_MIND_ID` | no | — | The Mind (wallet address) tools operate on by default. If omitted, tools must receive `mindId` explicitly. |
| `SEALEDMIND_API_URL` | no | `https://sealedmind-backend-production.up.railway.app` | Override the hosted backend (e.g. for self-hosted deployments). |

## Tools the agent gets

| Tool | What it does |
|---|---|
| `sealedmind_remember` | Seal a fact into the user's encrypted Mind. Returns storage CID + chainscan tx. |
| `sealedmind_recall` | Semantic search + TEE-attested synthesis. Returns answer + supporting memories + attestation. |
| `sealedmind_grant_capability` | On-chain grant of shard access to another wallet (time-bound, revocable). |
| `sealedmind_list_capabilities` | List active capabilities the user has granted. |
| `sealedmind_revoke_capability` | Revoke a capability on chain. Next read attempt returns 403. |
| `sealedmind_verify_attestation` | Re-verify a chatId; returns chainscan-clickable proof. |

Each tool has rich descriptions and JSON Schema for arguments — the agent's planner can choose them autonomously.

## Example: an agent that uses both Foundry + SealedMind

```json
{
  "mcpServers": {
    "foundry": {
      "command": "npx",
      "args": ["-y", "@foundryprotocol/mcp"],
      "env": {
        "FOUNDRY_BASE_URL": "https://foundryprotocol.xyz",
        "FOUNDRY_DEFAULT_INGOT_ID": "0x8e2af4a000000000000000000000000000000001"
      }
    },
    "sealedmind": {
      "command": "npx",
      "args": ["-y", "@sealedmind/mcp"],
      "env": {
        "SEALEDMIND_API_KEY": "sm_live_xxxxxxxx",
        "SEALEDMIND_DEFAULT_MIND_ID": "0x..."
      }
    }
  }
}
```

The agent can now `sealedmind_recall` → feed memories into `run_inference` on a Foundry Ingot → `sealedmind_remember` the result. Sovereign memory + community-owned brains, side-by-side.

## Run it locally (development)

```bash
cd sdk-mcp
npm install
SEALEDMIND_API_KEY=sm_live_xxx \
SEALEDMIND_DEFAULT_MIND_ID=0xYourAddress \
npm run dev
```

The server logs to stderr (so it doesn't pollute the MCP stdio channel) and listens for JSON-RPC tool calls on stdin/stdout.

## Architecture

```
        agent runtime (Claude Desktop / Cursor / Cline / custom)
                              │
                              │ stdio (JSON-RPC)
                              ▼
                       @sealedmind/mcp
                              │
                              │ HTTPS (Bearer: sm_*)
                              ▼
            SealedMind hosted backend (Railway)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       0G Storage    0G Sealed Inference    0G Chain
       (ciphertext)  (Qwen-in-TDX)          (audit log + iNFT)
```

The MCP server holds no state. It's a stdio relay over HTTPS — your API key lives only in the env, never on disk.

## Security model

- **API key never touches disk.** Lives only in the env block of your MCP config.
- **Memory ciphertext never leaves the wallet's encryption boundary.** SealedMind backend treats blobs as opaque.
- **Every operation emits an on-chain receipt** on the [`MemoryAccessLog`](https://chainscan.0g.ai/address/0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad) contract on 0G mainnet (chain 16661).
- **Capability grants/revokes are on-chain** via the [`CapabilityRegistry`](https://chainscan.0g.ai/address/0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45).

Full threat model: https://sealedmind.vercel.app/architecture

## Links

- Site: https://sealedmind.vercel.app
- Source: https://github.com/SealedMind/SealedMindMonoRepo
- TypeScript SDK (for direct backend use): [`@sealedmind/sdk`](https://www.npmjs.com/package/@sealedmind/sdk)
- Python SDK: [`sealedmind` on PyPI](https://pypi.org/project/sealedmind/)
- 0G Memory addon: [`evermemos-sealedmind`](https://pypi.org/project/evermemos-sealedmind/)
- X: [@SealedMind_0G](https://x.com/SealedMind_0G)

## License

MIT

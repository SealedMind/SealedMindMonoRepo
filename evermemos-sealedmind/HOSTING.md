# Hosting the evermemos-sealedmind agent bridge

The agent bridge is a self-contained container — FastAPI + WebSocket
+ a bundled `zgs_kv` 0G KV node. Deploy it once and any frontend with
`VITE_AGENT_BRIDGE_URL` pointing at it can drive the live two-agent
demo.

---

## Required env (set in Railway / Render / Fly / wherever)

| Var | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Claude key for the patient agent |
| `SEALEDMIND_INFERENCE_API_KEY` | yes | Operator key for `/v1/inference/chat` (must match an entry in the SealedMind backend's `SEALEDMIND_OPERATOR_KEYS`) |
| `SEALEDMIND_PRIVATE_KEY` | yes | Funded 0G testnet wallet, `0x`-prefixed hex |
| `DOCTOR_ADDRESS` | yes | Any 0G address — the demo's "doctor" |
| `PATIENT_MIND_ID` | yes | The minted SealedMindNFT tokenId |
| `ZEROG_STREAM_ID` | no | Auto-generated if missing (64-hex) |
| `SEALEDMIND_BACKUP_KEY` | no | Auto-generated if missing (64-hex) |
| `PORT` | no | Auto-set by Railway/Render. Defaults to 8765. |

---

## Deploy on Railway (recommended)

1. New project → Deploy from GitHub repo → pick `SealedMindMonoRepo`
2. Set the **Root Directory** to `evermemos-sealedmind`
3. Set the env vars above (Settings → Variables)
4. Deploy. Railway detects the `Dockerfile` automatically.
5. Add a public domain (Settings → Networking → Generate Domain)
6. Confirm it's live:
   ```bash
   curl https://<your-domain>/api/state
   ```
   should return JSON with `patient`, `doctor`, etc.

**Optional but recommended:** add a Railway volume mounted at
`/opt/0g_kv_server/db` so the kv-server's chain-sync state persists
across restarts. Without it, every deploy re-syncs from scratch
(adds ~30-60s to boot).

## Deploy locally (Docker)

```bash
docker build -t sealedmind-agent-bridge .
docker run -p 8765:8765 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e SEALEDMIND_INFERENCE_API_KEY=sm_op_... \
  -e SEALEDMIND_PRIVATE_KEY=0x... \
  -e DOCTOR_ADDRESS=0x... \
  -e PATIENT_MIND_ID=0 \
  sealedmind-agent-bridge
```

Then point your local frontend at it:

```bash
VITE_AGENT_BRIDGE_URL=http://127.0.0.1:8765 npm run dev
```

---

## Wiring the frontend to the hosted bridge

The Vite frontend reads `VITE_AGENT_BRIDGE_URL` at build time. Set it
in your Vercel project (Project → Settings → Environment Variables) to
your hosted bridge URL, then redeploy.

After that, anyone visiting `https://your-frontend/demo` chats with
the live agents directly — no local setup needed.

---

## Boot sequence on container start

```
[entrypoint] generated ZEROG_STREAM_ID=...           (if not set)
[entrypoint] generated SEALEDMIND_BACKUP_KEY=...     (if not set)
[entrypoint] log_sync_start_block_number=30651912
[entrypoint] zgs_kv started pid=14
[entrypoint] zgs_kv up on :6789 (after 4s)
INFO:     Started server process [1]
INFO:     Uvicorn running on http://0.0.0.0:8765
```

If any required env is missing the bridge prints
`missing env: ...` and exits with code 2.

---

## Rate limits & costs

* Bridge → Sealed Inference: 30 req/min/key (configurable in
  `backend/src/api/middleware/rate_limit.ts`)
* Sealed Inference: per-call charges from the 0G Compute broker
* 0G Storage uploads: per-tx gas paid from `SEALEDMIND_PRIVATE_KEY`

For a public demo, set `SEALEDMIND_PRIVATE_KEY` to a wallet you've
funded with a small amount of testnet 0G. Refill via the 0G faucet
when it runs out.

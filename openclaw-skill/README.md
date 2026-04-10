# sealedmind-memory — OpenClaw Skill

Give your OpenClaw agent durable, encrypted long-term memory backed by [SealedMind](https://github.com/SealedMind/SealedMindMonoRepo).

## Quick start

```bash
# 1. Install the CLI
npm install -g @sealedmind/cli

# 2. Set env vars (get token + mind ID from the SealedMind dApp)
export SEALEDMIND_API_URL=https://api.sealedmind.xyz
export SEALEDMIND_SESSION=<your session token>
export SEALEDMIND_MIND_ID=<your mind id>

# 3. Install this skill into OpenClaw
openclaw skills install sealedmind-memory

# 4. Verify
sealedmind --help
```

The agent will now automatically remember facts you share and recall them in future conversations. Every read/write is sealed inside an Intel TDX + NVIDIA H100 TEE on 0G Chain.

See `SKILL.md` for full usage, failure modes, and grant/share instructions.

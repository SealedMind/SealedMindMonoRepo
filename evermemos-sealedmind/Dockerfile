# Self-contained agent bridge for evermemos-sealedmind.
#
# Bundles the FastAPI + WebSocket bridge AND a local zgs_kv node so the
# container can serve the live two-agent demo end-to-end without any
# external infrastructure.
#
# Required env at runtime:
#   ANTHROPIC_API_KEY              — patient agent (Claude)
#   SEALEDMIND_INFERENCE_API_KEY   — operator key for /v1/inference/chat
#   SEALEDMIND_PRIVATE_KEY         — funded 0G testnet wallet (0x-prefixed)
#   DOCTOR_ADDRESS                 — any 0G address
#   PATIENT_MIND_ID                — minted SealedMindNFT tokenId
#
# Optional (auto-generated if missing):
#   ZEROG_STREAM_ID
#   SEALEDMIND_BACKUP_KEY
#
# Build:  docker build -t sealedmind-agent-bridge .
# Local:  docker run -p 8765:8765 -e ANTHROPIC_API_KEY=... ... sealedmind-agent-bridge
# Railway: drop the repo, set the env vars, deploy.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libssl-dev libffi-dev pkg-config git curl unzip ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# zgs_kv binary (the local 0G KV node CachedKvClient talks to)
ARG ZGS_KV_VERSION=v1.5.1
RUN curl -L -o /tmp/zgs_kv.zip \
      "https://github.com/0gfoundation/0g-storage-kv/releases/download/${ZGS_KV_VERSION}/zgs_kv_linux.zip" \
 && mkdir -p /opt/0g_kv_server \
 && unzip -j /tmp/zgs_kv.zip -d /opt/0g_kv_server \
 && chmod +x /opt/0g_kv_server/zgs_kv \
 && rm /tmp/zgs_kv.zip

# Python package + bridge code
WORKDIR /app
COPY pyproject.toml ./
COPY evermemos_sealedmind ./evermemos_sealedmind
COPY examples ./examples

RUN pip install --upgrade pip \
 && pip install . \
 && pip install "fastapi>=0.110" "uvicorn[standard]>=0.27" "anthropic>=0.97" \
                "langgraph>=1.1" "langchain-core>=1.3"

COPY docker-entrypoint.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 8765
CMD ["/usr/local/bin/start.sh"]

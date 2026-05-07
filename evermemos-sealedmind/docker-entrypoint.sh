#!/usr/bin/env bash
# Entrypoint for the evermemos-sealedmind hosted agent bridge container.
#
# Steps:
#   1. Auto-generate ZEROG_STREAM_ID + SEALEDMIND_BACKUP_KEY if not provided
#   2. Render kv-server config from current testnet block
#   3. Start zgs_kv in the background
#   4. Wait for it to bind on :6789
#   5. exec uvicorn examples.agent_server:app on $PORT (or 8765)
set -euo pipefail

KV_DIR=/opt/0g_kv_server
CONFIG="$KV_DIR/config_testnet_turbo.toml"

if [ -z "${ZEROG_STREAM_ID:-}" ]; then
    export ZEROG_STREAM_ID="$(openssl rand -hex 32)"
    echo "[entrypoint] generated ZEROG_STREAM_ID=$ZEROG_STREAM_ID"
fi

if [ -z "${SEALEDMIND_BACKUP_KEY:-}" ]; then
    export SEALEDMIND_BACKUP_KEY="$(openssl rand -hex 32)"
    echo "[entrypoint] generated SEALEDMIND_BACKUP_KEY=$SEALEDMIND_BACKUP_KEY"
fi

CURRENT_BLOCK="$(curl -s -X POST -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    https://evmrpc-testnet.0g.ai \
    | python3 -c "import sys,json;print(int(json.load(sys.stdin)['result'],16))")"
echo "[entrypoint] log_sync_start_block_number=$CURRENT_BLOCK"

sed \
    -e "s|stream_ids = \[\"0000000000000000000000000000000000000000000000000000000000000000\"\]|stream_ids = [\"$ZEROG_STREAM_ID\"]|" \
    -e "s|encryption_key = \"0000000000000000000000000000000000000000000000000000000000000000\"|encryption_key = \"$SEALEDMIND_BACKUP_KEY\"|" \
    -e "s|log_sync_start_block_number = 1|log_sync_start_block_number = $CURRENT_BLOCK|" \
    "$KV_DIR/config_testnet_turbo.toml.example" > "$CONFIG"

mkdir -p "$KV_DIR/db"
cd "$KV_DIR"
./zgs_kv --config "$CONFIG" > /tmp/zgs_kv.log 2>&1 &
KV_PID=$!
echo "[entrypoint] zgs_kv started pid=$KV_PID"

for i in $(seq 1 90); do
    if (echo > /dev/tcp/127.0.0.1/6789) 2>/dev/null; then
        echo "[entrypoint] zgs_kv up on :6789 (after ${i}s)"
        break
    fi
    sleep 1
done

export ZEROG_READ_NODE=http://127.0.0.1:6789

cd /app
exec uvicorn examples.agent_server:app \
    --host 0.0.0.0 \
    --port "${PORT:-8765}" \
    --log-level info

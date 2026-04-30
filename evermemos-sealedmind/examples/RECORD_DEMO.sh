#!/usr/bin/env bash
# RECORD_DEMO.sh — single orchestrator script for the screen recording.
#
# Run this in your terminal during the screen recording. Each scene has
# a labeled banner and pauses for narration time.
#
# Prereqs (set up ONCE before recording):
#   1. zgs_kv running on :6789
#        cd /downloads/OG-hackquest/0g-memory/0g_kv_server
#        ./zgs_kv --config config_testnet_turbo.toml > /tmp/kv.log 2>&1 &
#   2. .0g_secrets present in 0g-memory/
#   3. evermemos-sealedmind installed in .venv
#   4. SealedMindNFT minted on testnet to your wallet
#   5. Have your funded testnet wallet exported as SEALEDMIND_PRIVATE_KEY
#      and DOCTOR_ADDRESS exported (any other address)
#   6. PATIENT_MIND_ID = the tokenId from step 4

set -e

# ─── Required env ───────────────────────────────────────────────────────────
: "${SEALEDMIND_PRIVATE_KEY:?must be set}"
: "${DOCTOR_ADDRESS:?must be set}"
: "${PATIENT_MIND_ID:?must be set}"

# Auto-load from .0g_secrets
SECRETS=/downloads/OG-hackquest/0g-memory/.0g_secrets
if [ -f "$SECRETS" ]; then
    export ZEROG_STREAM_ID=$(grep ZEROG_STREAM_ID "$SECRETS" | cut -d= -f2)
    export SEALEDMIND_BACKUP_KEY=$(grep ZEROG_ENCRYPTION_KEY "$SECRETS" | cut -d= -f2)
fi

OG_MEMORY_SRC=/downloads/OG-hackquest/0g-memory/src
PKG_DIR=/downloads/OG-hackquest/sealedmind/evermemos-sealedmind
PY="$PKG_DIR/.venv/bin/python"

cd "$PKG_DIR"

pause() { read -p "  press ENTER to continue..." _; }

clear
cat <<'EOF'

   ███████╗███████╗ █████╗ ██╗     ███████╗██████╗ ███╗   ███╗██╗███╗   ██╗██████╗
   ██╔════╝██╔════╝██╔══██╗██║     ██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗
   ███████╗█████╗  ███████║██║     █████╗  ██║  ██║██╔████╔██║██║██╔██╗ ██║██║  ██║
   ╚════██║██╔══╝  ██╔══██║██║     ██╔══╝  ██║  ██║██║╚██╔╝██║██║██║╚██╗██║██║  ██║
   ███████║███████╗██║  ██║███████╗███████╗██████╔╝██║ ╚═╝ ██║██║██║ ╚████║██████╔╝

   evermemos-sealedmind — privacy adapter for 0G Memory
   Live demo on 0G Testnet · 2026-04-30

EOF
pause

clear
echo
echo "════════════════════════════════════════════════════════════════════"
echo " SCENE 1 — The addon registers via 0G Memory's actual loader"
echo "════════════════════════════════════════════════════════════════════"
echo
echo "Running:"
echo '  OG_MEMORY_SRC=... python examples/verify_addon_with_real_memsys.py'
echo
pause
OG_MEMORY_SRC=$OG_MEMORY_SRC "$PY" examples/verify_addon_with_real_memsys.py
pause

clear
echo
echo "════════════════════════════════════════════════════════════════════"
echo " SCENE 2 — Real production read/write path"
echo "          (SealedMindKVStorage → CachedKvClient → local zgs_kv → 0G)"
echo "════════════════════════════════════════════════════════════════════"
echo
pause
"$PY" examples/end_to_end_production_path.py
pause

clear
echo
echo "════════════════════════════════════════════════════════════════════"
echo " SCENE 3 — Two LangGraph agents on a live conversation"
echo "          Aria (Claude) helps Alice log a run + share with doctor"
echo "          Doctor's assistant (Qwen 2.5 7B in Intel TDX) reads under"
echo "          on-chain capability, then loses access when Alice revokes"
echo "════════════════════════════════════════════════════════════════════"
echo
pause
PYTHONPATH="$PKG_DIR" "$PY" examples/agent_demo.py
pause

clear
echo
echo "════════════════════════════════════════════════════════════════════"
echo " SCENE 4 — Live TEE inference gateway"
echo "════════════════════════════════════════════════════════════════════"
echo
pause
"$PY" examples/verify_sealed_inference_live.py
pause

clear
echo
echo "════════════════════════════════════════════════════════════════════"
echo " SCENE 5 — Privacy proof: what's actually on disk"
echo "════════════════════════════════════════════════════════════════════"
echo
echo "Local SealedMind index — blinded keys, no plaintext:"
echo
INDEX=$(find /tmp -name 'index.sqlite' 2>/dev/null | head -1)
if [ -n "$INDEX" ]; then
    sqlite3 "$INDEX" "SELECT namespace, substr(blinded,1,32)||'...' AS blinded_handle, length(root_hash) AS root_len FROM kv_index LIMIT 5"
fi
echo
echo "Encrypted user-secrets backup file (vs plaintext JSON in upstream):"
if [ -f ./user_secrets_backup.enc ]; then
    xxd ./user_secrets_backup.enc | head -3
fi
pause

clear
cat <<'EOF'

  ════════════════════════════════════════════════════════════════════
   DEMO COMPLETE
  ════════════════════════════════════════════════════════════════════

  All transactions above are real, verifiable on:
    https://chainscan-galileo.0g.ai

  Source + reproduction steps:
    DEVREL_PROOF.md
    PRODUCTION_CHECKLIST.md

EOF

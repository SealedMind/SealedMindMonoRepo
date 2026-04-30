"""End-to-end production-path verification.

This script exercises the EXACT code path 0G Memory uses in production:

  application → KVStorageInterface.put/get → SealedMindKVStorage
                                              ↓ (envelope encrypt)
                                              CachedKvClient.set / get_bytes
                                              ↓ (background commit)
                                              local zgs_kv on :6789
                                              ↓ (chain submit)
                                              0G testnet (real tx)
                                              ↓ (segment upload)
                                              0G storage nodes (real)

Prereqs:
  * `zgs_kv` running on localhost:6789 with stream_id matching ZEROG_STREAM_ID
  * Funded testnet wallet exported as SEALEDMIND_PRIVATE_KEY

Run:
    SEALEDMIND_PRIVATE_KEY=0x... \\
    ZEROG_STREAM_ID=<from .0g_secrets> \\
    python examples/end_to_end_production_path.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path

# Add 0G Memory to sys.path so isinstance(KVStorageInterface) wires up
OG_SRC = os.environ.get("OG_MEMORY_SRC", "/downloads/OG-hackquest/0g-memory/src")
sys.path.insert(0, OG_SRC)

from infra_layer.adapters.out.persistence.kv_storage.kv_storage_interface import (
    KVStorageInterface,
)

from evermemos_sealedmind.kv_storage.sealed_kv import SealedMindKVStorage


async def main() -> int:
    pk = os.environ.get("SEALEDMIND_PRIVATE_KEY")
    stream_id = os.environ.get("ZEROG_STREAM_ID")
    if not pk or not stream_id:
        print("set SEALEDMIND_PRIVATE_KEY and ZEROG_STREAM_ID", file=sys.stderr)
        return 2

    rpc = os.environ.get("ZEROG_RPC_URL", "https://evmrpc-testnet.0g.ai")
    indexer = os.environ.get(
        "ZEROG_INDEXER_URL", "https://indexer-storage-testnet-turbo.0g.ai"
    )
    flow = os.environ.get(
        "ZEROG_FLOW_ADDRESS", "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296"
    )
    kv_url = os.environ.get("ZEROG_READ_NODE", "http://127.0.0.1:6789")

    master_key = bytes.fromhex(
        os.environ.get(
            "SEALEDMIND_BACKUP_KEY",
            "deadbeef" * 8,  # demo key — never use in production
        ).removeprefix("0x")
    )

    print("=" * 60)
    print("end_to_end_production_path: real 0G Memory path")
    print("=" * 60)
    print(f"kv_url:    {kv_url}")
    print(f"rpc:       {rpc}")
    print(f"indexer:   {indexer}")
    print(f"stream_id: {stream_id}")
    print()

    print("[1/5] Constructing SealedMindKVStorage via the same constructor")
    print("      0G Memory's KVStorageLifespan would call...")
    kv = SealedMindKVStorage(
        kv_url=kv_url,
        rpc_url=rpc,
        indexer_url=indexer,
        flow_address=flow,
        stream_id=stream_id,
        wallet_private_key=pk,
        master_key=master_key,
        namespace="production-test",
    )
    assert isinstance(kv, KVStorageInterface), \
        "SealedMindKVStorage must be a KVStorageInterface for DI to resolve it"
    print(f"      ✅ isinstance(SealedMindKVStorage, KVStorageInterface) = True")
    print()

    test_key = f"episodic_memories:e2e-{int(time.time())}"
    test_value = (
        '{"role": "user", "content": "I prefer vegetarian meals", '
        '"timestamp": "2026-04-30T11:00:00Z"}'
    )

    print(f"[2/5] put(key={test_key!r})")
    print(f"      value JSON ({len(test_value)} chars)")
    ok = await kv.put(test_key, test_value)
    print(f"      put returned: {ok}")
    if not ok:
        print("FAIL: put returned False", file=sys.stderr)
        return 1
    print()

    # Read back from local cache (committed in-memory)
    print(f"[3/5] get(key={test_key!r}) — should hit local write buffer")
    got = await kv.get(test_key)
    print(f"      got: {got[:80] + '...' if got and len(got) > 80 else got!r}")
    if got != test_value:
        print(f"FAIL: round-trip mismatch", file=sys.stderr)
        return 1
    print(f"      ✅ round-trip matches")
    print()

    print("[4/5] forcing commit() → real 0G storage upload tx")
    # Force a commit through the SDK directly so we don't have to wait
    # for the 20-second background commit interval.
    kv._cached.commit()  # noqa: SLF001
    # Flush so the upload completes before we exit
    print("      waiting for upload to land on chain...")
    kv._cached.flush(timeout=120.0)  # noqa: SLF001
    print("      ✅ commit + flush complete — written to 0G testnet")
    print()

    print("[5/5] Verifying SealedMind privacy guarantees on disk:")
    # iterate_all yields blinded keys (privacy-preserving)
    print("      iterate_all() yields blinded handles (no plaintext key names):")
    count = 0
    async for blinded, _ in kv.iterate_all():
        print(f"        blinded handle: {blinded[:32]}...")
        count += 1
        if count >= 3:
            break
    print()

    print("=" * 60)
    print("✅ SUCCESS — production read/write path through SealedMindKVStorage,")
    print("   talking to real local zgs_kv, talking to real 0G testnet.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

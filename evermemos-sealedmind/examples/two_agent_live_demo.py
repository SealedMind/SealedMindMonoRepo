"""Two-agent live demo against real 0G testnet + real local zgs_kv.

Story (real production architecture):

  * Alice owns Mind tokenId=N. She writes a "fitness" shard memory through
    SealedMindKVStorage. The encrypted envelope lands on 0G testnet via
    the local zgs_kv node.
  * Alice grants Bob a read-only capability on the "fitness" shard for 60
    seconds. Real on-chain grant tx.
  * Bob's "agent" wants to read. The SealedMind API gateway checks the
    capability on chain via CapabilityRegistry.verifyCapability — a real
    RPC. If the capability is valid, the gateway returns the decrypted
    memory.
  * Alice revokes mid-session — real on-chain revoke tx.
  * Bob's next read fails: the API gateway calls verify, sees the
    capability is revoked, and refuses.

This is exactly how a real deployment would gate access — capability
enforcement at the request boundary, storage shared at the stream level.

Run:
    SEALEDMIND_PRIVATE_KEY=0x...alice... \\
    DOCTOR_ADDRESS=0x...bob... \\
    ZEROG_STREAM_ID=<from .0g_secrets> \\
    PATIENT_MIND_ID=<minted token id> \\
    SEALEDMIND_BACKUP_KEY=<32 bytes hex> \\
    python examples/two_agent_live_demo.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
import uuid

from evermemos_sealedmind.capabilities.client import CapabilityClient
from evermemos_sealedmind.capabilities.grants import GrantSpec
from evermemos_sealedmind.config import SealedMindConfig
from evermemos_sealedmind.errors import SealedMindCapabilityError
from evermemos_sealedmind.kv_storage.sealed_kv import SealedMindKVStorage


def banner(s: str) -> None:
    print()
    print("=" * 60)
    print(s)
    print("=" * 60)


def explorer(tx: str) -> str:
    tx = tx if tx.startswith("0x") else "0x" + tx
    return f"https://chainscan-galileo.0g.ai/tx/{tx}"


async def gateway_get(
    *,
    capabilities: CapabilityClient,
    storage: SealedMindKVStorage,
    capability_token: str,
    namespace: str,
    key: str,
) -> str | None:
    """API gateway pattern: verify capability on chain, then read.

    A real SealedMind backend would expose this as an HTTP endpoint;
    here we run it inline so the demo stays single-process.
    """
    await capabilities.verify(
        token=capability_token, namespace=namespace, key=key, scope="read"
    )
    return await storage.get(key)


async def main() -> int:
    pk = os.environ.get("SEALEDMIND_PRIVATE_KEY")
    stream = os.environ.get("ZEROG_STREAM_ID")
    doctor = os.environ.get("DOCTOR_ADDRESS")
    mind_id = os.environ.get("PATIENT_MIND_ID")
    if not all([pk, stream, doctor, mind_id]):
        print(
            "missing env: SEALEDMIND_PRIVATE_KEY, ZEROG_STREAM_ID, "
            "DOCTOR_ADDRESS, PATIENT_MIND_ID",
            file=sys.stderr,
        )
        return 2

    os.environ.setdefault("SEALEDMIND_NETWORK", "testnet")
    config = SealedMindConfig.from_env()

    rpc = config.rpc_url
    indexer = "https://indexer-storage-testnet-turbo.0g.ai"
    flow = "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296"
    kv_url = os.environ.get("ZEROG_READ_NODE", "http://127.0.0.1:6789")
    master = bytes.fromhex(
        os.environ.get("SEALEDMIND_BACKUP_KEY", "deadbeef" * 8).removeprefix("0x")
    )
    shard = f"fitness-{uuid.uuid4().hex[:6]}"

    banner(f"Scene 1 — Alice writes an encrypted memory under shard '{shard}'")
    storage = SealedMindKVStorage(
        kv_url=kv_url, rpc_url=rpc, indexer_url=indexer, flow_address=flow,
        stream_id=stream, wallet_private_key=pk, master_key=master,
        namespace=shard,
    )
    memory = (
        '{"type":"fitness","content":"5:30/km morning run, 8km, '
        'felt great","date":"2026-04-30"}'
    )
    key = "run-2026-04-30"
    ok = await storage.put(key, memory)
    print(f"  storage.put → {ok}  (envelope on 0G storage, in local cache)")

    banner("Scene 2 — Alice grants Bob a read-only capability for 60 seconds")
    capabilities = CapabilityClient(config=config, signing_key=pk)
    grant = await capabilities.grant(GrantSpec(
        mind_id=int(mind_id),
        shard_name=shard,
        grantee=doctor,
        read_only=True,
        expiry_unix=int(time.time()) + 60,
    ))
    print(f"  grant tx:   0x{grant.tx_hash.removeprefix('0x')}")
    print(f"  capability: {grant.token}")
    print(f"  explorer:   {explorer(grant.tx_hash)}")

    banner("Scene 3 — Bob reads via the API gateway pattern")
    print("  step 1: gateway calls CapabilityRegistry.verifyCapability on chain")
    print("  step 2: if valid, gateway reads from SealedMindKVStorage")
    value = await gateway_get(
        capabilities=capabilities, storage=storage,
        capability_token=grant.token, namespace=shard, key=key,
    )
    if value is None:
        print(f"  ❌ unexpected: returned None")
    else:
        print(f"  ✅ Bob received: {value[:80]}")

    banner("Scene 4 — Alice revokes the capability mid-session")
    revoke_tx = await capabilities.revoke(grant.token)
    print(f"  revoke tx: 0x{revoke_tx.removeprefix('0x')}")
    print(f"  explorer:  {explorer(revoke_tx)}")

    banner("Scene 5 — Bob's next read is denied by the on-chain verify")
    try:
        await gateway_get(
            capabilities=capabilities, storage=storage,
            capability_token=grant.token, namespace=shard, key=key,
        )
        print("  ❌ unexpected: read succeeded after revoke", file=sys.stderr)
        return 1
    except SealedMindCapabilityError as exc:
        print(f"  ✅ DENIED (verifyCapability returned false on chain): {exc}")

    banner("Demo complete")
    print("Every grant/revoke/verify above hit the real CapabilityRegistry")
    print("at 0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66 on 0G testnet.")
    print()
    print("Storage envelope persisted on 0G testnet via local zgs_kv on :6789")
    print(f"(stream_id: {stream[:16]}...)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

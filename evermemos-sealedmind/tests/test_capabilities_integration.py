"""Real CapabilityRegistry round-trip against 0G testnet.

Skipped unless RUN_INTEGRATION=1. Requires:
  - SEALEDMIND_NETWORK=testnet (default)
  - SEALEDMIND_PRIVATE_KEY=0x... (mind owner; must own a SealedMindNFT)
  - SEALEDMIND_TEST_MIND_ID=<id of an NFT owned by the signing wallet>
  - SEALEDMIND_TEST_GRANTEE=0x... (any address)
"""
from __future__ import annotations

import os
import time

import pytest

from evermemos_sealedmind.capabilities.client import CapabilityClient
from evermemos_sealedmind.capabilities.grants import GrantSpec
from evermemos_sealedmind.config import SealedMindConfig
from evermemos_sealedmind.errors import SealedMindCapabilityError

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION") != "1",
    reason="set RUN_INTEGRATION=1 to run against 0G testnet",
)


def _required(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        pytest.skip(f"{name} not set")
    return v


async def test_grant_verify_revoke_roundtrip():
    os.environ.setdefault("SEALEDMIND_NETWORK", "testnet")
    config = SealedMindConfig.from_env()
    pk = _required("SEALEDMIND_PRIVATE_KEY")
    mind_id = int(_required("SEALEDMIND_TEST_MIND_ID"))
    grantee = _required("SEALEDMIND_TEST_GRANTEE")

    client = CapabilityClient(config=config, signing_key=pk)
    spec = GrantSpec(
        mind_id=mind_id,
        shard_name=f"itest-{int(time.time())}",
        grantee=grantee,
        read_only=True,
        expiry_unix=int(time.time()) + 3600,
    )

    grant = await client.grant(spec)
    assert grant.cap_id and len(grant.cap_id) == 32

    # verify against the live registry
    await client.verify(token=grant.token, namespace=spec.shard_name, key="any", scope="read")

    # write scope must reject a read-only capability
    with pytest.raises(SealedMindCapabilityError):
        await client.verify(
            token=grant.token, namespace=spec.shard_name, key="any", scope="write"
        )

    # revoke and confirm verify now fails
    await client.revoke(grant.token)
    with pytest.raises(SealedMindCapabilityError):
        await client.verify(
            token=grant.token, namespace=spec.shard_name, key="any", scope="read"
        )

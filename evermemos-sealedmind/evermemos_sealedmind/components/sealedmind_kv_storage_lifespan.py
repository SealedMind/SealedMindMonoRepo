"""SealedMind override of 0G Memory's KVStorageLifespan.

Same `@component("kv_storage_lifespan", primary=True)` name — addon load
order makes this win when `MEMSYS_ENTRYPOINTS_FILTER` lists `sealedmind`
after `core`.

Behavior:
* `KV_STORAGE_TYPE=sealedmind` → instantiate `SealedMindKVStorage`
* anything else → call into the original `KVStorageLifespan` so we don't
  break Redis/InMemory/zerog flows.

Required env when type=sealedmind:
    ZEROG_READ_NODE
    ZEROG_RPC_URL
    ZEROG_INDEXER_URL
    ZEROG_FLOW_ADDRESS
    ZEROG_WALLET_KEY              (per-stream signing key)
    ZEROG_STREAM_ID               (the per-user stream id)
    SEALEDMIND_BACKUP_KEY         (32 bytes hex; used for both KV envelope
                                   master key and WalletVault backup key)
    SEALEDMIND_NAMESPACE          (default "default" — the on-chain shard)
    SEALEDMIND_CAPABILITY_TOKEN   (optional; if set, gates every read/write)
"""
from __future__ import annotations

import os

from core.di.decorators import component
from core.di.utils import register_primary
from core.lifespan.lifespan_interface import LifespanProvider
from core.observation.logger import get_logger
from infra_layer.adapters.out.persistence.kv_storage.kv_storage_interface import (
    KVStorageInterface,
)

from evermemos_sealedmind.auth.wallet_vault import WalletVault
from evermemos_sealedmind.config import SealedMindConfig
from evermemos_sealedmind.errors import SealedMindError
from evermemos_sealedmind.kv_storage.sealed_kv import SealedMindKVStorage

logger = get_logger(__name__)


@component("kv_storage_lifespan", primary=True)
class SealedMindKVStorageLifespan(LifespanProvider):
    """Drop-in replacement for the default KVStorageLifespan."""

    def __init__(self) -> None:
        super().__init__(name="kv_storage_lifespan", order=5)
        self.kv_storage = None
        self._delegate = None

    async def startup(self, app) -> None:
        kv_type = os.getenv("KV_STORAGE_TYPE", "inmemory").lower()

        if kv_type != "sealedmind":
            # Defer to the original lifespan for all non-sealedmind types so
            # we don't regress Redis/InMemory/zerog users who happen to have
            # us installed.
            from core.lifespan.kv_storage_lifespan import KVStorageLifespan

            self._delegate = KVStorageLifespan()
            await self._delegate.startup(app)
            self.kv_storage = self._delegate.kv_storage
            return

        logger.info("🚀 Initializing SealedMind KV-Storage (encrypted, capability-gated)...")

        kv_url = os.getenv("ZEROG_READ_NODE")
        rpc_url = os.getenv("ZEROG_RPC_URL")
        indexer_url = os.getenv("ZEROG_INDEXER_URL")
        flow_address = os.getenv("ZEROG_FLOW_ADDRESS")
        wallet_key = os.getenv("ZEROG_WALLET_KEY")
        stream_id = os.getenv("ZEROG_STREAM_ID")
        backup_key_hex = os.getenv("SEALEDMIND_BACKUP_KEY")

        missing = [
            n
            for n, v in [
                ("ZEROG_READ_NODE", kv_url),
                ("ZEROG_RPC_URL", rpc_url),
                ("ZEROG_INDEXER_URL", indexer_url),
                ("ZEROG_FLOW_ADDRESS", flow_address),
                ("ZEROG_WALLET_KEY", wallet_key),
                ("ZEROG_STREAM_ID", stream_id),
                ("SEALEDMIND_BACKUP_KEY", backup_key_hex),
            ]
            if not v
        ]
        if missing:
            raise SealedMindError(
                f"SealedMind KV requires env vars: {', '.join(missing)}"
            )

        master_key = bytes.fromhex(backup_key_hex.removeprefix("0x"))
        if len(master_key) != 32:
            raise SealedMindError("SEALEDMIND_BACKUP_KEY must be 32 bytes (64 hex chars)")

        # Wire WalletVault so the encrypted user_secret backup also uses this key
        WalletVault.bind_master_key(master_key)

        server_mode = os.getenv("SERVER_MODE", "false").lower() == "true"

        if server_mode:
            from evermemos_sealedmind.kv_storage.user_aware import (
                UserAwareSealedMindKVStorage,
            )
            kv_storage = UserAwareSealedMindKVStorage(
                kv_url=kv_url,
                rpc_url=rpc_url,
                indexer_url=indexer_url,
                flow_address=flow_address,
                operator_root_key=master_key,
            )
            logger.info(
                f"✅ SealedMind KV-Storage registered (multi-user / server mode)\n"
                f"   per-user keys derived via HKDF from operator root"
            )
        else:
            capabilities = None
            cap_token = os.getenv("SEALEDMIND_CAPABILITY_TOKEN") or None
            if cap_token:
                from evermemos_sealedmind.capabilities.client import CapabilityClient

                cfg = SealedMindConfig.from_env()
                capabilities = CapabilityClient(config=cfg, signing_key=wallet_key)

            kv_storage = SealedMindKVStorage(
                kv_url=kv_url,
                rpc_url=rpc_url,
                indexer_url=indexer_url,
                flow_address=flow_address,
                stream_id=stream_id,
                wallet_private_key=wallet_key,
                master_key=master_key,
                namespace=os.getenv("SEALEDMIND_NAMESPACE", "default"),
                capability_token=cap_token,
                capabilities=capabilities,
            )
            logger.info(
                f"✅ SealedMind KV-Storage registered (single-user / local mode)\n"
                f"   stream_id: {stream_id}\n"
                f"   namespace: {os.getenv('SEALEDMIND_NAMESPACE', 'default')}\n"
                f"   capability: {'on-chain gated' if cap_token else 'open'}"
            )

        register_primary(KVStorageInterface, kv_storage)
        self.kv_storage = kv_storage

    async def shutdown(self, app) -> None:
        if self._delegate is not None:
            await self._delegate.shutdown(app)
            return
        if self.kv_storage and hasattr(self.kv_storage, "close"):
            self.kv_storage.close()


__all__ = ["SealedMindKVStorageLifespan"]

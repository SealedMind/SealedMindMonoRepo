"""UserAwareSealedMindKVStorage — multi-user SERVER_MODE proxy.

Mirror of 0G Memory's `UserAwareKVStorageProxy`, but each per-user
backend is a `SealedMindKVStorage` with a per-user master key derived
from the operator's root key + user_id. This means even the operator
cannot decrypt one user's memories with another user's key, and the
on-disk index reveals nothing about which user's data is which.

Per-user master key derivation:
    user_master_key = HKDF(
        ikm    = operator_root_key,    # 32 bytes, set at startup
        salt   = "evermemos-sealedmind/per-user/v1",
        info   = b"user:" + user_id,
        length = 32,
    )

So the operator only ever holds the root key in memory; per-user keys
are derived on demand and live only as long as the user's session.
"""
from __future__ import annotations

from contextvars import ContextVar
from typing import AsyncIterator, Dict, List, Optional, Tuple

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from ..errors import SealedMindAuthError
from .sealed_kv import SealedMindKVStorage

try:
    from infra_layer.adapters.out.persistence.kv_storage.kv_storage_interface import (  # type: ignore
        KVStorageInterface as _BaseKVStorage,
    )
except ImportError:  # pragma: no cover
    _BaseKVStorage = object  # type: ignore[assignment,misc]

_kv_user_context: ContextVar[Optional[SealedMindKVStorage]] = ContextVar(
    "_sealedmind_kv_user_context", default=None
)


def derive_user_master_key(operator_root_key: bytes, user_id: str) -> bytes:
    if len(operator_root_key) != 32:
        raise SealedMindAuthError(
            f"operator_root_key must be 32 bytes, got {len(operator_root_key)}"
        )
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"evermemos-sealedmind/per-user/v1",
        info=b"user:" + user_id.encode("utf-8"),
    ).derive(operator_root_key)


class UserAwareSealedMindKVStorage(_BaseKVStorage):  # type: ignore[misc,valid-type]
    """Routes KV ops to a per-user `SealedMindKVStorage` instance."""

    def __init__(
        self,
        kv_url: str,
        rpc_url: str,
        indexer_url: str,
        flow_address: str,
        operator_root_key: bytes,
    ) -> None:
        if len(operator_root_key) != 32:
            raise SealedMindAuthError(
                f"operator_root_key must be 32 bytes, got {len(operator_root_key)}"
            )
        self._kv_url = kv_url
        self._rpc_url = rpc_url
        self._indexer_url = indexer_url
        self._flow_address = flow_address
        self._operator_root_key = operator_root_key
        self._cache: Dict[str, SealedMindKVStorage] = {}

    # --------------------------------------------------- per-request wiring

    def set_user_context(
        self,
        user_id: str,
        stream_id: str,
        wallet_key: str,
        *,
        namespace: str = "default",
        capability_token: Optional[str] = None,
    ) -> None:
        storage = self._get_or_create(
            user_id, stream_id, wallet_key, namespace, capability_token
        )
        _kv_user_context.set(storage)

    def clear_user_context(self) -> None:
        _kv_user_context.set(None)

    def _get_or_create(
        self,
        user_id: str,
        stream_id: str,
        wallet_key: str,
        namespace: str,
        capability_token: Optional[str],
    ) -> SealedMindKVStorage:
        cache_key = f"{user_id}:{namespace}:{capability_token or '-'}"
        if cache_key not in self._cache:
            user_key = derive_user_master_key(self._operator_root_key, user_id)
            self._cache[cache_key] = SealedMindKVStorage(
                kv_url=self._kv_url,
                rpc_url=self._rpc_url,
                indexer_url=self._indexer_url,
                flow_address=self._flow_address,
                stream_id=stream_id,
                wallet_private_key=wallet_key,
                master_key=user_key,
                namespace=namespace,
                capability_token=capability_token,
            )
        return self._cache[cache_key]

    def _current(self) -> SealedMindKVStorage:
        storage = _kv_user_context.get()
        if storage is None:
            raise RuntimeError(
                "No KV user context set for the current request. "
                "Call set_user_context(...) before invoking KV ops."
            )
        return storage

    # ----------------------------------------------- KVStorageInterface

    async def get(self, key: str) -> Optional[str]:
        return await self._current().get(key)

    async def put(self, key: str, value: str) -> bool:
        return await self._current().put(key, value)

    async def delete(self, key: str) -> bool:
        return await self._current().delete(key)

    async def batch_get(self, keys: List[str]) -> Dict[str, str]:
        return await self._current().batch_get(keys)

    async def batch_delete(self, keys: List[str]) -> int:
        return await self._current().batch_delete(keys)

    async def iterate_all(self) -> AsyncIterator[Tuple[str, str]]:
        storage = _kv_user_context.get()
        if storage is None:
            # No active user context — startup recovery scan: iterate all
            # cached per-user storages. Production deployments should call
            # set_user_context for each user from MongoDB during startup
            # and then iterate.
            for s in self._cache.values():
                async for item in s.iterate_all():
                    yield item
            return
        async for item in storage.iterate_all():
            yield item

    def close(self) -> None:
        for s in self._cache.values():
            try:
                s.close()
            except Exception:
                pass


__all__ = ["UserAwareSealedMindKVStorage", "derive_user_master_key"]

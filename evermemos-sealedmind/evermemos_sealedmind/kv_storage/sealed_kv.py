"""SealedMindKVStorage — drop-in replacement for ZeroGKVStorage.

Implements 0G Memory's `KVStorageInterface` exactly:
    async get(key: str)        -> Optional[str]
    async put(key, value: str) -> bool
    async delete(key: str)     -> bool
    async batch_get(keys)      -> Dict[str, str]    # only present keys
    async batch_delete(keys)   -> int               # count deleted
    async iterate_all()        -> AsyncIterator[Tuple[str, str]]
    close()

What's different from `ZeroGKVStorage`:

* Each value goes through a SealedMind AES-256-GCM envelope before reaching
  the SDK.  AAD is bound to the key name, so a swapped envelope under a
  different key fails decryption.
* The DEK is derived from a SIWE-verified master key (set via
  `set_session_key`), not from `.0g_secrets`.  The user's wallet is the root
  of trust.
* Optional `capability_token` + `CapabilityClient`: when both are set, every
  read/write hits the on-chain `CapabilityRegistry.verifyCapability` first.
  Revoking on-chain blocks the next call immediately.

The constructor mirrors `ZeroGKVStorage(kv_url, rpc_url, indexer_url,
flow_address, ...)` so 0G Memory's lifespan can swap us in with one
`KV_STORAGE_TYPE=sealedmind` change.
"""
from __future__ import annotations

import asyncio
import threading
from datetime import datetime
from typing import TYPE_CHECKING, AsyncIterator, Dict, List, Optional, Tuple

from zg_storage import CachedKvClient, EvmClient, UploadOption

from ..crypto import blind_key, derive_dek, derive_index_key, open_envelope, seal
from ..errors import SealedMindAuthError, SealedMindCapabilityError, SealedMindError

# Inherit from 0G Memory's KVStorageInterface when available so DI's
# `get_bean_by_type(KVStorageInterface)` resolves us. Fall back to object
# when 0G Memory isn't installed (unit tests, standalone use).
try:
    from infra_layer.adapters.out.persistence.kv_storage.kv_storage_interface import (  # type: ignore
        KVStorageInterface as _BaseKVStorage,
    )
except ImportError:  # pragma: no cover
    _BaseKVStorage = object  # type: ignore[assignment,misc]

if TYPE_CHECKING:
    from ..capabilities.client import CapabilityClient

COMMIT_INTERVAL = 20
MAX_COMMIT_FAILURES = 3


class SealedMindKVStorage(_BaseKVStorage):  # type: ignore[misc,valid-type]
    """SealedMind-encrypted, capability-gated KV storage on 0G."""

    def __init__(
        self,
        kv_url: str,
        rpc_url: str,
        indexer_url: str,
        flow_address: str,
        *,
        max_queue_size: int = 100,
        max_cache_entries: int = 10000,
        stream_id: Optional[str] = None,
        wallet_private_key: Optional[str] = None,
        # SealedMind-specific:
        master_key: Optional[bytes] = None,
        namespace: str = "default",
        capability_token: Optional[str] = None,
        capabilities: "CapabilityClient | None" = None,
    ) -> None:
        if not stream_id:
            raise SealedMindError("stream_id is required (per-user 0G KV stream id)")
        if not wallet_private_key:
            raise SealedMindError("wallet_private_key is required to sign 0G txs")

        self.stream_id = stream_id
        self._namespace = namespace
        self._capability_token = capability_token
        self._capabilities = capabilities
        self._master_key: Optional[bytes] = master_key

        self._evm = EvmClient(rpc_url=rpc_url, private_key=wallet_private_key)
        # We do our own envelope; let the SDK store ciphertext as-is.
        self._cached = CachedKvClient(
            kv_url=kv_url,
            indexer_url=indexer_url,
            evm_client=self._evm,
            flow_address=flow_address,
            max_queue_size=max_queue_size,
            max_cache_entries=max_cache_entries,
            upload_option=UploadOption(skip_tx=False),
        )

        self._client_lock = threading.RLock()
        self._stop_event = threading.Event()
        self._pending = 0
        self._pending_lock = threading.Lock()
        self._commit_thread = threading.Thread(
            target=self._commit_loop, name="sealedmind_commit", daemon=True
        )
        self._commit_thread.start()

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._op_log_path = f"/tmp/log_SealedMindKVStorage_{ts}.txt"
        try:
            self._op_log_file = open(self._op_log_path, "w", encoding="utf-8")
            self._op_log_file.write(
                f"[{datetime.now().isoformat()}] SealedMindKVStorage init "
                f"stream={stream_id} kv={kv_url}\n"
            )
            self._op_log_file.flush()
        except Exception:
            self._op_log_file = None

    # ----------------------------------------------------------- session

    def set_session_key(self, master_key: bytes) -> None:
        """Inject the SIWE-derived 32-byte master key. Call after WalletVault.login()."""
        if len(master_key) != 32:
            raise SealedMindAuthError(f"master_key must be 32 bytes, got {len(master_key)}")
        self._master_key = master_key

    def _require_master(self) -> bytes:
        if self._master_key is None:
            raise SealedMindAuthError(
                "no SIWE session — call set_session_key(master_key) first"
            )
        return self._master_key

    def _blind(self, master: bytes, key: str) -> str:
        return blind_key(derive_index_key(master), self._namespace, key)

    async def _check_capability(self, scope: str) -> None:
        if self._capabilities is None or self._capability_token is None:
            return
        # We do not have a stable per-call key here; use namespace as the
        # gating boundary (matches the on-chain shardName field).
        await self._capabilities.verify(
            token=self._capability_token,
            namespace=self._namespace,
            key=self._namespace,
            scope=scope,
        )

    # ------------------------------------------------------------ commit

    def _commit_loop(self) -> None:
        consecutive = 0
        while not self._stop_event.wait(COMMIT_INTERVAL):
            with self._pending_lock:
                pending, self._pending = self._pending, 0
            if not pending:
                continue
            try:
                with self._client_lock:
                    self._cached.commit()
                consecutive = 0
                self._log(f"commit ({pending} pending)")
            except Exception as exc:
                consecutive += 1
                self._log(f"commit FAILED ({consecutive}/{MAX_COMMIT_FAILURES}): {exc}")
                if consecutive >= MAX_COMMIT_FAILURES:
                    try:
                        with self._client_lock:
                            self._cached.reset()
                        self._log("client reset after commit failures")
                    except Exception as reset_err:
                        self._log(f"reset FAILED: {reset_err}")
                    consecutive = 0

    def _log(self, msg: str) -> None:
        if self._op_log_file is None:
            return
        try:
            self._op_log_file.write(f"[{datetime.now().isoformat()}] {msg}\n")
            self._op_log_file.flush()
        except Exception:
            pass

    # ---------------------------------------------------- KVStorageInterface

    async def get(self, key: str) -> Optional[str]:
        try:
            await self._check_capability("read")
        except SealedMindCapabilityError as exc:
            self._log(f"get key={key} DENIED: {exc}")
            raise
        master = self._require_master()
        blinded = self._blind(master, key)
        try:
            with self._client_lock:
                ct = self._cached.get_bytes(self.stream_id, blinded.encode("utf-8"))
        except Exception as exc:
            self._log(f"get key={key} sdk-error: {exc}")
            return None
        if not ct:
            return None
        dek = derive_dek(master, self._namespace)
        try:
            plaintext = open_envelope(ct, dek, aad=blinded.encode("ascii"))
        except Exception as exc:
            self._log(f"get key={key} decrypt-error: {exc}")
            return None
        return plaintext.decode("utf-8")

    async def put(self, key: str, value: str) -> bool:
        try:
            await self._check_capability("write")
        except SealedMindCapabilityError as exc:
            self._log(f"put key={key} DENIED: {exc}")
            return False
        master = self._require_master()
        blinded = self._blind(master, key)
        dek = derive_dek(master, self._namespace)
        envelope = seal(value.encode("utf-8"), dek, self._namespace, aad=blinded.encode("ascii"))
        try:
            with self._client_lock:
                self._cached.set(self.stream_id, blinded.encode("utf-8"), envelope.blob)
            with self._pending_lock:
                self._pending += 1
            self._log(f"put key={key} bytes={len(envelope.blob)}")
            return True
        except Exception as exc:
            self._log(f"put key={key} FAILED: {exc}")
            return False

    async def delete(self, key: str) -> bool:
        try:
            await self._check_capability("write")
        except SealedMindCapabilityError as exc:
            self._log(f"delete key={key} DENIED: {exc}")
            return False
        master = self._require_master()
        blinded = self._blind(master, key)
        try:
            with self._client_lock:
                self._cached.set(self.stream_id, blinded.encode("utf-8"), b"")
            with self._pending_lock:
                self._pending += 1
            return True
        except Exception as exc:
            self._log(f"delete key={key} FAILED: {exc}")
            return False

    async def batch_get(self, keys: List[str]) -> Dict[str, str]:
        if not keys:
            return {}
        results: Dict[str, str] = {}
        for k in keys:
            v = await self.get(k)
            if v is not None:
                results[k] = v
        return results

    async def batch_delete(self, keys: List[str]) -> int:
        deleted = 0
        for k in keys:
            if await self.delete(k):
                deleted += 1
        return deleted

    async def iterate_all(self) -> AsyncIterator[Tuple[str, str]]:
        await self._check_capability("read")
        master = self._require_master()
        dek = derive_dek(master, self._namespace)

        def _collect() -> List[Tuple[bytes, bytes]]:
            with self._client_lock:
                it = self._cached._kv_client.new_iterator(self.stream_id)  # noqa: SLF001
            it.seek_to_first()
            out: List[Tuple[bytes, bytes]] = []
            while it.valid():
                if it.data:
                    out.append((bytes(it.key), bytes(it.data)))
                it.next()
            return out

        pairs = await asyncio.to_thread(_collect)
        for blinded_b, ct in pairs:
            blinded = blinded_b.decode("utf-8", errors="replace")
            try:
                plaintext = open_envelope(ct, dek, aad=blinded.encode("ascii"))
            except Exception as exc:
                self._log(f"iterate decrypt-error blinded={blinded}: {exc}")
                continue
            # We don't store the original key — yield the blinded handle so
            # callers can correlate via known-blind precomputation.  This
            # matches the privacy goal: a backup/audit reader sees no names.
            yield blinded, plaintext.decode("utf-8")

    def close(self) -> None:
        self._stop_event.set()
        self._commit_thread.join(timeout=5)
        try:
            with self._client_lock:
                self._cached.close()
        except Exception:
            pass
        if self._op_log_file is not None:
            try:
                self._op_log_file.close()
            except Exception:
                pass


__all__ = ["SealedMindKVStorage"]

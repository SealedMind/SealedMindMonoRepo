"""WalletVault — encrypted-backup replacement for 0G Memory's UserSecretBackup.

0G Memory's `infra_layer/adapters/out/persistence/user_secret_backup.py`
writes user secrets to a plaintext JSON file (`./user_secrets_backup.json`
by default). The file holds wallet keys, stream ids, and AES encryption
keys for every user — losing it loses recovery; leaking it leaks every
user's KV stream.

`WalletVault` keeps the same static-method surface so callers do not
change. The on-disk file becomes an AES-256-GCM envelope keyed by an
operator-supplied master key (env: `SEALEDMIND_BACKUP_KEY`, 32 bytes hex,
or set with `WalletVault.bind_master_key()` at startup).

Public surface (matches `UserSecretBackup`):
    save_to_file(user_secrets: List[Dict]) -> bool
    load_from_file()                       -> List[Dict]
    backup_exists()                        -> bool
    backup_all_users()                     -> async
    restore_to_mongodb()                   -> async bool

Plus migration:
    migrate_legacy_backup(legacy_path)     -> int (count migrated)
"""
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..crypto import derive_dek, derive_master_key, open_envelope, seal
from ..errors import SealedMindAuthError
from .siwe import SiweVerifier, VerifiedSiwe

BACKUP_FILE = os.getenv(
    "EVERMEMOS_USER_BACKUP_FILE",
    "./user_secrets_backup.enc",  # different extension to avoid mixing with legacy
)
BACKUP_DIR = Path(BACKUP_FILE).parent

_backup_lock = asyncio.Lock()


class WalletVault:
    """SealedMind-encrypted user secret backup."""

    _master_key: Optional[bytes] = None

    # ---------------------------------------------------- master key wiring

    @classmethod
    def bind_master_key(cls, master_key: bytes) -> None:
        if len(master_key) != 32:
            raise SealedMindAuthError(f"master_key must be 32 bytes, got {len(master_key)}")
        cls._master_key = master_key

    @classmethod
    def bind_from_siwe(
        cls, message: str, signature: str, *, expected_domain: str, expected_chain_id: int
    ) -> VerifiedSiwe:
        verifier = SiweVerifier(
            expected_domain=expected_domain, expected_chain_id=expected_chain_id
        )
        verified = verifier.verify(message, signature)
        cls._master_key = derive_master_key(verified.signature, expected_domain)
        return verified

    @classmethod
    def bind_from_env(cls) -> None:
        """Load 32-byte hex master key from SEALEDMIND_BACKUP_KEY (server mode)."""
        hex_key = os.environ.get("SEALEDMIND_BACKUP_KEY")
        if not hex_key:
            raise SealedMindAuthError(
                "SEALEDMIND_BACKUP_KEY env var is required (32 bytes hex) "
                "or call WalletVault.bind_master_key()/bind_from_siwe()"
            )
        try:
            key = bytes.fromhex(hex_key.removeprefix("0x"))
        except ValueError as exc:
            raise SealedMindAuthError(f"SEALEDMIND_BACKUP_KEY is not valid hex: {exc}") from exc
        if len(key) != 32:
            raise SealedMindAuthError(
                f"SEALEDMIND_BACKUP_KEY must be 32 bytes (64 hex chars), got {len(key)}"
            )
        cls._master_key = key

    @classmethod
    def _require_master(cls) -> bytes:
        if cls._master_key is None:
            raise SealedMindAuthError(
                "no master key bound — call WalletVault.bind_master_key()/bind_from_siwe()/"
                "bind_from_env() before backup operations"
            )
        return cls._master_key

    # ---------------------------------------------------- helpers

    @staticmethod
    def ensure_backup_dir() -> None:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def backup_exists() -> bool:
        return os.path.exists(BACKUP_FILE)

    # ---------------------------------------------------- save/load

    @classmethod
    def save_to_file(cls, user_secrets: List[Dict[str, Any]]) -> bool:
        """Encrypt + atomic-write user secrets backup."""
        try:
            cls.ensure_backup_dir()
            master = cls._require_master()
            payload = {
                "version": "sealedmind-1.0",
                "backup_time": datetime.utcnow().isoformat(),
                "user_count": len(user_secrets),
                "users": user_secrets,
            }
            plaintext = json.dumps(payload, default=str).encode("utf-8")
            dek = derive_dek(master, "user-secret-backup")
            envelope = seal(plaintext, dek, "user-secret-backup", aad=b"v1")

            tmp = f"{BACKUP_FILE}.tmp"
            Path(tmp).write_bytes(envelope.blob)
            os.replace(tmp, BACKUP_FILE)
            return True
        except Exception:
            return False

    @classmethod
    def load_from_file(cls) -> List[Dict[str, Any]]:
        try:
            if not os.path.exists(BACKUP_FILE):
                return []
            blob = Path(BACKUP_FILE).read_bytes()
            master = cls._require_master()
            dek = derive_dek(master, "user-secret-backup")
            plaintext = open_envelope(blob, dek, aad=b"v1")
            payload = json.loads(plaintext.decode("utf-8"))
            if not isinstance(payload, dict) or "users" not in payload:
                return []
            return payload["users"]
        except Exception:
            return []

    # ------------------------------------------ MongoDB-backed operations

    @classmethod
    async def backup_all_users(cls) -> None:
        """Mirror of UserSecretBackup.backup_all_users — reads UserSecret collection."""
        async with _backup_lock:
            try:
                from infra_layer.adapters.out.persistence.document.user.user_secret import (
                    UserSecret,
                )
            except ImportError:
                # Not running inside 0G Memory — nothing to back up.
                return
            users = await UserSecret.find_all().to_list()
            if not users:
                return
            user_dicts = [
                {
                    "user_id": u.user_id,
                    "api_key": u.api_key,
                    "zerog_stream_id": u.zerog_stream_id,
                    "zerog_encryption_key": u.zerog_encryption_key,
                    "zerog_wallet_key": u.zerog_wallet_key,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in users
            ]
            cls.save_to_file(user_dicts)

    @classmethod
    async def restore_to_mongodb(cls) -> bool:
        try:
            from infra_layer.adapters.out.persistence.document.user.user_secret import UserSecret
        except ImportError:
            return False
        if not cls.backup_exists():
            existing = await UserSecret.count()
            return existing == 0  # benign if both empty
        users = cls.load_from_file()
        if not users:
            return False
        for u in users:
            existing = await UserSecret.find_one(UserSecret.user_id == u["user_id"])
            if existing:
                continue
            created = u.get("created_at")
            await UserSecret(
                user_id=u["user_id"],
                api_key=u["api_key"],
                zerog_stream_id=u["zerog_stream_id"],
                zerog_encryption_key=u["zerog_encryption_key"],
                zerog_wallet_key=u["zerog_wallet_key"],
                created_at=(
                    datetime.fromisoformat(created.replace("Z", "+00:00")).replace(tzinfo=None)
                    if created
                    else datetime.utcnow()
                ),
            ).insert()
        return True

    # ------------------------------------------------------- migration

    @classmethod
    def migrate_legacy_backup(cls, legacy_path: str) -> int:
        """One-shot import from the original plaintext user_secrets_backup.json."""
        p = Path(legacy_path)
        if not p.exists():
            return 0
        try:
            data = json.loads(p.read_text())
        except json.JSONDecodeError as exc:
            raise SealedMindAuthError(f"legacy backup not valid JSON: {exc}") from exc
        users = data.get("users", []) if isinstance(data, dict) else []
        if not users:
            return 0
        cls.save_to_file(users)
        # Securely overwrite then delete
        try:
            with open(p, "wb") as f:
                f.write(b"\x00" * p.stat().st_size)
            p.unlink()
        except Exception:
            pass
        return len(users)


__all__ = ["WalletVault"]

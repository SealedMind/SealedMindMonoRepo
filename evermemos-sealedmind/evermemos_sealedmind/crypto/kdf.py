"""HKDF-SHA256 key derivation + HMAC helpers.

Three derivations live here:

* `derive_master_key(siwe_signature, domain)` — turns the user's SIWE
  signature into a 32-byte master key that lives only in process memory.
  Same wallet + same domain ⇒ same master key, so the user can recover on
  a new device by re-signing.
* `derive_dek(master_key, namespace)` — derives a per-namespace data
  encryption key so compromise of one namespace cannot decrypt others.
* `derive_index_key(master_key)` — derives the HMAC key used to mask
  user-supplied key names in the local index. A leaked SQLite reveals
  only opaque 32-byte handles.
"""
from __future__ import annotations

import hmac
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

_KEY_BYTES = 32  # AES-256
_DOMAIN = b"evermemos-sealedmind/v1"


def derive_master_key(siwe_signature: bytes, domain: str) -> bytes:
    """Derive the user's master key from a verified SIWE signature."""
    if len(siwe_signature) < 64:
        raise ValueError("SIWE signature too short to derive a master key")
    return HKDF(
        algorithm=hashes.SHA256(),
        length=_KEY_BYTES,
        salt=domain.encode("utf-8"),
        info=_DOMAIN + b"/master",
    ).derive(siwe_signature)


def derive_dek(master_key: bytes, namespace: str) -> bytes:
    """Per-namespace data encryption key. Salt is the namespace string."""
    _check_master(master_key)
    return HKDF(
        algorithm=hashes.SHA256(),
        length=_KEY_BYTES,
        salt=namespace.encode("utf-8"),
        info=_DOMAIN + b"/dek",
    ).derive(master_key)


def derive_index_key(master_key: bytes) -> bytes:
    """HMAC key for blinding key names in the local SQLite index."""
    _check_master(master_key)
    return HKDF(
        algorithm=hashes.SHA256(),
        length=_KEY_BYTES,
        salt=b"evermemos/index",
        info=_DOMAIN + b"/index",
    ).derive(master_key)


def blind_key(index_key: bytes, namespace: str, key: str) -> str:
    """Deterministic, unforgeable mask for (namespace, key). Returns hex."""
    mac = hmac.new(index_key, digestmod="sha256")
    mac.update(namespace.encode("utf-8"))
    mac.update(b"\x00")
    mac.update(key.encode("utf-8"))
    return mac.hexdigest()


def _check_master(master_key: bytes) -> None:
    if len(master_key) != _KEY_BYTES:
        raise ValueError(f"master_key must be {_KEY_BYTES} bytes, got {len(master_key)}")

"""AES-256-GCM envelope encryption.

Wire format (network byte order):

    magic(4) | version(1) | nonce_len(1) | nonce | ciphertext+tag

Tag is appended to ciphertext by AESGCM, so we don't store it separately.
The DEK is derived per-namespace from the master key (see kdf.derive_dek), so
no wrapped key is stored in the envelope itself — the namespace is the only
thing needed to re-derive it.
"""
from __future__ import annotations

import os
import struct
from dataclasses import dataclass

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..errors import SealedMindCryptoError

_MAGIC = b"SMv1"
_VERSION = 1
_HEADER = struct.Struct(">4sBB")  # magic, version, nonce_len
_NONCE_LEN = 12  # GCM standard


@dataclass(frozen=True)
class Envelope:
    namespace: str
    blob: bytes  # the on-wire bytes ready for storage

    def __len__(self) -> int:
        return len(self.blob)


def seal(plaintext: bytes, dek: bytes, namespace: str, *, aad: bytes | None = None) -> Envelope:
    """Encrypt `plaintext` and return an Envelope ready to write to 0G Storage.

    `aad` (additional authenticated data) is bound into the GCM tag — pass the
    storage key here so a swapped envelope under a different key fails decryption.
    """
    if len(dek) != 32:
        raise ValueError("dek must be 32 bytes for AES-256")
    nonce = os.urandom(_NONCE_LEN)
    ct = AESGCM(dek).encrypt(nonce, plaintext, aad)
    blob = _HEADER.pack(_MAGIC, _VERSION, _NONCE_LEN) + nonce + ct
    return Envelope(namespace=namespace, blob=blob)


def open_envelope(blob: bytes, dek: bytes, *, aad: bytes | None = None) -> bytes:
    """Decrypt and verify; raises SealedMindCryptoError on any tampering."""
    if len(blob) < _HEADER.size + _NONCE_LEN + 16:
        raise SealedMindCryptoError("envelope too short")
    magic, version, nonce_len = _HEADER.unpack_from(blob, 0)
    if magic != _MAGIC:
        raise SealedMindCryptoError(f"bad magic: {magic!r}")
    if version != _VERSION:
        raise SealedMindCryptoError(f"unsupported envelope version: {version}")
    if nonce_len != _NONCE_LEN:
        raise SealedMindCryptoError(f"unexpected nonce length: {nonce_len}")
    offset = _HEADER.size
    nonce = blob[offset : offset + nonce_len]
    ct = blob[offset + nonce_len :]
    try:
        return AESGCM(dek).decrypt(nonce, ct, aad)
    except InvalidTag as exc:
        raise SealedMindCryptoError("AES-GCM tag verification failed") from exc

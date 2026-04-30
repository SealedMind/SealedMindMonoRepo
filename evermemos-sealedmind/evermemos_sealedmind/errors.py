"""Typed exceptions for evermemos-sealedmind."""
from __future__ import annotations


class SealedMindError(Exception):
    """Base class for all sealedmind errors."""


class SealedMindAuthError(SealedMindError):
    """Raised when SIWE session is missing, expired, or invalid.

    Surfaced from KV reads/writes when the wallet is not connected. There is no
    plaintext fallback — silent fallback is exactly the bug this addon fixes.
    """


class SealedMindCapabilityError(SealedMindError):
    """Raised when a capability token is missing, expired, revoked, or out of scope."""


class SealedMindCryptoError(SealedMindError):
    """Raised when AES-GCM tag verification fails or envelope is malformed."""


class SealedMindStorageError(SealedMindError):
    """Raised when the underlying 0G Storage call fails."""

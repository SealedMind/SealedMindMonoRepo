"""evermemos-sealedmind — SealedMind privacy adapter for 0G Memory."""
from __future__ import annotations

from .config import SealedMindConfig
from .errors import (
    SealedMindAuthError,
    SealedMindCapabilityError,
    SealedMindCryptoError,
    SealedMindError,
    SealedMindStorageError,
)

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "SealedMindConfig",
    "SealedMindError",
    "SealedMindAuthError",
    "SealedMindCapabilityError",
    "SealedMindCryptoError",
    "SealedMindStorageError",
]

"""Grant DTOs."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GrantSpec:
    mind_id: int
    shard_name: str
    grantee: str
    read_only: bool = True
    expiry_unix: int = 0  # 0 = no expiry

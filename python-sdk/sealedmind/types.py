"""Pydantic models matching the SealedMind backend response shapes."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


class Mind(_Base):
    id: str
    owner: str
    storage_cid: str | None = Field(default=None, alias="storageCID")
    memory_count: int | None = Field(default=None, alias="memoryCount")
    shards: list[str] | None = None
    created_at: int | None = Field(default=None, alias="createdAt")


class Memory(_Base):
    id: str
    content: str
    type: str | None = None
    shard: str | None = None
    tags: list[str] | None = None
    storage_cid: str | None = Field(default=None, alias="storageCID")
    created_at: int | None = Field(default=None, alias="createdAt")


class Attestation(_Base):
    chat_id: str = Field(alias="chatId")
    verified: bool = False
    enclave: str | None = None


class RememberResult(_Base):
    memories: list[Memory] = Field(default_factory=list)
    attestation: Attestation | None = None


class RecallResult(_Base):
    memories: list[Memory] = Field(default_factory=list)
    answer: str = ""
    attestation: Attestation | None = None


class CapabilityGrant(_Base):
    cap_id: str = Field(alias="capId")
    mind_id: str = Field(alias="mindId")
    shard_name: str = Field(alias="shardName")
    grantee: str
    read_only: bool = Field(alias="readOnly")
    expiry: int = 0
    revoked: bool = False
    granted_at: int | None = Field(default=None, alias="grantedAt")


class _RawChatResponse(_Base):
    """Backend /v1/inference/chat shape."""
    content: str
    model: str | None = None
    chat_id: str = Field(alias="chatId")
    attestation_valid: bool = Field(default=False, alias="attestationValid")
    enclave: str | None = None

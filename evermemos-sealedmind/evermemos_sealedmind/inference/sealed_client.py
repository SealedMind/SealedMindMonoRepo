"""SealedInferenceClient — wraps the SealedMind TEE inference gateway.

The deployed gateway runs Qwen 2.5 7B inside Intel TDX (CPU enclave) +
NVIDIA H100 in TEE mode. Each `recall` returns the LLM answer plus an
attestation record that can be re-verified through the gateway's
`/v1/attestations/verify` endpoint.

Two modes:
  1. `recall(...)` — full retrieval-augmented inference, requires SIWE
     auth + a Mind owned by (or shared with) the caller.
  2. `verify_attestation(hash)` — public endpoint, no auth, looks up an
     attestation hash and returns the verifier's verdict.

Endpoint comes from `SEALEDMIND_INFERENCE_BASE` (default: the deployed
Railway gateway). Override for self-hosted deployments.
"""
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from ..errors import SealedMindError

DEFAULT_BASE = "https://sealedmind-backend-production.up.railway.app"


@dataclass(frozen=True)
class Attestation:
    hash: str
    chat_id: str
    verified: bool
    enclave: str
    operation: str = ""
    mind_id: str = ""
    timestamp: str = ""

    @property
    def attestation_hash_bytes(self) -> bytes:
        # SHA-256 over canonical attestation: hash + chatId + verified + enclave
        canonical = f"{self.hash}|{self.chat_id}|{self.verified}|{self.enclave}"
        return hashlib.sha256(canonical.encode("utf-8")).digest()


@dataclass(frozen=True)
class RecallResult:
    answer: str
    memories: list[dict[str, Any]]
    attestation: Attestation


class SealedInferenceClient:
    def __init__(
        self,
        *,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = 60.0,
    ) -> None:
        self._base = (base_url or os.environ.get("SEALEDMIND_INFERENCE_BASE", DEFAULT_BASE)).rstrip("/")
        self._api_key = api_key or os.environ.get("SEALEDMIND_INFERENCE_API_KEY")
        self._client = httpx.AsyncClient(timeout=timeout)

    async def health(self) -> dict[str, Any]:
        r = await self._client.get(f"{self._base}/health")
        r.raise_for_status()
        return r.json()

    async def verify_attestation(self, attestation_hash: str) -> Attestation:
        """Re-verify an attestation through the gateway. No auth needed."""
        r = await self._client.post(
            f"{self._base}/v1/attestations/verify",
            json={"hash": attestation_hash},
            headers={"Content-Type": "application/json"},
        )
        if r.status_code != 200:
            raise SealedMindError(f"verify failed ({r.status_code}): {r.text}")
        body = r.json()
        if not body.get("verified"):
            raise SealedMindError(f"gateway says not verified: {body}")
        att = body["attestation"]
        return Attestation(
            hash=att["hash"],
            chat_id=att["chatId"],
            verified=att["verified"],
            enclave=att.get("teeEnvironment", {}).get("cpu", ""),
            operation=att.get("operation", ""),
            mind_id=att.get("mindId", ""),
            timestamp=att.get("timestamp", ""),
        )

    async def recall(
        self,
        *,
        mind_id: str,
        query: str,
        shard: Optional[str] = None,
        top_k: int = 5,
    ) -> RecallResult:
        """Retrieval-augmented inference inside the enclave.

        Requires a SIWE-derived bearer token in `api_key` (set the
        `SEALEDMIND_INFERENCE_API_KEY` env var or pass `api_key=` at
        construction).
        """
        if not self._api_key:
            raise SealedMindError(
                "recall requires an API key — set SEALEDMIND_INFERENCE_API_KEY"
            )
        body: dict[str, Any] = {"query": query, "topK": top_k, "includeAttestation": True}
        if shard:
            body["shard"] = shard
        r = await self._client.post(
            f"{self._base}/v1/minds/{mind_id}/recall",
            json=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self._api_key}",
            },
        )
        if r.status_code != 200:
            raise SealedMindError(f"recall failed ({r.status_code}): {r.text}")
        payload = r.json()
        att = payload.get("attestation") or {}
        return RecallResult(
            answer=payload.get("answer", ""),
            memories=payload.get("memories", []),
            attestation=Attestation(
                hash=att.get("hash", ""),
                chat_id=att.get("chatId", ""),
                verified=att.get("verified", False),
                enclave=att.get("enclave", ""),
            ),
        )

    async def aclose(self) -> None:
        await self._client.aclose()


__all__ = ["SealedInferenceClient", "Attestation", "RecallResult"]

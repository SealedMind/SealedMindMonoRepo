"""Async HTTP client for the SealedMind backend.

The shape mirrors the official @sealedmind/sdk TypeScript client so docs
+ snippets stay in sync.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

from .types import (
    Attestation,
    CapabilityGrant,
    Memory,
    Mind,
    RecallResult,
    RememberResult,
    _RawChatResponse,
)

DEFAULT_API_URL = "https://sealedmind-backend-production.up.railway.app"


class SealedMindError(Exception):
    """Raised on non-2xx responses from the SealedMind backend."""

    def __init__(self, status: int, path: str, message: str) -> None:
        super().__init__(f"SealedMind API error ({status}) on {path}: {message}")
        self.status = status
        self.path = path


class SealedMind:
    """Async SealedMind client.

    Two auth modes:
      * `api_key` — long-lived `sm_*` key issued at sealedmind.io/developer
        (or `sm_op_*` operator key for headless integrations)
      * `session_token` — short-lived SIWE bearer (for in-browser/wallet flows)

    Use `await client.chat(...)` for direct TEE-attested LLM calls (no
    Mind required) — that's the cheapest way to test your key works.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        api_url: str | None = None,
        session_token: str | None = None,
        timeout: float = 60.0,
    ) -> None:
        self._api_url = (api_url or os.environ.get("SEALEDMIND_API_URL", DEFAULT_API_URL)).rstrip("/")
        self._token = api_key or session_token or os.environ.get("SEALEDMIND_API_KEY")
        if not self._token:
            raise SealedMindError(
                0,
                "<init>",
                "either api_key= or session_token= is required (or set SEALEDMIND_API_KEY)",
            )
        self._client = httpx.AsyncClient(timeout=timeout)

    # ──────────────────────────────────────────────── auth helpers

    def set_session(self, token: str) -> None:
        """Replace the bearer token (e.g. after a SIWE login)."""
        self._token = token

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> "SealedMind":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    # ──────────────────────────────────────────────── Minds

    async def create_mind(self, name: str | None = None, shards: list[str] | None = None) -> Mind:
        body: dict[str, Any] = {}
        if name:
            body["name"] = name
        if shards:
            body["shards"] = shards
        data = await self._post("/v1/minds", body)
        return Mind.model_validate(data.get("mind", data))

    async def list_minds(self) -> list[Mind]:
        data = await self._get("/v1/minds")
        return [Mind.model_validate(m) for m in data.get("minds", [])]

    async def get_mind(self, mind_id: str) -> Mind:
        data = await self._get(f"/v1/minds/{mind_id}")
        return Mind.model_validate(data.get("mind", data))

    # ──────────────────────────────────────────────── Memory

    async def remember(
        self,
        mind_id: str,
        *,
        content: str,
        shard: str | None = None,
        tags: list[str] | None = None,
    ) -> RememberResult:
        body: dict[str, Any] = {"content": content}
        if shard:
            body["shard"] = shard
        if tags:
            body["tags"] = tags
        data = await self._post(f"/v1/minds/{mind_id}/remember", body)
        return RememberResult.model_validate(data)

    async def recall(
        self,
        mind_id: str,
        *,
        query: str,
        shard: str | None = None,
        top_k: int = 5,
        include_attestation: bool = True,
    ) -> RecallResult:
        body: dict[str, Any] = {
            "query": query,
            "topK": top_k,
            "includeAttestation": include_attestation,
        }
        if shard:
            body["shard"] = shard
        data = await self._post(f"/v1/minds/{mind_id}/recall", body)
        return RecallResult.model_validate(data)

    # ──────────────────────────────────────────────── Capabilities

    async def grant_capability(
        self,
        mind_id: str,
        *,
        grantee: str,
        shard: str,
        read_only: bool = True,
        expiry_unix: int = 0,
    ) -> CapabilityGrant:
        body = {
            "grantee": grantee,
            "shardName": shard,
            "readOnly": read_only,
            "expiry": expiry_unix,
        }
        data = await self._post(f"/v1/minds/{mind_id}/capabilities", body)
        return CapabilityGrant.model_validate(data.get("capability", data))

    async def list_capabilities(self, mind_id: str) -> list[CapabilityGrant]:
        data = await self._get(f"/v1/minds/{mind_id}/capabilities")
        return [CapabilityGrant.model_validate(c) for c in data.get("capabilities", [])]

    async def revoke_capability(self, mind_id: str, cap_id: str) -> dict[str, Any]:
        return await self._delete(f"/v1/minds/{mind_id}/capabilities/{cap_id}")

    # ──────────────────────────────────────────────── Inference (no Mind needed)

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 512,
        temperature: float = 0.3,
    ) -> tuple[str, Attestation]:
        """TEE-attested chat completion (Qwen 2.5 7B in Intel TDX).

        Returns (content, attestation). The chatId in the attestation can
        be re-verified via `client.verify_attestation(chat_id)`.
        """
        body = {"messages": messages, "maxTokens": max_tokens, "temperature": temperature}
        data = await self._post("/v1/inference/chat", body)
        raw = _RawChatResponse.model_validate(data)
        return raw.content, Attestation(
            chatId=raw.chat_id, verified=raw.attestation_valid, enclave=raw.enclave or "Intel TDX"
        )

    async def verify_attestation(self, chat_id: str) -> bool:
        data = await self._post("/v1/attestations/verify", {"hash": chat_id})
        return bool(data.get("verified"))

    # ──────────────────────────────────────────────── Audit

    async def audit_log(
        self,
        mind_id: str,
        *,
        offset: int = 0,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        data = await self._get(
            f"/v1/minds/{mind_id}/audit?offset={offset}&limit={limit}"
        )
        return list(data.get("entries", data.get("log", [])))

    # ──────────────────────────────────────────────── HTTP plumbing

    def _headers(self) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._token}",
        }

    async def _get(self, path: str) -> dict[str, Any]:
        r = await self._client.get(self._api_url + path, headers=self._headers())
        return self._handle(r, path)

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        r = await self._client.post(self._api_url + path, headers=self._headers(), json=body)
        return self._handle(r, path)

    async def _delete(self, path: str) -> dict[str, Any]:
        r = await self._client.delete(self._api_url + path, headers=self._headers())
        return self._handle(r, path)

    @staticmethod
    def _handle(r: httpx.Response, path: str) -> dict[str, Any]:
        if not r.is_success:
            try:
                msg = r.json().get("error") or r.text
            except ValueError:
                msg = r.text
            raise SealedMindError(r.status_code, path, str(msg)[:300])
        if r.status_code == 204:
            return {}
        try:
            return r.json()
        except ValueError:
            return {}

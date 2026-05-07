"""Smoke tests for the SealedMind Python SDK.

Pure unit tests against an in-memory mock — no network. Integration
tests live in tests/test_integration.py and are gated by RUN_INTEGRATION.
"""
from __future__ import annotations

import pytest
import respx
from httpx import Response

from sealedmind import SealedMind, SealedMindError
from sealedmind.types import RecallResult


@respx.mock
async def test_create_mind_roundtrip() -> None:
    api_url = "https://api.test"
    respx.post(f"{api_url}/v1/minds").mock(
        return_value=Response(200, json={"mind": {"id": "m1", "owner": "0xabc"}})
    )

    client = SealedMind(api_key="sm_test", api_url=api_url)
    mind = await client.create_mind("agent")
    assert mind.id == "m1"
    await client.aclose()


@respx.mock
async def test_chat_returns_attestation() -> None:
    api_url = "https://api.test"
    respx.post(f"{api_url}/v1/inference/chat").mock(
        return_value=Response(
            200,
            json={
                "content": "Hello",
                "model": "qwen-2.5-7b",
                "chatId": "abc-123",
                "attestationValid": True,
                "enclave": "Intel TDX",
            },
        )
    )

    client = SealedMind(api_key="sm_test", api_url=api_url)
    content, att = await client.chat([{"role": "user", "content": "hi"}])
    assert content == "Hello"
    assert att.chat_id == "abc-123"
    assert att.verified is True
    assert att.enclave == "Intel TDX"
    await client.aclose()


@respx.mock
async def test_error_propagates_status() -> None:
    api_url = "https://api.test"
    respx.post(f"{api_url}/v1/inference/chat").mock(
        return_value=Response(401, json={"error": "Missing Authorization header"})
    )

    client = SealedMind(api_key="sm_test", api_url=api_url)
    with pytest.raises(SealedMindError) as exc_info:
        await client.chat([{"role": "user", "content": "hi"}])
    assert exc_info.value.status == 401
    await client.aclose()


def test_construction_requires_token() -> None:
    with pytest.raises(SealedMindError):
        SealedMind(api_url="https://api.test")

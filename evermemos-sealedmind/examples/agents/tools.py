"""Tool implementations the agents call.

Each tool returns a small JSON-serializable result the LLM can incorporate
into its next turn. Side-effects (writes to 0G storage, on-chain txs) are
narrated to the demo orchestrator via a callback so the recording can show
them inline.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from evermemos_sealedmind.capabilities.client import CapabilityClient
from evermemos_sealedmind.capabilities.grants import GrantSpec
from evermemos_sealedmind.errors import SealedMindCapabilityError
from evermemos_sealedmind.kv_storage.sealed_kv import SealedMindKVStorage

EventCallback = Callable[[str, dict[str, Any]], None]


# ---------------------------------------------------------- Tool schemas

TOOL_SCHEMAS = {
    "remember": {
        "name": "remember",
        "description": (
            "Store a memory for the user. Use this to record any meaningful "
            "fact, event, preference, or update they share. The memory is "
            "encrypted under the user's key and persisted to 0G testnet."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "The memory content (free-form text).",
                },
                "shard": {
                    "type": "string",
                    "description": (
                        "Logical shard for the memory: 'fitness', 'health', "
                        "'finance', 'general', etc."
                    ),
                },
            },
            "required": ["content", "shard"],
        },
    },
    "recall": {
        "name": "recall",
        "description": (
            "Retrieve a previously stored memory by its exact key. The agent "
            "must supply the precise key string. If the agent has a "
            "capability_token (because the memory is owned by another user), "
            "the gateway verifies the capability on chain before returning "
            "the data. If you don't know the exact key, call `list_shard` "
            "first to discover available memories."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "The exact memory key to retrieve.",
                },
            },
            "required": ["key"],
        },
    },
    "list_shard": {
        "name": "list_shard",
        "description": (
            "List recent memory keys in the agent's accessible shard, with a "
            "short preview of each. Use this to discover what's available "
            "before calling `recall`. Returns up to 10 most recent entries."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    "share_with": {
        "name": "share_with",
        "description": (
            "Grant another agent (by wallet address) read-only access to one "
            "of the user's memory shards for a limited time. Issues an "
            "on-chain capability via the SealedMind CapabilityRegistry. "
            "Returns the capability token to communicate to the grantee."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "grantee_address": {
                    "type": "string",
                    "description": "EVM address of the agent receiving access.",
                },
                "shard": {
                    "type": "string",
                    "description": "Which shard to share ('fitness', etc.).",
                },
                "days": {
                    "type": "integer",
                    "description": "How many days the capability is valid.",
                },
            },
            "required": ["grantee_address", "shard", "days"],
        },
    },
    "revoke": {
        "name": "revoke",
        "description": (
            "Revoke a previously granted capability. Issues an on-chain "
            "revocation that takes effect immediately."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "capability_token": {
                    "type": "string",
                    "description": "The capability token to revoke.",
                },
            },
            "required": ["capability_token"],
        },
    },
}


# ---------------------------------------------------------- Tool runtime


@dataclass
class ToolContext:
    """Shared state passed to every tool invocation."""
    storage: SealedMindKVStorage
    capabilities: CapabilityClient
    mind_id: int
    namespace: str  # "shard" the agent operates in by default
    capability_token: Optional[str] = None  # set when reading shared memories
    on_event: EventCallback = field(default=lambda kind, payload: None)


async def _tool_remember(ctx: ToolContext, content: str, shard: str) -> dict[str, Any]:
    key = f"mem:{shard}:{int(time.time())}:{uuid.uuid4().hex[:6]}"
    payload = json.dumps({"content": content, "shard": shard, "ts": int(time.time())})
    ok = await ctx.storage.put(key, payload)
    # Side channel for list_shard to surface the most-recent real key without
    # forcing the agent to remember it.
    try:
        ctx.storage._demo_last_key = key  # noqa: SLF001
    except Exception:
        pass
    ctx.on_event("storage_write", {"key": key, "shard": shard, "bytes": len(payload), "ok": ok})
    return {"stored": ok, "key": key, "shard": shard}


async def _tool_recall(ctx: ToolContext, key: str) -> dict[str, Any]:
    if ctx.capability_token:
        try:
            await ctx.capabilities.verify(
                token=ctx.capability_token,
                namespace=ctx.namespace,
                key=key,
                scope="read",
            )
            ctx.on_event("capability_verified", {"token": ctx.capability_token, "ok": True})
        except SealedMindCapabilityError as exc:
            ctx.on_event("capability_denied", {"token": ctx.capability_token, "error": str(exc)})
            return {"error": f"access denied: {exc}", "key": key}

    value = await ctx.storage.get(key)
    if value is None:
        return {"found": False, "key": key}

    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        decoded = {"content": value}
    ctx.on_event("storage_read", {"key": key, "bytes": len(value)})
    return {"found": True, "key": key, **decoded}


async def _tool_share_with(
    ctx: ToolContext, grantee_address: str, shard: str, days: int
) -> dict[str, Any]:
    expiry = int(time.time()) + max(1, int(days)) * 24 * 3600
    grant = await ctx.capabilities.grant(GrantSpec(
        mind_id=ctx.mind_id,
        shard_name=shard,
        grantee=grantee_address,
        read_only=True,
        expiry_unix=expiry,
    ))
    ctx.on_event("capability_granted", {
        "tx": grant.tx_hash, "token": grant.token, "shard": shard,
        "grantee": grantee_address, "days": days,
    })
    return {
        "granted": True,
        "capability_token": grant.token,
        "tx_hash": grant.tx_hash,
        "shard": shard,
        "expires_in_days": days,
    }


async def _tool_revoke(ctx: ToolContext, capability_token: str) -> dict[str, Any]:
    tx = await ctx.capabilities.revoke(capability_token)
    ctx.on_event("capability_revoked", {"tx": tx, "token": capability_token})
    return {"revoked": True, "tx_hash": tx, "capability_token": capability_token}


async def _tool_list_shard(ctx: ToolContext) -> dict[str, Any]:
    """List recent keys in the agent's namespace, with brief previews.

    Capability is verified once for the namespace; iteration then reads each
    blob locally (already-decrypted via the iterator). Returns at most 10.
    """
    if ctx.capability_token:
        try:
            await ctx.capabilities.verify(
                token=ctx.capability_token,
                namespace=ctx.namespace,
                key=ctx.namespace,
                scope="read",
            )
            ctx.on_event("capability_verified", {"token": ctx.capability_token, "ok": True})
        except SealedMindCapabilityError as exc:
            ctx.on_event("capability_denied", {"token": ctx.capability_token, "error": str(exc)})
            return {"error": f"access denied: {exc}", "shard": ctx.namespace}

    items: list[dict[str, Any]] = []
    try:
        async for blinded, value in ctx.storage.iterate_all():
            preview = value
            try:
                decoded = json.loads(value)
                preview = decoded.get("content") or value
            except json.JSONDecodeError:
                pass
            items.append({
                "blinded_key": blinded[:32] + "...",
                "preview": str(preview)[:140],
            })
            if len(items) >= 10:
                break
    except Exception as exc:
        return {"error": f"iterate failed: {exc}", "shard": ctx.namespace}

    # Also expose the most-recently-written REAL key so the agent can recall it.
    # (We track this on the storage instance via a side channel.)
    last_key = getattr(ctx.storage, "_demo_last_key", None)
    if last_key:
        items.insert(0, {
            "key": last_key,
            "note": "most recent storage key in this shard",
        })

    ctx.on_event("storage_read", {"key": f"<list:{ctx.namespace}>", "bytes": 0})
    return {"shard": ctx.namespace, "items": items, "count": len(items)}


TOOL_DISPATCH = {
    "remember":   _tool_remember,
    "recall":     _tool_recall,
    "share_with": _tool_share_with,
    "revoke":     _tool_revoke,
    "list_shard": _tool_list_shard,
}


async def execute_tool(ctx: ToolContext, name: str, args: dict[str, Any]) -> Any:
    fn = TOOL_DISPATCH.get(name)
    if fn is None:
        return {"error": f"unknown tool: {name}"}
    try:
        return await fn(ctx, **args)
    except TypeError as exc:
        return {"error": f"bad arguments for {name}: {exc}"}
    except Exception as exc:
        return {"error": f"{name} failed: {type(exc).__name__}: {exc}"}


def tool_schemas_for(names: list[str]) -> list[dict[str, Any]]:
    return [TOOL_SCHEMAS[n] for n in names if n in TOOL_SCHEMAS]


__all__ = [
    "TOOL_SCHEMAS",
    "ToolContext",
    "execute_tool",
    "tool_schemas_for",
]

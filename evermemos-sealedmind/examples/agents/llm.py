"""LLM backends for the agent demo.

Two implementations:

* `ClaudeBackend` — Anthropic Claude (Sonnet 4.6 / 4.7), used by the patient agent.
* `SealedInferenceBackend` — Qwen 2.5 7B running inside Intel TDX, exposed
  via SealedMind's `POST /v1/inference/chat`. Used by the doctor agent.

Both implement an OpenAI-style `chat(messages, tools)` returning a
`ChatResult` so the agent code is backend-agnostic.

Tool calling: only the Claude backend handles native tool calls. The
SealedInference backend uses a JSON-protocol pattern: we instruct Qwen
to emit `{"tool": "name", "args": {...}}` on its own line; the agent
loop parses and dispatches.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any

import httpx
from anthropic import Anthropic


@dataclass
class ToolCall:
    name: str
    args: dict[str, Any]
    call_id: str = ""


@dataclass
class ChatResult:
    text: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


# --------------------------------------------------------------- Claude


class ClaudeBackend:
    """Anthropic Claude with native tool use."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "claude-sonnet-4-6",
        max_tokens: int = 1024,
    ) -> None:
        self._client = Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))
        self._model = model
        self._max_tokens = max_tokens

    @property
    def label(self) -> str:
        return f"Claude ({self._model})"

    def chat(
        self,
        *,
        system: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
        tool_defs = tools or []
        msg = self._client.messages.create(
            model=self._model,
            max_tokens=self._max_tokens,
            system=system,
            messages=messages,
            tools=tool_defs if tool_defs else None,
        )

        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        for block in msg.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append(
                    ToolCall(name=block.name, args=dict(block.input), call_id=block.id)
                )

        return ChatResult(
            text="\n".join(text_parts).strip(),
            tool_calls=tool_calls,
            metadata={
                "stop_reason": msg.stop_reason,
                "input_tokens": msg.usage.input_tokens,
                "output_tokens": msg.usage.output_tokens,
            },
        )


# ------------------------------------------------------ Sealed Inference


_TOOL_LINE = re.compile(r'\{[^{}]*"tool"\s*:\s*"[^"]+".*\}', re.MULTILINE | re.DOTALL)


class SealedInferenceBackend:
    """Qwen 2.5 7B in Intel TDX via SealedMind's /v1/inference/chat.

    Tool-calling protocol (since Qwen via the broker doesn't support
    OpenAI-style function calls reliably): we ask the model to emit a
    one-line JSON object `{"tool": "name", "args": {...}}` whenever it
    wants to invoke a tool. We parse that out of the text response.
    """

    DEFAULT_BASE = "https://sealedmind-backend-production.up.railway.app"

    def __init__(
        self,
        *,
        base_url: str | None = None,
        max_tokens: int = 512,
        timeout: float = 120.0,
    ) -> None:
        self._base = (base_url or os.environ.get(
            "SEALEDMIND_INFERENCE_BASE", self.DEFAULT_BASE
        )).rstrip("/")
        self._max_tokens = max_tokens
        self._client = httpx.Client(timeout=timeout)
        self._last_chat_id = ""
        self._last_attestation_valid = False

    @property
    def label(self) -> str:
        return "Qwen 2.5 7B (Intel TDX via 0G Sealed Inference)"

    @property
    def last_attestation(self) -> dict[str, Any]:
        return {"chatId": self._last_chat_id, "valid": self._last_attestation_valid}

    @staticmethod
    def _format_tool_protocol(tools: list[dict[str, Any]]) -> str:
        if not tools:
            return ""
        parts = ["You can call tools by emitting a single line of JSON:"]
        for t in tools:
            schema = t.get("input_schema", {}).get("properties", {})
            args = ", ".join(f'"{k}": <{v.get("type", "value")}>' for k, v in schema.items())
            parts.append(f'  {t["name"]}: {{"tool": "{t["name"]}", "args": {{{args}}}}}')
            parts.append(f'    {t.get("description", "")}')
        parts.append(
            "Emit ONLY the JSON when invoking a tool. After receiving the tool "
            "result, write your final natural-language reply with no JSON."
        )
        return "\n".join(parts)

    def chat(
        self,
        *,
        system: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
        tool_defs = tools or []
        full_system = system
        if tool_defs:
            full_system = system + "\n\n" + self._format_tool_protocol(tool_defs)

        # Convert Anthropic-style messages (which may contain tool_result
        # blocks) into plain {role, content} pairs the broker accepts.
        flat_messages: list[dict[str, str]] = []
        for m in messages:
            content = m["content"]
            if isinstance(content, list):
                # Anthropic uses content blocks; flatten
                lines: list[str] = []
                for c in content:
                    if isinstance(c, dict):
                        t = c.get("type")
                        if t == "text":
                            lines.append(c["text"])
                        elif t == "tool_use":
                            lines.append(
                                json.dumps(
                                    {"tool": c["name"], "args": c["input"]},
                                    separators=(",", ":"),
                                )
                            )
                        elif t == "tool_result":
                            inner = c.get("content", "")
                            if isinstance(inner, list):
                                inner = "".join(
                                    (x.get("text", "") if isinstance(x, dict) else str(x))
                                    for x in inner
                                )
                            lines.append(f"<tool_result>{inner}</tool_result>")
                content = "\n".join(lines)
            flat_messages.append({"role": m["role"], "content": str(content)})

        body = {
            "messages": [{"role": "system", "content": full_system}] + flat_messages,
            "maxTokens": self._max_tokens,
            "temperature": 0.3,
        }
        try:
            resp = self._client.post(f"{self._base}/v1/inference/chat", json=body)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(
                f"sealed inference chat failed: {exc} — is /v1/inference/chat deployed?"
            ) from exc

        data = resp.json()
        text = (data.get("content") or "").strip()
        self._last_chat_id = data.get("chatId", "")
        self._last_attestation_valid = bool(data.get("attestationValid"))

        tool_calls: list[ToolCall] = []
        # Try to find a tool-call JSON anywhere in the response.
        match = _TOOL_LINE.search(text)
        if match:
            try:
                parsed = json.loads(match.group(0))
                if isinstance(parsed, dict) and "tool" in parsed:
                    tool_calls.append(ToolCall(
                        name=parsed["tool"],
                        args=parsed.get("args", {}) or {},
                        call_id=self._last_chat_id or "qwen-tool",
                    ))
                    # Strip the tool JSON from visible text
                    text = (text[: match.start()] + text[match.end():]).strip()
            except json.JSONDecodeError:
                pass

        return ChatResult(
            text=text,
            tool_calls=tool_calls,
            metadata={
                "model": data.get("model"),
                "chatId": self._last_chat_id,
                "attestationValid": self._last_attestation_valid,
                "enclave": data.get("enclave", "Intel TDX"),
            },
        )

    def close(self) -> None:
        self._client.close()


__all__ = ["ChatResult", "ToolCall", "ClaudeBackend", "SealedInferenceBackend"]

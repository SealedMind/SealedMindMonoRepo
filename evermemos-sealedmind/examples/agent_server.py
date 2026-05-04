"""FastAPI bridge: HTTP + WebSocket access to the LangGraph agents.

Endpoints:
  POST   /api/state                        → demo bootstrap state
  POST   /api/patient/chat  body: {message}→ {reply, tool_calls}
  POST   /api/doctor/chat   body: {message}→ {reply, tool_calls, attestation}
  POST   /api/reset                        → clear agents (re-record demo)
  WS     /ws/events                        → live event stream
                                             (tool_call, storage_*, capability_*)

Run:
    cd evermemos-sealedmind
    PYTHONPATH=. \\
    SEALEDMIND_PRIVATE_KEY=0x... \\
    DOCTOR_ADDRESS=0x... \\
    PATIENT_MIND_ID=0 \\
    ZEROG_STREAM_ID=<...> \\
    SEALEDMIND_BACKUP_KEY=<...> \\
    .venv/bin/python examples/agent_server.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Any

# load .env
def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_dotenv()

REQUIRED = [
    "ANTHROPIC_API_KEY", "SEALEDMIND_PRIVATE_KEY", "DOCTOR_ADDRESS",
    "PATIENT_MIND_ID", "ZEROG_STREAM_ID", "SEALEDMIND_BACKUP_KEY",
]
missing = [k for k in REQUIRED if not os.environ.get(k)]
if missing:
    print(f"missing env: {', '.join(missing)}", file=sys.stderr)
    sys.exit(2)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from evermemos_sealedmind.capabilities.client import CapabilityClient
from evermemos_sealedmind.config import SealedMindConfig
from evermemos_sealedmind.kv_storage.sealed_kv import SealedMindKVStorage

from examples.agents.agent import MemoryAgent
from examples.agents.llm import ClaudeBackend, SealedInferenceBackend
from examples.agents.personas import DOCTOR_PERSONA, PATIENT_PERSONA
from examples.agents.tools import ToolContext


# ──────────────────────────────────────────── App + state


class DemoState:
    """Singleton holding the live agents + event subscribers."""

    def __init__(self) -> None:
        os.environ.setdefault("SEALEDMIND_NETWORK", "testnet")
        cfg = SealedMindConfig.from_env()
        rpc = cfg.rpc_url
        indexer = "https://indexer-storage-testnet-turbo.0g.ai"
        flow = "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296"
        kv_url = os.environ.get("ZEROG_READ_NODE", "http://127.0.0.1:6789")
        master = bytes.fromhex(os.environ["SEALEDMIND_BACKUP_KEY"].removeprefix("0x"))
        pk = os.environ["SEALEDMIND_PRIVATE_KEY"]
        stream = os.environ["ZEROG_STREAM_ID"]

        self.shard = "fitness"
        self.mind_id = int(os.environ["PATIENT_MIND_ID"])
        self.doctor_addr = os.environ["DOCTOR_ADDRESS"]

        self._loop: asyncio.AbstractEventLoop | None = None
        self._subscribers: set[asyncio.Queue[dict]] = set()

        self.storage = SealedMindKVStorage(
            kv_url=kv_url, rpc_url=rpc, indexer_url=indexer, flow_address=flow,
            stream_id=stream, wallet_private_key=pk, master_key=master,
            namespace=self.shard,
        )
        self.capabilities = CapabilityClient(config=cfg, signing_key=pk)

        self.last_capability: str | None = None
        self.last_storage_key: str | None = None
        self.last_decrypted_memory: str | None = None

        # Side effect: every event comes through here
        def on_event(kind: str, payload: dict[str, Any]) -> None:
            if kind == "capability_granted":
                self.last_capability = payload.get("token")
            if kind == "storage_write":
                self.last_storage_key = payload.get("key")
            if kind == "tool_result":
                res = payload.get("result")
                if isinstance(res, dict) and res.get("found") and res.get("content"):
                    self.last_decrypted_memory = str(res["content"])
            self._broadcast({
                "kind": kind,
                "payload": payload,
                "ts": time.time(),
                "id": uuid.uuid4().hex[:8],
            })

        self._on_event = on_event

        self.patient_ctx = ToolContext(
            storage=self.storage, capabilities=self.capabilities,
            mind_id=self.mind_id, namespace=self.shard, on_event=on_event,
        )
        self.doctor_ctx = ToolContext(
            storage=self.storage, capabilities=self.capabilities,
            mind_id=self.mind_id, namespace=self.shard, on_event=on_event,
        )

        self.patient = MemoryAgent(
            name="aria", persona=PATIENT_PERSONA,
            llm=ClaudeBackend(), tool_ctx=self.patient_ctx,
            allowed_tools=["remember", "recall", "share_with", "revoke"],
        )
        # Doctor agent uses Claude for reliable agentic tool-calling.
        # Sealed Inference (Qwen 2.5 7B in TDX) is invoked separately AFTER
        # the recall to produce a TEE-attested clinical summary of the
        # decrypted memory — see _doctor_tee_summarize() below.
        self.doctor = MemoryAgent(
            name="doctor", persona=DOCTOR_PERSONA,
            llm=ClaudeBackend(), tool_ctx=self.doctor_ctx,
            allowed_tools=["list_shard", "recall"],
        )
        from examples.agents.llm import SealedInferenceBackend as _SealInf
        self._sealed_inference = _SealInf()

    # ---- subscribers ----

    def subscribe(self) -> asyncio.Queue[dict]:
        q: asyncio.Queue[dict] = asyncio.Queue(maxsize=200)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[dict]) -> None:
        self._subscribers.discard(q)

    def _broadcast(self, evt: dict) -> None:
        loop = self._loop
        if loop is None:
            return
        for q in list(self._subscribers):
            try:
                loop.call_soon_threadsafe(q.put_nowait, evt)
            except (asyncio.QueueFull, RuntimeError):
                pass

    def attach_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    # ---- lifecycle ----

    def reset(self) -> None:
        self.last_capability = None
        self.last_storage_key = None
        self.last_decrypted_memory = None
        # Build fresh agents to clear LangGraph conversation state
        self.patient = MemoryAgent(
            name="aria", persona=PATIENT_PERSONA,
            llm=ClaudeBackend(), tool_ctx=self.patient_ctx,
            allowed_tools=["remember", "recall", "share_with", "revoke"],
        )
        self.doctor = MemoryAgent(
            name="doctor", persona=DOCTOR_PERSONA,
            llm=SealedInferenceBackend(), tool_ctx=self.doctor_ctx,
            allowed_tools=["recall"],
        )


state = DemoState()
app = FastAPI(title="evermemos-sealedmind agent bridge")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo machine — tighten in prod
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _on_start() -> None:
    state.attach_loop(asyncio.get_running_loop())


# ──────────────────────────────────────────── Schemas


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    metadata: dict[str, Any] = {}
    last_capability: str | None = None
    last_storage_key: str | None = None


# ──────────────────────────────────────────── Endpoints


@app.get("/api/state")
async def get_state():
    return {
        "patient": {
            "name": "Aria",
            "subtitle": "Alice's personal assistant",
            "brain": state.patient.llm.label,
        },
        "doctor": {
            "name": "Dr. Chen's assistant",
            "subtitle": "Clinical AI · TEE-attested reads",
            "brain": (
                f"{state.doctor.llm.label} (orchestration) + "
                f"Qwen 2.5 7B in Intel TDX (TEE summary)"
            ),
        },
        "shard": state.shard,
        "mind_id": state.mind_id,
        "doctor_address": state.doctor_addr,
        "explorer_base": "https://chainscan-galileo.0g.ai",
        "capability_registry": "0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66",
        "last_capability": state.last_capability,
        "last_storage_key": state.last_storage_key,
    }


@app.post("/api/patient/chat", response_model=ChatResponse)
async def patient_chat(req: ChatRequest):
    result = await asyncio.to_thread(state.patient.chat, req.message)
    return ChatResponse(
        reply=result.text,
        metadata=result.metadata,
        last_capability=state.last_capability,
        last_storage_key=state.last_storage_key,
    )


@app.post("/api/doctor/chat", response_model=ChatResponse)
async def doctor_chat(req: ChatRequest):
    # propagate the latest granted capability into the doctor's context
    if state.last_capability:
        state.doctor_ctx.capability_token = state.last_capability

    result = await asyncio.to_thread(state.doctor.chat, req.message)

    # If the doctor successfully retrieved a memory, send it through Sealed
    # Inference (Qwen 2.5 7B in Intel TDX) for a TEE-attested clinical
    # summary — surfaces the chatId + attestation valid badge in the UI.
    metadata: dict[str, Any] = dict(result.metadata)
    decrypted = state.last_decrypted_memory
    if decrypted and "no longer have access" not in (result.text or "").lower():
        try:
            tee = await asyncio.to_thread(
                state._sealed_inference.chat,
                system=(
                    "You are a clinician's assistant running inside a hardware "
                    "TEE (Intel TDX). Given the patient's encrypted memory, "
                    "produce a 1-sentence clinical interpretation. No JSON, "
                    "no preamble, just the sentence."
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Patient memory: {decrypted}\n\n"
                        f"Doctor question: {req.message}"
                    ),
                }],
            )
            if tee.text:
                # Append TEE output to the doctor's reply so the recording
                # shows both Claude orchestration + Qwen TEE reasoning.
                result_text = (
                    result.text.rstrip()
                    + "\n\n— TEE-attested summary (Qwen 2.5 7B in Intel TDX): "
                    + tee.text.strip()
                )
            else:
                result_text = result.text
            sealed_meta = state._sealed_inference.last_attestation
            metadata["chatId"] = sealed_meta.get("chatId", "")
            metadata["attestationValid"] = sealed_meta.get("valid", False)
            metadata["enclave"] = "Intel TDX"
        except Exception as exc:
            result_text = result.text
            metadata["sealed_inference_error"] = str(exc)
    else:
        result_text = result.text

    return ChatResponse(
        reply=result_text,
        metadata=metadata,
        last_capability=state.last_capability,
        last_storage_key=state.last_storage_key,
    )


@app.post("/api/reset")
async def reset():
    state.reset()
    return {"ok": True}


@app.websocket("/ws/events")
async def ws_events(ws: WebSocket):
    await ws.accept()
    q = state.subscribe()
    try:
        while True:
            evt = await q.get()
            await ws.send_json(evt)
    except WebSocketDisconnect:
        pass
    finally:
        state.unsubscribe(q)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")

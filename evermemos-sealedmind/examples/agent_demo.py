"""Cinematic two-agent demo for the screen recording.

Story:
  Aria (Alice's personal assistant, Claude brain) helps Alice log her runs
  and share her fitness data with Dr. Chen's clinic.
  Dr. Chen's clinical assistant (Qwen 2.5 7B in Intel TDX, via SealedMind
  Sealed Inference) reads the shared data, gives clinical feedback, then
  loses access when Alice revokes mid-session.

Every memory write encrypts under SealedMind and lands on 0G testnet.
Every grant/revoke is a real on-chain tx. The doctor agent's reasoning
runs inside a TEE — every reply carries a TEE attestation.

Run:
    ANTHROPIC_API_KEY=sk-... \\
    SEALEDMIND_PRIVATE_KEY=0x...funded... \\
    DOCTOR_ADDRESS=0x... \\
    PATIENT_MIND_ID=0 \\
    ZEROG_STREAM_ID=<from .0g_secrets> \\
    SEALEDMIND_BACKUP_KEY=<32 bytes hex> \\
    python examples/agent_demo.py
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Any


def _load_dotenv() -> None:
    """Tiny .env loader so the demo runs without `python-dotenv`.
    Reads `<package_root>/.env` and sets any KEY=VALUE not already in env."""
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_dotenv()


# ─────────────────────────────────────────────────── Cinematic terminal


class C:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[38;5;42m"
    YELLOW = "\033[38;5;220m"
    BLUE = "\033[38;5;39m"
    GREY = "\033[38;5;243m"
    RED = "\033[38;5;203m"
    PURPLE = "\033[38;5;141m"


def frame(title: str, color: str) -> None:
    bar = "─" * max(40, 56 - len(title))
    print(f"\n{color}╭─ {title} {bar}─╮{C.RESET}")


def end_frame(color: str) -> None:
    print(f"{color}╰{'─' * 60}╯{C.RESET}\n")


def line(color: str, body: str) -> None:
    for ln in body.split("\n"):
        print(f"{color}│{C.RESET}  {ln}")


def speak(speaker: str, color: str, message: str) -> None:
    print(f"\n{color}{speaker}:{C.RESET} {message}\n")


def banner(text: str, color: str = C.BOLD) -> None:
    bar = "═" * 60
    print(f"\n{color}{bar}{C.RESET}")
    print(f"{color}  {text}{C.RESET}")
    print(f"{color}{bar}{C.RESET}\n")


def _brief(o: Any, n: int = 60) -> str:
    s = str(o)
    return s if len(s) <= n else s[:n] + "..."


# ─────────────────────────────────────────────────── Event recorder


class EventRecorder:
    """Single object that captures events from tool calls AND prints them
    inline so the recording shows the on-chain machinery alongside the
    agent dialog."""

    def __init__(self) -> None:
        self.last_capability_token: str | None = None
        self.last_storage_key: str | None = None

    def __call__(self, kind: str, payload: dict[str, Any]) -> None:
        if kind == "tool_call":
            line(C.GREY, f"{C.DIM}[{payload['agent']}] tool: {payload['tool']}({_brief(payload['args'])}){C.RESET}")
        elif kind == "tool_result":
            res = payload.get("result", {})
            ok = isinstance(res, dict) and "error" not in res
            mark = "✓" if ok else "✗"
            line(C.GREY, f"{C.DIM}[{payload['agent']}] result {mark}: {_brief(res)}{C.RESET}")
        elif kind == "storage_write":
            self.last_storage_key = payload["key"]
            line(C.PURPLE, f"[storage] {C.DIM}encrypted → 0G testnet · key={payload['key'][:36]}... · {payload['bytes']}B{C.RESET}")
        elif kind == "storage_read":
            line(C.PURPLE, f"[storage] {C.DIM}decrypted ← 0G testnet · key={payload['key'][:36]}...{C.RESET}")
        elif kind == "capability_granted":
            self.last_capability_token = payload["token"]
            tx = payload["tx"].removeprefix("0x")
            line(C.BLUE, f"[chain]   {C.BOLD}grant tx: 0x{tx}{C.RESET}")
            line(C.BLUE, f"[chain]   {C.BOLD}capability: {payload['token']}{C.RESET}")
            line(C.GREY, f"          {C.DIM}https://chainscan-galileo.0g.ai/tx/0x{tx}{C.RESET}")
        elif kind == "capability_revoked":
            tx = payload["tx"].removeprefix("0x")
            line(C.RED, f"[chain]   {C.BOLD}revoke tx: 0x{tx}{C.RESET}")
            line(C.GREY, f"          {C.DIM}https://chainscan-galileo.0g.ai/tx/0x{tx}{C.RESET}")
        elif kind == "capability_verified":
            line(C.GREEN, f"[chain]   verifyCapability(...) → ✓ valid")
        elif kind == "capability_denied":
            line(C.RED,   f"[chain]   verifyCapability(...) → ✗ {payload.get('error', 'denied')}")


# ───────────────────────────────────────────────────────────── main


def main() -> int:
    required = [
        "ANTHROPIC_API_KEY", "SEALEDMIND_PRIVATE_KEY", "DOCTOR_ADDRESS",
        "PATIENT_MIND_ID", "ZEROG_STREAM_ID", "SEALEDMIND_BACKUP_KEY",
    ]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        print(f"missing env: {', '.join(missing)}", file=sys.stderr)
        return 2

    from evermemos_sealedmind.capabilities.client import CapabilityClient
    from evermemos_sealedmind.config import SealedMindConfig
    from evermemos_sealedmind.kv_storage.sealed_kv import SealedMindKVStorage

    from examples.agents.agent import MemoryAgent
    from examples.agents.llm import ClaudeBackend, SealedInferenceBackend
    from examples.agents.personas import DOCTOR_PERSONA, PATIENT_PERSONA
    from examples.agents.tools import ToolContext

    pk = os.environ["SEALEDMIND_PRIVATE_KEY"]
    stream = os.environ["ZEROG_STREAM_ID"]
    doctor_addr = os.environ["DOCTOR_ADDRESS"]
    mind_id = int(os.environ["PATIENT_MIND_ID"])
    master_key = bytes.fromhex(os.environ["SEALEDMIND_BACKUP_KEY"].removeprefix("0x"))

    os.environ.setdefault("SEALEDMIND_NETWORK", "testnet")
    config = SealedMindConfig.from_env()

    rpc = config.rpc_url
    indexer = "https://indexer-storage-testnet-turbo.0g.ai"
    flow = "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296"
    kv_url = os.environ.get("ZEROG_READ_NODE", "http://127.0.0.1:6789")
    shard = "fitness"

    banner("evermemos-sealedmind · live two-agent demo on 0G testnet", C.BOLD)
    print(f"  Patient assistant brain : {C.GREEN}Claude Sonnet 4.6{C.RESET} (Anthropic)")
    print(f"  Doctor assistant brain  : {C.YELLOW}Qwen 2.5 7B{C.RESET} (Intel TDX via 0G Sealed Inference)")
    print(f"  Memory backend          : SealedMindKVStorage → 0G testnet")
    print(f"  Capability registry     : {C.BLUE}0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66{C.RESET}")
    print(f"  Patient Mind tokenId    : {mind_id}")
    print(f"  Doctor address          : {doctor_addr}")

    recorder = EventRecorder()

    storage = SealedMindKVStorage(
        kv_url=kv_url, rpc_url=rpc, indexer_url=indexer, flow_address=flow,
        stream_id=stream, wallet_private_key=pk, master_key=master_key,
        namespace=shard,
    )
    capabilities = CapabilityClient(config=config, signing_key=pk)

    patient_ctx = ToolContext(
        storage=storage, capabilities=capabilities,
        mind_id=mind_id, namespace=shard, on_event=recorder,
    )
    doctor_ctx = ToolContext(
        storage=storage, capabilities=capabilities,
        mind_id=mind_id, namespace=shard, on_event=recorder,
    )

    patient = MemoryAgent(
        name="aria", persona=PATIENT_PERSONA,
        llm=ClaudeBackend(), tool_ctx=patient_ctx,
        allowed_tools=["remember", "recall", "share_with", "revoke"],
    )
    doctor = MemoryAgent(
        name="doctor", persona=DOCTOR_PERSONA,
        llm=SealedInferenceBackend(), tool_ctx=doctor_ctx,
        allowed_tools=["recall"],
    )

    # ── Scene 1 — Alice logs a workout ─────────────────────────────────
    frame("Aria · Alice's assistant (Claude)", C.GREEN)
    user_msg = "Just finished an 8 km run in 45 minutes — felt great, splits were even."
    speak("Alice", C.BOLD, user_msg)
    result = patient.chat(user_msg)
    line(C.GREEN, f"{C.BOLD}Aria:{C.RESET} {result.text}")
    end_frame(C.GREEN)
    time.sleep(0.4)

    # ── Scene 2 — Alice asks Aria to share with Dr. Chen ───────────────
    frame("Aria · Alice's assistant (Claude)", C.GREEN)
    user_msg = (
        f"Share my fitness data with Dr. Chen's clinical assistant for 30 days. "
        f"Their wallet is {doctor_addr}."
    )
    speak("Alice", C.BOLD, user_msg)
    result = patient.chat(user_msg)
    line(C.GREEN, f"{C.BOLD}Aria:{C.RESET} {result.text}")
    end_frame(C.GREEN)

    cap_token = recorder.last_capability_token
    storage_key = recorder.last_storage_key
    if not cap_token:
        print(f"{C.RED}DEMO ABORT: aria didn't issue a share_with tool call.{C.RESET}")
        return 1
    if not storage_key:
        print(f"{C.RED}DEMO ABORT: aria didn't remember anything to share.{C.RESET}")
        return 1
    doctor_ctx.capability_token = cap_token
    time.sleep(0.4)

    # ── Scene 3 — Dr. Chen reads under the on-chain capability ─────────
    frame("Dr. Chen's assistant (Qwen 2.5 7B in Intel TDX)", C.YELLOW)
    user_msg = (
        f"What's the patient's most recent running activity? "
        f"Alice's referral note included this fitness key: {storage_key}"
    )
    speak("Dr. Chen", C.BOLD, user_msg)
    result = doctor.chat(user_msg)
    line(C.YELLOW, f"{C.BOLD}Doctor's assistant:{C.RESET} {result.text}")
    if result.metadata.get("chatId"):
        line(C.GREY, f"{C.DIM}[tee]     chatId: {result.metadata['chatId']}{C.RESET}")
        line(C.GREY, f"{C.DIM}[tee]     attestationValid: {result.metadata.get('attestationValid')}  ·  enclave: {result.metadata.get('enclave')}{C.RESET}")
    end_frame(C.YELLOW)
    time.sleep(0.4)

    # ── Scene 4 — Alice revokes mid-session ───────────────────────────
    frame("Aria · Alice's assistant (Claude)", C.GREEN)
    user_msg = (
        f"Actually, revoke Dr. Chen's access. The capability token is {cap_token}."
    )
    speak("Alice", C.BOLD, user_msg)
    result = patient.chat(user_msg)
    line(C.GREEN, f"{C.BOLD}Aria:{C.RESET} {result.text}")
    end_frame(C.GREEN)
    time.sleep(0.4)

    # ── Scene 5 — Doctor tries again, gets denied on chain ────────────
    frame("Dr. Chen's assistant (Qwen 2.5 7B in Intel TDX)", C.YELLOW)
    user_msg = f"Has the patient logged any new activity since? Try fetching key {storage_key}."
    speak("Dr. Chen", C.BOLD, user_msg)
    result = doctor.chat(user_msg)
    line(C.YELLOW, f"{C.BOLD}Doctor's assistant:{C.RESET} {result.text}")
    end_frame(C.YELLOW)

    banner("Demo complete · every chain interaction above is real testnet", C.BOLD)
    print(f"  CapabilityRegistry: https://chainscan-galileo.0g.ai/address/0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66")
    print(f"  SealedMindNFT:      https://chainscan-galileo.0g.ai/address/0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

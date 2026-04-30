"""Verify the SealedInferenceClient talks to the live deployed gateway.

The gateway runs at https://sealedmind-backend-production.up.railway.app —
Qwen 2.5 7B inside Intel TDX + NVIDIA H100 in TEE mode.

This script:
  1. Hits /health (no auth)
  2. POSTs an arbitrary attestation hash to /v1/attestations/verify (no auth)
     — gateway responds with verify=false because the hash isn't in store,
     proving the verification endpoint is live.

For full retrieval-augmented inference (`recall`), the gateway needs a
SIWE bearer token + a Mind owned by (or shared with) the caller. The
shape of that flow is documented in the SealedInferenceClient.recall()
docstring — exercising it requires the SealedMind frontend's auth dance.

Run:
    python examples/verify_sealed_inference_live.py
"""
from __future__ import annotations

import asyncio
import sys

from evermemos_sealedmind.errors import SealedMindError
from evermemos_sealedmind.inference.sealed_client import SealedInferenceClient


async def main() -> int:
    client = SealedInferenceClient()
    print("=" * 60)
    print(f"Sealed Inference gateway: {client._base}")  # noqa: SLF001
    print("=" * 60)

    print("\n[1/2] Health check...")
    try:
        h = await client.health()
        print(f"      ✅ alive: {h}")
    except Exception as e:
        print(f"      ❌ unreachable: {e}", file=sys.stderr)
        await client.aclose()
        return 1

    print("\n[2/2] Attestation verify (no-auth probe)...")
    # Bogus hash — verify will respond with verified=false, proving the
    # endpoint is wired and our client speaks the right protocol.
    bogus = "0x0000000000000000000000000000000000000000"
    try:
        await client.verify_attestation(bogus)
        print(f"      ⚠ unexpected: gateway claimed bogus hash was verified")
    except SealedMindError as e:
        # Expected — gateway should say not verified
        print(f"      ✅ gateway responded as expected: {e}")

    await client.aclose()
    print()
    print("=" * 60)
    print("✅ SealedInferenceClient wires up to the live gateway.")
    print("   To exercise full TEE recall, run the SealedMind frontend")
    print("   auth dance to obtain a bearer token and pass it via")
    print("   SEALEDMIND_INFERENCE_API_KEY.")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

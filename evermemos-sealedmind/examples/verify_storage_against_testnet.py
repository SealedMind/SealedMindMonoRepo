"""Real upload/download against 0G testnet using the official zg_storage Python SDK.

This proves the same round-trip the Node sidecar earlier produced, but
purely from Python using the same SDK 0G Memory itself depends on.

Run:
    SEALEDMIND_PRIVATE_KEY=0x... \\
    python examples/verify_storage_against_testnet.py
"""
from __future__ import annotations

import os
import sys
import tempfile
import time
from pathlib import Path

from zg_storage import (
    DownloadOption,
    EvmClient,
    IndexerClient,
    IndexerDownloader,
    UploadOption,
)
from zg_storage.rpc import RpcError

from evermemos_sealedmind.crypto import derive_dek, open_envelope, seal

CHUNK = 256
HEADER = 4


def pad(b: bytes) -> bytes:
    total = HEADER + len(b)
    padded_len = -(-total // CHUNK) * CHUNK
    out = bytearray(padded_len)
    out[0] = (len(b) >> 24) & 0xFF
    out[1] = (len(b) >> 16) & 0xFF
    out[2] = (len(b) >> 8) & 0xFF
    out[3] = len(b) & 0xFF
    out[HEADER:HEADER + len(b)] = b
    return bytes(out)


def unpad(b: bytes) -> bytes:
    n = (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]
    return b[HEADER:HEADER + n]


def main() -> int:
    pk = os.environ.get("SEALEDMIND_PRIVATE_KEY")
    if not pk:
        print("set SEALEDMIND_PRIVATE_KEY=0x...", file=sys.stderr)
        return 2

    rpc = os.environ.get("ZEROG_RPC_URL", "https://evmrpc-testnet.0g.ai")
    indexer_url = os.environ.get(
        "ZEROG_INDEXER_URL", "https://indexer-storage-testnet-turbo.0g.ai"
    )
    flow = os.environ.get("ZEROG_FLOW_ADDRESS", "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296")

    plaintext = b"SealedMind privacy test " + os.urandom(32)
    dek = b"\x42" * 32
    namespace = "verify"
    aad = b"sealedmind-verify"

    envelope = seal(plaintext, dek, namespace, aad=aad)
    print(f"[1/4] envelope size={len(envelope.blob)} bytes")

    evm = EvmClient(rpc_url=rpc, private_key=pk)
    indexer = IndexerClient(indexer_url, evm_client=evm, flow_address=flow)

    with tempfile.TemporaryDirectory() as tmp:
        upload_path = Path(tmp) / "envelope.bin"
        # Pad to 256-byte chunk boundary (matches the SDK's segment alignment).
        upload_path.write_bytes(pad(envelope.blob))
        root_hash, tx_hash, tx_seq = indexer.upload(
            str(upload_path),
            tags=b"",
            option=UploadOption(skip_tx=False),
        )
        print(f"[2/4] uploaded to 0G testnet")
        print(f"      rootHash: {root_hash}")
        print(f"      txHash:   {tx_hash}")
        print(f"      txSeq:    {tx_seq}")

        download_path = Path(tmp) / "downloaded.bin"
        downloader = IndexerDownloader(indexer)
        # The indexer needs a few seconds to propagate the new file to its
        # node-locations RPC. Retry until it shows up or we time out.
        deadline = time.time() + 180
        backoff = 4
        last_err: Exception | None = None
        while time.time() < deadline:
            try:
                downloader.download(
                    root=root_hash,
                    target=str(download_path),
                    option=DownloadOption(with_proof=True),
                )
                last_err = None
                break
            except RpcError as exc:
                last_err = exc
                print(f"      indexer not ready ({exc}); retrying in {backoff}s")
                time.sleep(backoff)
                backoff = min(backoff * 2, 30)
        if last_err is not None:
            raise last_err
        downloaded = download_path.read_bytes()

    decrypted = open_envelope(unpad(downloaded), dek, aad=aad)
    print(f"[3/4] downloaded {len(downloaded)} bytes, decrypted {len(decrypted)} bytes")
    if decrypted != plaintext:
        print("FAIL: decrypted bytes do not match", file=sys.stderr)
        return 1
    print(f"[4/4] round-trip verified: original == decrypted ✓")
    print()
    print("SUCCESS: real upload + download + decrypt against 0G testnet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""SIWE (EIP-4361) verification using the `siwe` package.

We don't issue messages here — the frontend (or CLI) builds the SIWE message
and signs it. This module only verifies and extracts the canonical address.
"""
from __future__ import annotations

from dataclasses import dataclass

from eth_utils import to_checksum_address
from siwe import SiweMessage

from ..errors import SealedMindAuthError


@dataclass(frozen=True)
class VerifiedSiwe:
    address: str
    chain_id: int
    nonce: str
    issued_at: str
    raw_message: str
    signature: bytes


class SiweVerifier:
    def __init__(self, *, expected_domain: str, expected_chain_id: int | None = None) -> None:
        self._domain = expected_domain
        self._chain_id = expected_chain_id

    def verify(self, message: str, signature: str) -> VerifiedSiwe:
        try:
            siwe = SiweMessage.from_message(message=message)
        except Exception as exc:
            raise SealedMindAuthError(f"malformed SIWE message: {exc}") from exc

        if siwe.domain != self._domain:
            raise SealedMindAuthError(
                f"SIWE domain mismatch: expected {self._domain!r}, got {siwe.domain!r}"
            )
        if self._chain_id is not None and int(siwe.chain_id) != self._chain_id:
            raise SealedMindAuthError(
                f"SIWE chainId mismatch: expected {self._chain_id}, got {siwe.chain_id}"
            )

        try:
            siwe.verify(signature=signature)
        except Exception as exc:
            raise SealedMindAuthError(f"SIWE signature invalid: {exc}") from exc

        sig_bytes = bytes.fromhex(signature[2:] if signature.startswith("0x") else signature)
        return VerifiedSiwe(
            address=to_checksum_address(siwe.address),
            chain_id=int(siwe.chain_id),
            nonce=siwe.nonce,
            issued_at=str(siwe.issued_at),
            raw_message=message,
            signature=sig_bytes,
        )

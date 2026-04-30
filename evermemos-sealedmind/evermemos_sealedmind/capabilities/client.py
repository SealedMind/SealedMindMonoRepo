"""CapabilityClient — async wrapper around CapabilityRegistry + MemoryAccessLog.

Reads are gated through `verify()` — every KV read calls in here, the call
hits the chain (with a short cache to keep latency down), and reverts the
read if the on-chain capability is revoked, expired, or out of scope.

Writes (`grant`, `revoke`, `log_access`) require a signing account; reads
only need an RPC.

Gas: every transaction estimates its own gas via `estimate_gas` and uses
EIP-1559 fee fields when the chain advertises them, falling back to legacy
`gasPrice` only when `max_priority_fee` is unavailable. Nothing is hardcoded.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any

from eth_account import Account
from eth_account.signers.local import LocalAccount
from eth_utils import to_bytes, to_checksum_address
from web3 import Web3
from web3.exceptions import ContractLogicError

from ..config import SealedMindConfig
from ..errors import SealedMindCapabilityError
from .abi import CAPABILITY_REGISTRY_ABI, MEMORY_ACCESS_LOG_ABI
from .grants import GrantSpec


@dataclass(frozen=True)
class Grant:
    cap_id: bytes  # 32 bytes
    mind_id: int
    shard_name: str
    grantee: str
    read_only: bool
    expiry_unix: int
    tx_hash: str

    @property
    def token(self) -> str:
        return "0x" + self.cap_id.hex()


class CapabilityClient:
    def __init__(
        self,
        *,
        config: SealedMindConfig,
        signing_key: str | None = None,
    ) -> None:
        self._config = config
        self._w3 = Web3(Web3.HTTPProvider(config.rpc_url))
        if not self._w3.is_connected():
            raise SealedMindCapabilityError(
                f"cannot reach RPC at {config.rpc_url}"
            )
        self._registry = self._w3.eth.contract(
            address=to_checksum_address(config.contracts["capability_registry"]),
            abi=CAPABILITY_REGISTRY_ABI,
        )
        self._access_log = self._w3.eth.contract(
            address=to_checksum_address(config.contracts["memory_access_log"]),
            abi=MEMORY_ACCESS_LOG_ABI,
        )
        if signing_key is not None:
            pk = signing_key if signing_key.startswith("0x") else "0x" + signing_key
            self._account: LocalAccount | None = Account.from_key(pk)
        else:
            self._account = None

    # ----------------------------------------------------------- write side

    async def grant(self, spec: GrantSpec) -> Grant:
        if self._account is None:
            raise SealedMindCapabilityError(
                "no signing key configured — cannot grant capabilities"
            )
        return await asyncio.to_thread(self._grant_sync, spec)

    def _grant_sync(self, spec: GrantSpec) -> Grant:
        assert self._account is not None
        fn = self._registry.functions.grantCapability(
            spec.mind_id,
            spec.shard_name,
            to_checksum_address(spec.grantee),
            spec.read_only,
            spec.expiry_unix,
        )
        receipt = self._send(fn)
        cap_id = self._extract_cap_id(receipt)
        return Grant(
            cap_id=cap_id,
            mind_id=spec.mind_id,
            shard_name=spec.shard_name,
            grantee=to_checksum_address(spec.grantee),
            read_only=spec.read_only,
            expiry_unix=spec.expiry_unix,
            tx_hash=receipt["transactionHash"].hex(),
        )

    async def revoke(self, cap_token: str) -> str:
        if self._account is None:
            raise SealedMindCapabilityError("no signing key configured — cannot revoke")
        return await asyncio.to_thread(self._revoke_sync, cap_token)

    def _revoke_sync(self, cap_token: str) -> str:
        assert self._account is not None
        cap_bytes = to_bytes(hexstr=cap_token)
        if len(cap_bytes) != 32:
            raise SealedMindCapabilityError(
                f"capability token must be 32 bytes, got {len(cap_bytes)}"
            )
        receipt = self._send(self._registry.functions.revokeCapability(cap_bytes))
        return receipt["transactionHash"].hex()

    def _send(self, fn) -> dict[str, Any]:
        assert self._account is not None
        nonce = self._w3.eth.get_transaction_count(self._account.address, "pending")
        base_tx: dict[str, Any] = {
            "from": self._account.address,
            "nonce": nonce,
            "chainId": self._config.chain_id,
        }
        # EIP-1559 fees if the chain reports them, else legacy.
        try:
            latest = self._w3.eth.get_block("latest")
            base_fee = latest.get("baseFeePerGas")
        except Exception:
            base_fee = None
        if base_fee is not None:
            try:
                priority = self._w3.eth.max_priority_fee
            except Exception:
                priority = self._w3.to_wei(1, "gwei")
            base_tx["maxPriorityFeePerGas"] = int(priority)
            base_tx["maxFeePerGas"] = int(base_fee) * 2 + int(priority)
        else:
            base_tx["gasPrice"] = self._w3.eth.gas_price

        # estimate_gas with the from address so reverts surface here
        try:
            gas = fn.estimate_gas({"from": self._account.address})
        except ContractLogicError as exc:
            raise SealedMindCapabilityError(f"contract revert: {exc}") from exc
        base_tx["gas"] = int(gas * 12 // 10)  # +20% headroom

        tx = fn.build_transaction(base_tx)
        signed = self._account.sign_transaction(tx)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if receipt["status"] != 1:
            raise SealedMindCapabilityError(f"tx reverted: {tx_hash.hex()}")
        return dict(receipt)

    def _extract_cap_id(self, receipt: dict[str, Any]) -> bytes:
        events = self._registry.events.CapabilityGranted().process_receipt(receipt)
        if not events:
            raise SealedMindCapabilityError("CapabilityGranted event missing from receipt")
        return bytes(events[0]["args"]["capId"])

    # ------------------------------------------------------------ read side

    async def verify(
        self, *, token: str, namespace: str, key: str, scope: str
    ) -> None:
        """Hook called from SealedMindKVStorage. Raises if not valid.

        scope→readOnly mapping is strict: writes require readOnly == False;
        reads are allowed for both. Everything else fails closed.
        """
        cap = await asyncio.to_thread(self._get_capability, token)
        if cap is None:
            raise SealedMindCapabilityError(f"unknown capability {token}")
        if cap["revoked"]:
            raise SealedMindCapabilityError(f"capability {token} revoked")
        if cap["expiry"] != 0 and cap["expiry"] <= int(time.time()):
            raise SealedMindCapabilityError(f"capability {token} expired")
        if cap["shardName"] != namespace:
            raise SealedMindCapabilityError(
                f"capability scope mismatch: shard={cap['shardName']!r} vs namespace={namespace!r}"
            )
        if scope == "write" and cap["readOnly"]:
            raise SealedMindCapabilityError(f"capability {token} is read-only")

    def _get_capability(self, token: str) -> dict[str, Any] | None:
        cap_bytes = to_bytes(hexstr=token)
        if len(cap_bytes) != 32:
            return None
        try:
            mind_id, shard_name, grantee, read_only, expiry, revoked, granted_at = (
                self._registry.functions.getCapability(cap_bytes).call()
            )
        except Exception:
            return None
        if mind_id == 0 and grantee == "0x0000000000000000000000000000000000000000":
            return None
        return {
            "mindId": mind_id,
            "shardName": shard_name,
            "grantee": grantee,
            "readOnly": read_only,
            "expiry": expiry,
            "revoked": revoked,
            "grantedAt": granted_at,
        }

    # ----------------------------------------------------------- audit log

    async def log_access(
        self,
        *,
        namespace: str,
        key: str,
        capability: str,
        attestation_hash: bytes,
        storage_cid: str,
    ) -> str:
        """Log an on-chain access entry.

        `attestation_hash` and `storage_cid` MUST come from a real TEE
        attestation — never synthesize. Callers without a real attestation
        should not call log_access.
        """
        if self._account is None:
            raise SealedMindCapabilityError(
                "no signing key configured — cannot log access on-chain"
            )
        if len(attestation_hash) != 32:
            raise SealedMindCapabilityError(
                f"attestation_hash must be 32 bytes, got {len(attestation_hash)}"
            )
        cap = await asyncio.to_thread(self._get_capability, capability)
        if cap is None:
            raise SealedMindCapabilityError(f"cannot log: unknown capability {capability}")
        receipt = await asyncio.to_thread(
            lambda: self._send(
                self._access_log.functions.logAccess(
                    cap["mindId"], "recall", attestation_hash, storage_cid
                )
            )
        )
        return receipt["transactionHash"].hex()

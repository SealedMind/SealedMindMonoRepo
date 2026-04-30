"""Configuration loaded from environment, mirroring SealedMind defaults."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

Network = Literal["mainnet", "testnet"]

MAINNET_CHAIN_ID = 16661
TESTNET_CHAIN_ID = 16602

CONTRACTS: dict[Network, dict[str, str]] = {
    "mainnet": {
        "verifier": "0x6D5B3B81119F78366B767DB81C2dd6625d5648Af",
        "sealed_mind_nft": "0x091CfC4b9E6FF0026F384b8c4664B8C03Af21EA6",
        "capability_registry": "0xeb2F5C59A38F0f2339F5B399e4EDeF1FA834FA45",
        "memory_access_log": "0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad",
    },
    "testnet": {
        "verifier": "0xE4f3f96419c87675EEa6Cd55D689b0A8807D8AAd",
        "sealed_mind_nft": "0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7",
        "capability_registry": "0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66",
        "memory_access_log": "0xB085F48c98E8878ACA88460B37653cC8d2E24482",
    },
}

DEFAULT_RPC: dict[Network, str] = {
    "mainnet": "https://evmrpc.0g.ai",
    "testnet": "https://evmrpc-testnet.0g.ai",
}

DEFAULT_INDEXER: dict[Network, str] = {
    "mainnet": "https://indexer-storage.0g.ai",
    "testnet": "https://indexer-storage-testnet-turbo.0g.ai",
}


@dataclass(frozen=True)
class SealedMindConfig:
    network: Network
    rpc_url: str
    indexer_url: str
    chain_id: int
    contracts: dict[str, str]
    session_ttl_seconds: int
    capability_cache_ttl_seconds: int
    domain: str

    @classmethod
    def from_env(cls) -> "SealedMindConfig":
        network: Network = os.environ.get("SEALEDMIND_NETWORK", "testnet")  # type: ignore[assignment]
        if network not in CONTRACTS:
            raise ValueError(f"SEALEDMIND_NETWORK must be 'mainnet' or 'testnet', got {network!r}")

        return cls(
            network=network,
            rpc_url=os.environ.get("SEALEDMIND_RPC_URL", DEFAULT_RPC[network]),
            indexer_url=os.environ.get("SEALEDMIND_INDEXER_URL", DEFAULT_INDEXER[network]),
            chain_id=MAINNET_CHAIN_ID if network == "mainnet" else TESTNET_CHAIN_ID,
            contracts=CONTRACTS[network],
            session_ttl_seconds=int(os.environ.get("SEALEDMIND_SESSION_TTL", 24 * 3600)),
            capability_cache_ttl_seconds=int(os.environ.get("SEALEDMIND_CAP_CACHE_TTL", 60)),
            domain=os.environ.get("SEALEDMIND_DOMAIN", "sealedmind.local"),
        )

"""ABI fragments mirrored from contracts/CapabilityRegistry.sol and MemoryAccessLog.sol.

Pinned here so the addon does not need a network round-trip to fetch ABIs and
so the test suite can run against a local fork without the artifact tree.
"""
from __future__ import annotations

CAPABILITY_REGISTRY_ABI: list[dict] = [
    {
        "type": "function",
        "name": "grantCapability",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "mindId", "type": "uint256"},
            {"name": "shardName", "type": "string"},
            {"name": "grantee", "type": "address"},
            {"name": "readOnly", "type": "bool"},
            {"name": "expiry", "type": "uint256"},
        ],
        "outputs": [{"name": "capId", "type": "bytes32"}],
    },
    {
        "type": "function",
        "name": "revokeCapability",
        "stateMutability": "nonpayable",
        "inputs": [{"name": "capId", "type": "bytes32"}],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "verifyCapability",
        "stateMutability": "view",
        "inputs": [
            {"name": "capId", "type": "bytes32"},
            {"name": "caller", "type": "address"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "type": "function",
        "name": "getCapability",
        "stateMutability": "view",
        "inputs": [{"name": "capId", "type": "bytes32"}],
        "outputs": [
            {"name": "mindId", "type": "uint256"},
            {"name": "shardName", "type": "string"},
            {"name": "grantee", "type": "address"},
            {"name": "readOnly", "type": "bool"},
            {"name": "expiry", "type": "uint256"},
            {"name": "revoked", "type": "bool"},
            {"name": "grantedAt", "type": "uint256"},
        ],
    },
    {
        "type": "function",
        "name": "getCapabilities",
        "stateMutability": "view",
        "inputs": [{"name": "mindId", "type": "uint256"}],
        "outputs": [{"name": "", "type": "bytes32[]"}],
    },
    {
        "type": "event",
        "name": "CapabilityGranted",
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "capId", "type": "bytes32"},
            {"indexed": True, "name": "mindId", "type": "uint256"},
            {"indexed": False, "name": "shardName", "type": "string"},
            {"indexed": True, "name": "grantee", "type": "address"},
            {"indexed": False, "name": "readOnly", "type": "bool"},
            {"indexed": False, "name": "expiry", "type": "uint256"},
        ],
    },
]

MEMORY_ACCESS_LOG_ABI: list[dict] = [
    {
        "type": "function",
        "name": "logAccess",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "mindId", "type": "uint256"},
            {"name": "operation", "type": "string"},
            {"name": "attestationHash", "type": "bytes32"},
            {"name": "storageCID", "type": "string"},
        ],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "getAccessCount",
        "stateMutability": "view",
        "inputs": [{"name": "mindId", "type": "uint256"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

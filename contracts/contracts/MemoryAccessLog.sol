// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MemoryAccessLog
/// @notice Immutable on-chain audit trail of all memory operations.
///         Every write, recall, or share is logged with a TEE attestation hash.
contract MemoryAccessLog {

    struct AccessEntry {
        uint256 mindId;
        address accessor;
        string operation;           // "write" | "recall" | "share"
        bytes32 attestationHash;    // hash of the TEE attestation blob
        string storageCID;          // 0G Storage CID of the full attestation
        uint256 timestamp;
    }

    mapping(uint256 => AccessEntry[]) private _logs;

    event MemoryAccessed(
        uint256 indexed mindId,
        address indexed accessor,
        string operation,
        bytes32 attestationHash
    );

    /// @notice Log a memory operation. Called by the SealedMind backend after TEE processing.
    function logAccess(
        uint256 mindId,
        string calldata operation,
        bytes32 attestationHash,
        string calldata storageCID
    ) external {
        _logs[mindId].push(AccessEntry({
            mindId: mindId,
            accessor: msg.sender,
            operation: operation,
            attestationHash: attestationHash,
            storageCID: storageCID,
            timestamp: block.timestamp
        }));
        emit MemoryAccessed(mindId, msg.sender, operation, attestationHash);
    }

    /// @notice Total number of access entries for a Mind.
    function getAccessCount(uint256 mindId) external view returns (uint256) {
        return _logs[mindId].length;
    }

    /// @notice Paginated access log retrieval.
    function getAccessLog(
        uint256 mindId,
        uint256 offset,
        uint256 limit
    ) external view returns (AccessEntry[] memory) {
        AccessEntry[] storage log = _logs[mindId];
        uint256 end = offset + limit > log.length ? log.length : offset + limit;
        if (offset >= log.length) {
            return new AccessEntry[](0);
        }
        AccessEntry[] memory result = new AccessEntry[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = log[i];
        }
        return result;
    }

    /// @notice Get a single access entry by index.
    function getAccessEntry(uint256 mindId, uint256 index) external view returns (AccessEntry memory) {
        require(index < _logs[mindId].length, "Index out of bounds");
        return _logs[mindId][index];
    }
}

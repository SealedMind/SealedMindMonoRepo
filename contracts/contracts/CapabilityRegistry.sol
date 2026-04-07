// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SealedMindNFT} from "./SealedMindNFT.sol";

/// @title CapabilityRegistry
/// @notice On-chain capability tokens for shard-level memory sharing.
///         Mind owners grant/revoke capabilities to agents for specific shards.
contract CapabilityRegistry {

    struct Capability {
        uint256 mindId;
        string shardName;
        address grantee;        // agent wallet / Agent ID
        bool readOnly;
        uint256 expiry;         // 0 = no expiry
        bool revoked;
        uint256 grantedAt;
    }

    SealedMindNFT public immutable mindNFT;

    mapping(bytes32 => Capability) public capabilities;
    mapping(uint256 => bytes32[]) public mindCapabilities;  // mindId → capIds

    event CapabilityGranted(
        bytes32 indexed capId,
        uint256 indexed mindId,
        string shardName,
        address indexed grantee,
        bool readOnly,
        uint256 expiry
    );
    event CapabilityRevoked(bytes32 indexed capId);

    constructor(address mindNFTAddr) {
        require(mindNFTAddr != address(0), "Zero address");
        mindNFT = SealedMindNFT(mindNFTAddr);
    }

    /// @notice Grant a capability token for a specific shard to a grantee.
    function grantCapability(
        uint256 mindId,
        string calldata shardName,
        address grantee,
        bool readOnly,
        uint256 expiry
    ) external returns (bytes32 capId) {
        require(mindNFT.ownerOf(mindId) == msg.sender, "Not mind owner");
        require(grantee != address(0), "Zero grantee");

        capId = keccak256(abi.encodePacked(mindId, shardName, grantee, block.timestamp, block.prevrandao));

        capabilities[capId] = Capability({
            mindId: mindId,
            shardName: shardName,
            grantee: grantee,
            readOnly: readOnly,
            expiry: expiry,
            revoked: false,
            grantedAt: block.timestamp
        });

        mindCapabilities[mindId].push(capId);

        emit CapabilityGranted(capId, mindId, shardName, grantee, readOnly, expiry);
        return capId;
    }

    /// @notice Revoke a capability. Only the Mind owner can revoke.
    function revokeCapability(bytes32 capId) external {
        Capability storage cap = capabilities[capId];
        require(mindNFT.ownerOf(cap.mindId) == msg.sender, "Not mind owner");
        require(!cap.revoked, "Already revoked");
        cap.revoked = true;
        emit CapabilityRevoked(capId);
    }

    /// @notice Check whether a capability is currently valid for a caller.
    function verifyCapability(bytes32 capId, address caller) external view returns (bool) {
        Capability storage cap = capabilities[capId];
        if (cap.revoked) return false;
        if (cap.grantee != caller) return false;
        if (cap.expiry != 0 && cap.expiry <= block.timestamp) return false;
        return true;
    }

    /// @notice Get all capability IDs for a Mind.
    function getCapabilities(uint256 mindId) external view returns (bytes32[] memory) {
        return mindCapabilities[mindId];
    }

    /// @notice Get details of a single capability.
    function getCapability(bytes32 capId) external view returns (
        uint256 mindId,
        string memory shardName,
        address grantee,
        bool readOnly,
        uint256 expiry,
        bool revoked,
        uint256 grantedAt
    ) {
        Capability storage cap = capabilities[capId];
        return (cap.mindId, cap.shardName, cap.grantee, cap.readOnly, cap.expiry, cap.revoked, cap.grantedAt);
    }
}

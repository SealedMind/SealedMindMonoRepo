// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC7857} from "./lib/erc7857/interfaces/IERC7857.sol";
import {IERC7857Metadata} from "./lib/erc7857/interfaces/IERC7857Metadata.sol";
import {IERC7857DataVerifier, PreimageProofOutput, TransferValidityProofOutput} from "./lib/erc7857/interfaces/IERC7857DataVerifier.sol";

/// @title SealedMindNFT
/// @notice ERC-7857 iNFT representing an AI agent's encrypted memory ("Mind").
///         Each Mind stores encrypted memories on 0G Storage, processed inside TEE.
///         Transfer re-encrypts all data for the new owner via TEE oracle.
contract SealedMindNFT is IERC7857, IERC7857Metadata {

    // ──────────────────────────── Storage ────────────────────────────

    struct MindData {
        address owner;
        bytes32[] dataHashes;           // ERC-7857: hashes of encrypted data blobs
        string[] dataDescriptions;      // ERC-7857: descriptions per data slot
        address[] authorizedUsers;      // ERC-7857: users authorized to use this Mind
        address approvedUser;           // single-address approval (like ERC-721 approve)
        // ── SealedMind extensions ──
        string storageCID;              // 0G Storage root CID for encrypted metadata
        uint256 memoryCount;            // total memories stored
        uint256 createdAt;
        uint256 lastAccessedAt;
        string[] shards;                // named memory shards ("health", "finance", etc.)
    }

    IERC7857DataVerifier private _verifier;
    mapping(uint256 => MindData) private _minds;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    uint256 private _nextTokenId;

    string private _name;
    string private _symbol;

    // ──────────────────────────── SealedMind Events ─────────────────
    event MindCreated(uint256 indexed tokenId, address indexed owner, string storageCID);
    event MindUpdated(uint256 indexed tokenId, uint256 memoryCount, string storageCID);
    event ShardCreated(uint256 indexed tokenId, string shardName);

    // ──────────────────────────── Constructor ────────────────────────

    constructor(
        string memory name_,
        string memory symbol_,
        address verifierAddr
    ) {
        require(verifierAddr != address(0), "Zero verifier");
        _name = name_;
        _symbol = symbol_;
        _verifier = IERC7857DataVerifier(verifierAddr);
    }

    // ──────────────────────── IERC7857 Core ─────────────────────────

    function verifier() external view override returns (IERC7857DataVerifier) {
        return _verifier;
    }

    /// @notice Mint a new Mind iNFT.
    /// @param _proofs  TEE attestation proofs (verified by the Verifier contract)
    /// @param _dataDescriptions  Human-readable descriptions for each data slot
    /// @param _to  Owner address (address(0) defaults to msg.sender)
    function mint(
        bytes[] calldata _proofs,
        string[] calldata _dataDescriptions,
        address _to
    ) external payable override returns (uint256 _tokenId) {
        require(_dataDescriptions.length == _proofs.length, "Length mismatch");
        if (_to == address(0)) _to = msg.sender;

        // Verify proofs via the Verifier
        PreimageProofOutput[] memory outputs = _verifier.verifyPreimage(_proofs);
        bytes32[] memory dataHashes = new bytes32[](outputs.length);
        for (uint256 i = 0; i < outputs.length; i++) {
            require(outputs[i].isValid, "Invalid proof");
            dataHashes[i] = outputs[i].dataHash;
        }

        _tokenId = _nextTokenId++;
        MindData storage m = _minds[_tokenId];
        m.owner = _to;
        m.dataHashes = dataHashes;
        m.dataDescriptions = _dataDescriptions;
        m.createdAt = block.timestamp;
        m.lastAccessedAt = block.timestamp;

        emit Minted(_tokenId, msg.sender, _to, dataHashes, _dataDescriptions);
        return _tokenId;
    }

    /// @notice Convenience wrapper: mint + set SealedMind-specific fields in one tx.
    function mintMind(
        bytes[] calldata _proofs,
        string[] calldata _dataDescriptions,
        address _to,
        string calldata storageCID
    ) external payable returns (uint256 _tokenId) {
        if (_to == address(0)) _to = msg.sender;
        require(_dataDescriptions.length == _proofs.length, "Length mismatch");

        PreimageProofOutput[] memory outputs = _verifier.verifyPreimage(_proofs);
        bytes32[] memory dataHashes = new bytes32[](outputs.length);
        for (uint256 i = 0; i < outputs.length; i++) {
            require(outputs[i].isValid, "Invalid proof");
            dataHashes[i] = outputs[i].dataHash;
        }

        _tokenId = _nextTokenId++;
        MindData storage m = _minds[_tokenId];
        m.owner = _to;
        m.dataHashes = dataHashes;
        m.dataDescriptions = _dataDescriptions;
        m.storageCID = storageCID;
        m.createdAt = block.timestamp;
        m.lastAccessedAt = block.timestamp;

        emit Minted(_tokenId, msg.sender, _to, dataHashes, _dataDescriptions);
        emit MindCreated(_tokenId, _to, storageCID);
        return _tokenId;
    }

    function transfer(
        address _to,
        uint256 _tokenId,
        bytes[] calldata _proofs
    ) external override {
        MindData storage m = _minds[_tokenId];
        require(m.owner == msg.sender, "Not owner");
        require(_to != address(0), "Zero address");

        TransferValidityProofOutput[] memory outputs = _verifier.verifyTransferValidity(_proofs);
        bytes16[] memory sealedKeys = new bytes16[](outputs.length);
        bytes32[] memory newHashes = new bytes32[](outputs.length);

        for (uint256 i = 0; i < outputs.length; i++) {
            require(
                outputs[i].isValid &&
                outputs[i].oldDataHash == m.dataHashes[i] &&
                outputs[i].receiver == _to,
                "Invalid transfer proof"
            );
            sealedKeys[i] = outputs[i].sealedKey;
            newHashes[i] = outputs[i].newDataHash;
        }

        m.owner = _to;
        m.dataHashes = newHashes;
        m.lastAccessedAt = block.timestamp;

        emit Transferred(_tokenId, msg.sender, _to);
        emit PublishedSealedKey(_to, _tokenId, sealedKeys);
    }

    function clone(
        address _to,
        uint256 _tokenId,
        bytes[] calldata _proofs
    ) external override returns (uint256 _newTokenId) {
        MindData storage m = _minds[_tokenId];
        require(m.owner == msg.sender, "Not owner");
        require(_to != address(0), "Zero address");

        TransferValidityProofOutput[] memory outputs = _verifier.verifyTransferValidity(_proofs);
        bytes32[] memory newHashes = new bytes32[](outputs.length);
        bytes16[] memory sealedKeys = new bytes16[](outputs.length);

        for (uint256 i = 0; i < outputs.length; i++) {
            require(
                outputs[i].isValid &&
                outputs[i].oldDataHash == m.dataHashes[i] &&
                outputs[i].receiver == _to,
                "Invalid clone proof"
            );
            sealedKeys[i] = outputs[i].sealedKey;
            newHashes[i] = outputs[i].newDataHash;
        }

        _newTokenId = _nextTokenId++;
        MindData storage c = _minds[_newTokenId];
        c.owner = _to;
        c.dataHashes = newHashes;
        c.dataDescriptions = m.dataDescriptions;
        c.createdAt = block.timestamp;
        c.lastAccessedAt = block.timestamp;

        emit Cloned(_tokenId, _newTokenId, msg.sender, _to);
        emit PublishedSealedKey(_to, _newTokenId, sealedKeys);
        return _newTokenId;
    }

    function authorizeUsage(uint256 _tokenId, address _user) external override {
        require(_minds[_tokenId].owner == msg.sender, "Not owner");
        _minds[_tokenId].authorizedUsers.push(_user);
        emit Authorization(msg.sender, _user, _tokenId);
    }

    function ownerOf(uint256 _tokenId) external view override returns (address) {
        address o = _minds[_tokenId].owner;
        require(o != address(0), "Token not exist");
        return o;
    }

    function authorizedUsersOf(uint256 _tokenId) external view override returns (address[] memory) {
        require(_minds[_tokenId].owner != address(0), "Token not exist");
        return _minds[_tokenId].authorizedUsers;
    }

    // ──────────────────────── IERC7857Metadata ──────────────────────

    function name() external view override returns (string memory) { return _name; }
    function symbol() external view override returns (string memory) { return _symbol; }

    function tokenURI(uint256 _tokenId) external view override returns (string memory) {
        require(_minds[_tokenId].owner != address(0), "Token not exist");
        return _minds[_tokenId].storageCID;
    }

    function update(uint256 _tokenId, bytes[] calldata _proofs) external override {
        MindData storage m = _minds[_tokenId];
        require(m.owner == msg.sender, "Not owner");

        PreimageProofOutput[] memory outputs = _verifier.verifyPreimage(_proofs);
        bytes32[] memory oldHashes = m.dataHashes;
        bytes32[] memory newHashes = new bytes32[](outputs.length);
        for (uint256 i = 0; i < outputs.length; i++) {
            require(outputs[i].isValid, "Invalid proof");
            newHashes[i] = outputs[i].dataHash;
        }
        m.dataHashes = newHashes;
        m.lastAccessedAt = block.timestamp;

        emit Updated(_tokenId, oldHashes, newHashes);
    }

    function dataHashesOf(uint256 _tokenId) external view override returns (bytes32[] memory) {
        require(_minds[_tokenId].owner != address(0), "Token not exist");
        return _minds[_tokenId].dataHashes;
    }

    function dataDescriptionsOf(uint256 _tokenId) external view override returns (string[] memory) {
        require(_minds[_tokenId].owner != address(0), "Token not exist");
        return _minds[_tokenId].dataDescriptions;
    }

    // ──────────────────── Approval (ERC-721-like) ───────────────────

    function approve(address _to, uint256 _tokenId) external {
        require(_minds[_tokenId].owner == msg.sender, "Not owner");
        _minds[_tokenId].approvedUser = _to;
    }

    function setApprovalForAll(address _operator, bool _approved) external {
        _operatorApprovals[msg.sender][_operator] = _approved;
    }

    function getApproved(uint256 _tokenId) external view returns (address) {
        return _minds[_tokenId].approvedUser;
    }

    function isApprovedForAll(address _owner, address _operator) external view returns (bool) {
        return _operatorApprovals[_owner][_operator];
    }

    // ──────────────────── SealedMind Extensions ─────────────────────

    /// @notice Create a named memory shard for selective sharing.
    function createShard(uint256 _tokenId, string calldata shardName) external {
        require(_minds[_tokenId].owner == msg.sender, "Not owner");
        _minds[_tokenId].shards.push(shardName);
        emit ShardCreated(_tokenId, shardName);
    }

    /// @notice Update memory count and storage CID after TEE memory operations.
    function updateMindState(
        uint256 _tokenId,
        uint256 newMemoryCount,
        string calldata newStorageCID
    ) external {
        MindData storage m = _minds[_tokenId];
        require(m.owner == msg.sender, "Not owner");
        m.memoryCount = newMemoryCount;
        m.storageCID = newStorageCID;
        m.lastAccessedAt = block.timestamp;
        emit MindUpdated(_tokenId, newMemoryCount, newStorageCID);
    }

    // ──────────────────── View Helpers ───────────────────────────────

    function getMindInfo(uint256 _tokenId) external view returns (
        address owner,
        string memory storageCID,
        uint256 memoryCount,
        uint256 createdAt,
        uint256 lastAccessedAt,
        string[] memory shards
    ) {
        MindData storage m = _minds[_tokenId];
        require(m.owner != address(0), "Token not exist");
        return (m.owner, m.storageCID, m.memoryCount, m.createdAt, m.lastAccessedAt, m.shards);
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }
}

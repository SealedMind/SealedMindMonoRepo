"""Mint a SealedMindNFT on 0G testnet so we can run the capability tests.

Usage:
    SEALEDMIND_PRIVATE_KEY=0x...funded... \\
    python examples/mint_testnet_mind.py
"""
from __future__ import annotations

import os
import sys

from eth_account import Account
from eth_utils import to_checksum_address
from web3 import Web3

NFT_ABI = [
    {
        "type": "function",
        "name": "mint",
        "stateMutability": "payable",
        "inputs": [
            {"name": "_proofs", "type": "bytes[]"},
            {"name": "_dataDescriptions", "type": "string[]"},
            {"name": "_to", "type": "address"},
        ],
        "outputs": [{"name": "_tokenId", "type": "uint256"}],
    },
    {
        "type": "event",
        "name": "Minted",
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "_tokenId", "type": "uint256"},
            {"indexed": True, "name": "_creator", "type": "address"},
            {"indexed": True, "name": "_owner", "type": "address"},
            {"indexed": False, "name": "_dataHashes", "type": "bytes32[]"},
            {"indexed": False, "name": "_dataDescriptions", "type": "string[]"},
        ],
    },
]


def main() -> int:
    pk = os.environ.get("SEALEDMIND_PRIVATE_KEY")
    if not pk:
        print("set SEALEDMIND_PRIVATE_KEY=0x...", file=sys.stderr)
        return 2
    pk = pk if pk.startswith("0x") else "0x" + pk
    account = Account.from_key(pk)

    rpc = os.environ.get("ZEROG_RPC_URL", "https://evmrpc-testnet.0g.ai")
    nft_addr = to_checksum_address("0x741BbE3B2d19E1aE965467280Cc2a442F3632Ee7")  # testnet

    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        print(f"cannot reach RPC {rpc}", file=sys.stderr)
        return 1
    nft = w3.eth.contract(address=nft_addr, abi=NFT_ABI)

    # Verifier expects each proof to be exactly 32 bytes = the data hash.
    proof = Web3.keccak(text="evermemos-sealedmind-itest")
    description = "evermemos-sealedmind integration test mind"

    fn = nft.functions.mint([proof], [description], account.address)
    nonce = w3.eth.get_transaction_count(account.address, "pending")
    base_fee = w3.eth.get_block("latest").get("baseFeePerGas")
    try:
        priority = w3.eth.max_priority_fee
    except Exception:
        priority = w3.to_wei(1, "gwei")

    tx = fn.build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": 16602,
        "gas": int(fn.estimate_gas({"from": account.address}) * 12 // 10),
        "maxPriorityFeePerGas": int(priority),
        "maxFeePerGas": int(base_fee) * 2 + int(priority) if base_fee else None,
    })
    if tx.get("maxFeePerGas") is None:
        tx["gasPrice"] = w3.eth.gas_price
        tx.pop("maxFeePerGas", None)
        tx.pop("maxPriorityFeePerGas", None)

    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"mint tx: {tx_hash.hex()}")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    if receipt["status"] != 1:
        print(f"mint reverted", file=sys.stderr)
        return 1

    events = nft.events.Minted().process_receipt(receipt)
    if not events:
        print("Minted event missing", file=sys.stderr)
        return 1
    token_id = events[0]["args"]["_tokenId"]
    print(f"minted tokenId: {token_id}")
    print(f"owner:          {events[0]['args']['_owner']}")
    print(f"explorer:       https://chainscan-galileo.0g.ai/tx/{tx_hash.hex()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import { ethers } from "ethers";

/**
 * Async wrapper around the on-chain MemoryAccessLog contract.
 *
 * Every memory operation (remember / recall / chat) emits an immutable
 * on-chain log entry so users can independently audit access:
 *   MemoryAccessLog.logAccess(mindId, operation, attestationHash, storageCID)
 *
 * Calls are fire-and-forget from the route handlers — the response is
 * returned immediately, the chain write happens in the background.
 * If/when the tx lands, we patch the in-memory attestation record so
 * /v1/attestations/verify can return the tx hash + chainscan link.
 *
 * Failure modes are non-fatal: if the operator wallet runs out of 0G or
 * the RPC is down, the in-memory attestation still gets recorded; only
 * the on-chain proof is missing.
 */

const MEMORY_ACCESS_LOG_ABI = [
  "function logAccess(uint256 mindId, string operation, bytes32 attestationHash, string storageCID) external",
];

const ADDRESSES: Record<string, string> = {
  // mainnet (16661)
  mainnet: "0xec9321C66aD8D73FB8f8D80736e1b6C47570c5Ad",
  // testnet (16602)
  testnet: "0xB085F48c98E8878ACA88460B37653cC8d2E24482",
};

export interface MemoryAccessLogConfig {
  rpcUrl: string;
  privateKey: string;
  /** "mainnet" | "testnet" — auto-detected from rpcUrl if absent */
  network?: "mainnet" | "testnet";
  /** Override the contract address explicitly. */
  contractAddress?: string;
}

export class MemoryAccessLogService {
  private contract: ethers.Contract;
  private wallet: ethers.Wallet;
  private network: "mainnet" | "testnet";

  constructor(cfg: MemoryAccessLogConfig) {
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const pk = cfg.privateKey.startsWith("0x") ? cfg.privateKey : `0x${cfg.privateKey}`;
    this.wallet = new ethers.Wallet(pk, provider);

    this.network = cfg.network
      ?? (cfg.rpcUrl.includes("testnet") || cfg.rpcUrl.includes("galileo") ? "testnet" : "mainnet");

    const addr = cfg.contractAddress ?? ADDRESSES[this.network];
    if (!addr) throw new Error(`No MemoryAccessLog address known for network ${this.network}`);
    this.contract = new ethers.Contract(addr, MEMORY_ACCESS_LOG_ABI, this.wallet);
  }

  /** chainscan base URL for this network. */
  get explorerBase(): string {
    return this.network === "mainnet"
      ? "https://chainscan.0g.ai"
      : "https://chainscan-galileo.0g.ai";
  }

  get contractAddress(): string {
    return this.contract.target as string;
  }

  /**
   * Convert a chatId (typically a UUID) into a 32-byte hash suitable for the
   * `bytes32 attestationHash` parameter. Deterministic + collision-resistant.
   */
  static hashChatId(chatId: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(chatId));
  }

  /**
   * Fire-and-forget on-chain log. Returns a Promise that resolves with the
   * tx hash (when the tx is sent, not when mined). On error, the promise
   * resolves with null — never throws upstream.
   *
   * Pattern from the caller side:
   *   const txPromise = memoryAccessLog.logAccess(...);
   *   res.json({...});  // respond immediately
   *   txPromise.then(hash => updateAttestationRecord(chatId, hash));
   */
  async logAccess(args: {
    mindIdNumeric: bigint | number;
    operation: "remember" | "recall" | "chat";
    chatId: string;
    storageCID?: string;
  }): Promise<string | null> {
    try {
      const attestationHash = MemoryAccessLogService.hashChatId(args.chatId);
      const tx = await this.contract.logAccess(
        BigInt(args.mindIdNumeric),
        args.operation,
        attestationHash,
        args.storageCID ?? "",
      );
      return tx.hash as string;
    } catch (err) {
      // Soft-fail — log to stderr so operators can see, but don't propagate
      console.warn(
        "[MemoryAccessLog] logAccess failed:",
        (err as Error)?.message ?? err,
      );
      return null;
    }
  }

  /**
   * Compute the chainscan URL for a tx hash.
   */
  explorerTxUrl(txHash: string): string {
    return `${this.explorerBase}/tx/${txHash.startsWith("0x") ? txHash : "0x" + txHash}`;
  }
}

/**
 * Convert a wallet-address-style mindId (lowercased 0x...) into a uint256
 * that the contract can accept. We just take the address as a number.
 * For numeric token-id minds this is a no-op.
 */
export function mindIdToUint(mindId: string): bigint {
  if (/^\d+$/.test(mindId)) return BigInt(mindId);
  if (mindId.startsWith("0x")) return BigInt(mindId);
  // Hash-based fallback for non-address ids (test wallets, operators)
  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(mindId)));
}

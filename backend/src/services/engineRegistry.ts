import crypto from "node:crypto";
import path from "node:path";
import { MemoryEngine, type MemoryEngineConfig } from "./memoryEngine.js";

type BaseConfig = Omit<MemoryEngineConfig, "dataDir" | "encryptionKey">;

/**
 * EngineRegistry — one isolated MemoryEngine per wallet address.
 *
 * Encryption key is derived deterministically from the wallet address using
 * HMAC-SHA256(KEY_DERIVATION_SECRET, address). The key is never written to disk.
 * On restart, the same address → same key → memories are decryptable.
 */
export class EngineRegistry {
  private engines = new Map<string, MemoryEngine>();
  private baseConfig: BaseConfig;
  private derivationSecret: string;
  private baseDataDir: string;

  constructor(baseConfig: BaseConfig, derivationSecret: string, baseDataDir = "data") {
    this.baseConfig = baseConfig;
    this.derivationSecret = derivationSecret;
    this.baseDataDir = path.resolve(baseDataDir);
  }

  /** Get or create an engine for a given wallet address. */
  async getOrCreate(address: string): Promise<MemoryEngine> {
    const addr = address.toLowerCase();
    if (!this.engines.has(addr)) {
      const engine = new MemoryEngine({
        ...this.baseConfig,
        dataDir: path.join(this.baseDataDir, addr),
        encryptionKey: this.deriveKey(addr),
      });
      await engine.init();
      this.engines.set(addr, engine);
    }
    return this.engines.get(addr)!;
  }

  /** Derive a deterministic 32-byte AES key for a given address. */
  private deriveKey(address: string): Buffer {
    return crypto
      .createHmac("sha256", this.derivationSecret)
      .update(address)
      .digest();
  }
}

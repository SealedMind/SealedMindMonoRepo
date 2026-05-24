import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { MemoryEngine, type MemoryEngineConfig } from "./memoryEngine.js";
import {
  createKeyring,
  loadKeyring,
  hasKeyring,
  rewrapForNewOwner,
  unwrapCK,
  detectVersion,
} from "./keyring.js";

type BaseConfig = Omit<MemoryEngineConfig, "dataDir" | "encryptionKey" | "encVersion">;

/**
 * EngineRegistry — one isolated MemoryEngine per wallet address.
 *
 * Two encryption paths coexist:
 *   v1 (legacy): blobs encrypted directly with userKey = HMAC(secret, address).
 *                Used for every Mind that does NOT have a keyring file on
 *                disk. Frozen + pinned by test/crypto.v1regression.test.ts.
 *
 *   v2 (envelope): each Mind owns a Content Key (CK), random 32B, persisted
 *                  wrapped under userKey in `data/<address>/mind-keyring.json`.
 *                  Blobs are encrypted with CK. Transfer = re-wrap CK under
 *                  the new owner's userKey. Blobs are never re-uploaded.
 *
 * `userKey` is derived deterministically from the address — never on disk,
 * identical across restarts for the same address.
 *
 * For new Minds, the registry defaults to v2 (overridable via
 * `MIND_ENC_VERSION=1` to disable v2 in production). Existing v1 Minds keep
 * resolving to v1 forever.
 */
export class EngineRegistry {
  private engines = new Map<string, MemoryEngine>();
  private baseConfig: BaseConfig;
  private derivationSecret: string;
  private baseDataDir: string;
  /** Default version for newly-created Minds. Existing Minds always resolve to their on-disk version. */
  private defaultNewMindVersion: 1 | 2;

  constructor(baseConfig: BaseConfig, derivationSecret: string, baseDataDir = "data") {
    this.baseConfig = baseConfig;
    this.derivationSecret = derivationSecret;
    this.baseDataDir = path.resolve(baseDataDir);
    this.defaultNewMindVersion =
      process.env.MIND_ENC_VERSION === "1" ? 1 : 2;
  }

  /** Get or create an engine for a given wallet address. */
  async getOrCreate(address: string): Promise<MemoryEngine> {
    const addr = address.toLowerCase();
    if (this.engines.has(addr)) return this.engines.get(addr)!;

    const dataDir = path.join(this.baseDataDir, addr);
    fs.mkdirSync(dataDir, { recursive: true });
    const userKEK = this.deriveKey(addr);

    let encVersion: 1 | 2;
    let blobKey: Buffer;

    if (hasKeyring(dataDir)) {
      // Existing v2 Mind — unwrap the persisted CK.
      const kr = loadKeyring(dataDir)!;
      blobKey = unwrapCK(kr, userKEK);
      encVersion = 2;
    } else if (this.isLegacyV1OnDisk(dataDir)) {
      // Existing v1 Mind — keep using userKey as the blob key.
      blobKey = userKEK;
      encVersion = 1;
    } else {
      // Brand-new Mind — default to the configured version.
      if (this.defaultNewMindVersion === 2) {
        const { ck } = createKeyring(dataDir, addr, userKEK);
        blobKey = ck;
        encVersion = 2;
      } else {
        blobKey = userKEK;
        encVersion = 1;
      }
    }

    // Diagnostic — surfaces in Railway logs on every Mind load.
    console.log(
      `[engine] Mind ${addr.slice(0, 10)}…  v=${encVersion}  ` +
      `${encVersion === 2 ? "(keyring loaded)" : "(legacy direct-key)"}`,
    );

    const engine = new MemoryEngine({
      ...this.baseConfig,
      dataDir,
      encryptionKey: blobKey,
      encVersion,
    });
    await engine.init();
    this.engines.set(addr, engine);
    return engine;
  }

  /** Diagnostic — resolves the version for an address without booting the engine. */
  versionOf(address: string): 1 | 2 {
    const dataDir = path.join(this.baseDataDir, address.toLowerCase());
    return detectVersion(dataDir);
  }

  /**
   * Transfer a Mind from `fromOwner` to `toOwner`:
   *   1. Lazy v1 → v2 if needed (create CK so the transferred state is v2).
   *   2. Re-wrap the keyring's CK from fromKEK → toKEK.
   *   3. Rename data dir from <from> → <to>.
   *   4. Drop both engines from the in-process cache.
   *
   * The caller is responsible for proving the on-chain transfer happened
   * (ERC-7857 `ownerOf(tokenId) == toOwner`) before invoking this.
   */
  async rekeyForTransfer(fromOwner: string, toOwner: string): Promise<{
    fromDir: string;
    toDir: string;
    encVersion: 2;
  }> {
    const from = fromOwner.toLowerCase();
    const to = toOwner.toLowerCase();
    if (from === to) throw new Error("from == to: refusing no-op transfer");

    const fromDir = path.join(this.baseDataDir, from);
    const toDir = path.join(this.baseDataDir, to);
    if (!fs.existsSync(fromDir)) throw new Error(`No Mind data at ${fromDir}`);
    if (fs.existsSync(toDir)) {
      throw new Error(`Destination data dir already exists: ${toDir}`);
    }

    const fromKEK = this.deriveKey(from);
    const toKEK = this.deriveKey(to);

    if (!hasKeyring(fromDir)) {
      // Lazy v1 → v2 upgrade. Existing v1 blobs remain decryptable by
      // userKey; this keyring exists for the post-transfer chain of custody.
      // A future deep-migration tool can re-encrypt v1 blobs under CK on
      // explicit user request.
      createKeyring(fromDir, from, fromKEK);
    }

    rewrapForNewOwner(fromDir, to, fromKEK, toKEK);

    // Atomic dir rename (same filesystem) — keyring + records + index all
    // move together.
    fs.renameSync(fromDir, toDir);

    this.engines.delete(from);
    this.engines.delete(to);

    return { fromDir, toDir, encVersion: 2 };
  }

  /** Derive a deterministic 32-byte AES key for a given address. */
  private deriveKey(address: string): Buffer {
    return crypto
      .createHmac("sha256", this.derivationSecret)
      .update(address.toLowerCase())
      .digest();
  }

  /** A v1 Mind on disk: has records but no keyring. */
  private isLegacyV1OnDisk(dataDir: string): boolean {
    if (!fs.existsSync(dataDir)) return false;
    const recordsPath = path.join(dataDir, "sealedmind-records.json");
    return fs.existsSync(recordsPath);
  }
}

import { Indexer, MemData, ZgFile } from "@0gfoundation/0g-ts-sdk";
import { Wallet, JsonRpcProvider } from "ethers";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encrypt, decrypt, type EncryptedBlob } from "./crypto.js";

const CHUNK_SIZE = 256;
const HEADER_BYTES = 4; // uint32 BE original length

function padToChunk(bytes: Uint8Array): Uint8Array {
  const total = HEADER_BYTES + bytes.length;
  const padded = Math.ceil(total / CHUNK_SIZE) * CHUNK_SIZE;
  const out = new Uint8Array(padded);
  // big-endian uint32 length header
  out[0] = (bytes.length >>> 24) & 0xff;
  out[1] = (bytes.length >>> 16) & 0xff;
  out[2] = (bytes.length >>> 8) & 0xff;
  out[3] = bytes.length & 0xff;
  out.set(bytes, HEADER_BYTES);
  return out;
}

function unpadFromChunk(padded: Uint8Array): Uint8Array {
  if (padded.length < HEADER_BYTES) throw new Error("Blob too short to unpad");
  const len = (padded[0] << 24) | (padded[1] << 16) | (padded[2] << 8) | padded[3];
  if (len < 0 || len > padded.length - HEADER_BYTES) {
    throw new Error(`Invalid length header: ${len}`);
  }
  return padded.slice(HEADER_BYTES, HEADER_BYTES + len);
}

/**
 * Wrapper around the 0G Storage SDK (`@0glabs/0g-ts-sdk`).
 *
 * Stores encrypted blobs on 0G Storage and retrieves them by rootHash.
 * The SealedMind memory engine (Phase 3) calls these methods from inside
 * the TEE so plaintext never exists outside the enclave.
 */

export interface UploadResult {
  rootHash: string;
  txHash: string;
}

export interface StorageConfig {
  /** Indexer URL — testnet turbo: https://indexer-storage-testnet-turbo.0g.ai */
  indexerUrl: string;
  /** 0G Chain RPC — used by the indexer's underlying flow contract calls */
  rpcUrl: string;
  /** Funded private key (hex, with or without 0x) */
  privateKey: string;
}

export class StorageService {
  private indexer: Indexer;
  private signer: Wallet;
  private rpcUrl: string;

  constructor(cfg: StorageConfig) {
    this.indexer = new Indexer(cfg.indexerUrl);
    const provider = new JsonRpcProvider(cfg.rpcUrl);
    const pk = cfg.privateKey.startsWith("0x") ? cfg.privateKey : `0x${cfg.privateKey}`;
    this.signer = new Wallet(pk, provider);
    this.rpcUrl = cfg.rpcUrl;
  }

  /** Address of the wallet used for storage uploads */
  get address(): string {
    return this.signer.address;
  }

  /**
   * Encrypt + upload a payload to 0G Storage.
   * Returns the rootHash (used as the storage CID) and the on-chain tx hash.
   */
  async putEncrypted(plaintext: Uint8Array | string, key: Buffer): Promise<UploadResult> {
    const blob = encrypt(plaintext, key);
    return this.putRaw(blob.bytes);
  }

  /**
   * Upload an already-encrypted (or otherwise opaque) byte buffer.
   * Used by the TEE engine which encrypts inside the enclave.
   */
  async putRaw(bytes: Uint8Array): Promise<UploadResult> {
    // Write to a temp file and use ZgFile (the documented upload path).
    // We pad to chunk boundary (256 bytes) and prefix a 4-byte length header
    // so getRaw() can trim back exactly.
    const padded = padToChunk(bytes);
    const dir = mkdtempSync(join(tmpdir(), "sealedmind-up-"));
    const filePath = join(dir, "blob.bin");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(filePath, Buffer.from(padded));

    const file = await ZgFile.fromFilePath(filePath);
    const [res, err] = await this.indexer.upload(file, this.rpcUrl, this.signer);
    await file.close();
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
    if (err) throw new Error(`0G Storage upload failed: ${err.message ?? err}`);
    return { rootHash: res.rootHash, txHash: res.txHash };
  }

  /** Fetch and decrypt a blob by rootHash. */
  async getEncrypted(rootHash: string, key: Buffer): Promise<Buffer> {
    const raw = await this.getRaw(rootHash);
    return decrypt(raw, key);
  }

  /**
   * Download a raw blob by rootHash.
   * The SDK writes to a file; we read it back into memory and clean up.
   */
  async getRaw(rootHash: string): Promise<Uint8Array> {
    const dir = mkdtempSync(join(tmpdir(), "sealedmind-"));
    const filePath = join(dir, "blob.bin");
    try {
      const err = await this.indexer.download(rootHash, filePath, true);
      if (err) throw new Error(`0G Storage download failed: ${err.message ?? err}`);
      return unpadFromChunk(new Uint8Array(readFileSync(filePath)));
    } finally {
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  }
}

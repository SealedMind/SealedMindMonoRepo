import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * AES-256-GCM symmetric encryption.
 *
 * In production, the symmetric key is generated INSIDE the 0G Sealed Inference TEE
 * and never leaves the enclave. For Phase 2 (storage layer in isolation), we expose
 * encrypt/decrypt as pure helpers so they can be tested without the TEE.
 *
 * Wire format: [12-byte IV][16-byte auth tag][ciphertext]
 */

const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12;  // GCM standard
const TAG_BYTES = 16;

export interface EncryptedBlob {
  /** Concatenated IV ‖ tag ‖ ciphertext, ready to upload as one binary chunk */
  bytes: Uint8Array;
}

export function generateKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

export function encrypt(plaintext: Uint8Array | string, key: Buffer): EncryptedBlob {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Key must be ${KEY_BYTES} bytes, got ${key.length}`);
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : Buffer.from(plaintext);
  const ct = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = Buffer.concat([iv, tag, ct]);
  return { bytes: new Uint8Array(out) };
}

export function decrypt(blob: EncryptedBlob | Uint8Array, key: Buffer): Buffer {
  const buf = Buffer.from(blob instanceof Uint8Array ? blob : blob.bytes);
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error("Encrypted blob too short");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function decryptToString(blob: EncryptedBlob | Uint8Array, key: Buffer): string {
  return decrypt(blob, key).toString("utf8");
}

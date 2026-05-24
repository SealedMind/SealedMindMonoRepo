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

// ─────────────────────────────────────────────────────────────────────────
// v2 — Envelope-encryption helpers (KEK-DEK / key wrapping).
//
// Used by the v0.2 transferable-Minds path:
//   - Each Mind gets a random 32-byte Content Key (the DEK, called "CK").
//   - CK is the key actually used to encrypt the memory blobs.
//   - CK is "wrapped" (encrypted) under the owner's userKey (the KEK,
//     `HMAC(KEY_DERIVATION_SECRET, ownerAddress)`).
//   - On transfer Alice → Bob, the server unwraps CK with Alice's KEK and
//     re-wraps it with Bob's KEK. Blobs are never touched.
//
// Wire format is intentionally identical to encrypt()/decrypt() above
// ([12B IV][16B tag][ct]) so wrapped-key blobs share the same parser.
// These helpers are ADDITIVE — encrypt/decrypt/decryptToString above remain
// frozen and pinned by test/crypto.v1regression.test.ts.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Wrap (encrypt) a 32-byte content key under a KEK.
 * Returns a base64 string suitable for persisting in mind-keyring.json.
 */
export function wrapKey(contentKey: Buffer, kek: Buffer): string {
  if (contentKey.length !== KEY_BYTES) {
    throw new Error(`Content key must be ${KEY_BYTES} bytes, got ${contentKey.length}`);
  }
  const { bytes } = encrypt(contentKey, kek);
  return Buffer.from(bytes).toString("base64");
}

/**
 * Unwrap a wrapped content key with the same KEK that wrapped it.
 * Returns the original 32-byte content key.
 */
export function unwrapKey(wrappedCKBase64: string, kek: Buffer): Buffer {
  const wrapped = Buffer.from(wrappedCKBase64, "base64");
  const ck = decrypt(wrapped, kek);
  if (ck.length !== KEY_BYTES) {
    throw new Error(`Unwrapped key has wrong length: ${ck.length}`);
  }
  return ck;
}

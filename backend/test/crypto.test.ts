import { describe, it, expect } from "vitest";
import { encrypt, decrypt, decryptToString, generateKey } from "../src/services/crypto.js";

describe("crypto (AES-256-GCM)", () => {
  it("round-trips a string payload", () => {
    const key = generateKey();
    const blob = encrypt("User is allergic to shellfish", key);
    expect(decryptToString(blob, key)).toBe("User is allergic to shellfish");
  });

  it("round-trips a binary payload", () => {
    const key = generateKey();
    const data = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const blob = encrypt(data, key);
    const out = decrypt(blob, key);
    expect(Array.from(out)).toEqual(Array.from(data));
  });

  it("produces a fresh IV each call (ciphertexts differ for same plaintext)", () => {
    const key = generateKey();
    const a = encrypt("hello", key);
    const b = encrypt("hello", key);
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(false);
    expect(decryptToString(a, key)).toBe("hello");
    expect(decryptToString(b, key)).toBe("hello");
  });

  it("decryption fails with wrong key", () => {
    const blob = encrypt("secret", generateKey());
    expect(() => decrypt(blob, generateKey())).toThrow();
  });

  it("decryption fails on tampered ciphertext (GCM auth tag)", () => {
    const key = generateKey();
    const blob = encrypt("secret", key);
    blob.bytes[blob.bytes.length - 1] ^= 0xff;
    expect(() => decrypt(blob, key)).toThrow();
  });

  it("rejects keys of wrong length", () => {
    expect(() => encrypt("x", Buffer.alloc(16))).toThrow();
  });

  it("rejects too-short blobs", () => {
    const key = generateKey();
    expect(() => decrypt(new Uint8Array(5), key)).toThrow();
  });
});

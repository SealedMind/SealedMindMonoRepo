import { describe, it, expect } from "vitest";
import { decrypt, decryptToString } from "../src/services/crypto.js";

/**
 * v1 CRYPTO REGRESSION GUARD — DO NOT EDIT THE FIXTURE.
 *
 * This pins the v1 encrypted wire format `[12B IV][16B tag][ciphertext]`
 * (AES-256-GCM) produced by the original crypto.ts. Every existing memory
 * blob on 0G Storage and every existing Mind depends on `decrypt()` being
 * able to read this exact format forever.
 *
 * If any change to crypto.ts (e.g. adding v2 envelope encryption) alters the
 * v1 decrypt path, THIS TEST FAILS and the build fails. That is the entire
 * point — it makes a v1 regression impossible to ship unnoticed.
 *
 * The fixture below was produced once with a fixed key + fixed IV against the
 * original wire format. Never regenerate it.
 */

const FIXED_KEY = Buffer.from(
  "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
  "hex",
);
const KNOWN_PLAINTEXT = "SealedMind v1 canonical fixture — do not change.";
const V1_BLOB_HEX =
  "0102030405060708090a0b0c8333c6934de0b150033185c5b3e04f15291764cc8d73e828849c9bb75dcf7c731df1cd9e54908a634afb8cdb39454068a75ed79ca5109cfd6ec310f7487d465d135b";

describe("v1 crypto regression guard (FROZEN)", () => {
  const blob = new Uint8Array(Buffer.from(V1_BLOB_HEX, "hex"));

  it("decrypt() still reads the canonical v1 blob byte-for-byte", () => {
    const out = decrypt(blob, FIXED_KEY);
    expect(out.toString("utf8")).toBe(KNOWN_PLAINTEXT);
  });

  it("decryptToString() still reads the canonical v1 blob", () => {
    expect(decryptToString(blob, FIXED_KEY)).toBe(KNOWN_PLAINTEXT);
  });

  it("a wrong key still fails (auth tag integrity preserved)", () => {
    const wrong = Buffer.alloc(32, 0xab);
    expect(() => decrypt(blob, wrong)).toThrow();
  });
});

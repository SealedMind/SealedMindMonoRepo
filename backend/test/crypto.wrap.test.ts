import { describe, it, expect } from "vitest";
import {
  encrypt,
  decryptToString,
  generateKey,
  wrapKey,
  unwrapKey,
} from "../src/services/crypto.js";

/**
 * v2 envelope helpers — wrap/unwrap round-trips + cross-key isolation.
 *
 * These cover the KEK-DEK path used for transferable Minds. They do NOT
 * touch the v1 wire format, which is pinned by crypto.v1regression.test.ts.
 */

describe("v2 wrap/unwrap (envelope encryption)", () => {
  it("wraps a CK under a KEK and unwraps it back exactly", () => {
    const kek = generateKey();
    const ck = generateKey();
    const wrapped = wrapKey(ck, kek);
    const unwrapped = unwrapKey(wrapped, kek);
    expect(unwrapped.equals(ck)).toBe(true);
  });

  it("a different KEK cannot unwrap the CK (GCM auth integrity)", () => {
    const kek1 = generateKey();
    const kek2 = generateKey();
    const ck = generateKey();
    const wrapped = wrapKey(ck, kek1);
    expect(() => unwrapKey(wrapped, kek2)).toThrow();
  });

  it("re-wrap (transfer) Alice→Bob preserves the CK, blobs stay readable", () => {
    const aliceKEK = generateKey();
    const bobKEK = generateKey();
    const ck = generateKey();

    // Alice wraps + encrypts a memory blob with the CK
    const blob = encrypt("memory under content key", ck);
    const wrappedForAlice = wrapKey(ck, aliceKEK);

    // Simulate transfer: server unwraps with Alice's KEK, re-wraps under Bob's
    const recoveredCK = unwrapKey(wrappedForAlice, aliceKEK);
    const wrappedForBob = wrapKey(recoveredCK, bobKEK);

    // Bob can now unwrap and decrypt the original blob — unchanged
    const ckBob = unwrapKey(wrappedForBob, bobKEK);
    expect(decryptToString(blob.bytes, ckBob)).toBe("memory under content key");

    // Alice can no longer use her old wrapped CK to derive Bob's keyring
    expect(() => unwrapKey(wrappedForBob, aliceKEK)).toThrow();
  });

  it("rejects a non-32-byte CK", () => {
    const kek = generateKey();
    expect(() => wrapKey(Buffer.alloc(16, 0xaa), kek)).toThrow();
  });
});

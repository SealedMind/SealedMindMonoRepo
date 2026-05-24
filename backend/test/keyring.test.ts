import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  createKeyring,
  loadKeyring,
  hasKeyring,
  rewrapForNewOwner,
  detectVersion,
  unwrapCK,
  keyringPath,
} from "../src/services/keyring.js";
import { generateKey, encrypt, decryptToString } from "../src/services/crypto.js";

/**
 * Keyring service — v0.2 envelope encryption persistence + transfer re-wrap.
 *
 * These tests cover the file lifecycle (create / load / detect-version /
 * re-wrap) plus the end-to-end Alice → Bob transfer at the keyring layer
 * (without touching MemoryEngine yet — that's the next layer up).
 */

describe("keyring service (v0.2 envelope)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sm-keyring-"));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("creates a keyring, persists it, and unwraps the CK exactly", () => {
    const aliceKEK = generateKey();
    const { ck, file } = createKeyring(tmp, "0xAlice", aliceKEK);

    expect(file.version).toBe(2);
    expect(file.owner).toBe("0xalice");
    expect(file.rotatedAt).toBeNull();
    expect(fs.existsSync(keyringPath(tmp))).toBe(true);

    const loaded = loadKeyring(tmp)!;
    expect(loaded.wrappedCK).toBe(file.wrappedCK);
    const ckBack = unwrapCK(loaded, aliceKEK);
    expect(ckBack.equals(ck)).toBe(true);
  });

  it("hasKeyring + detectVersion distinguish v1 vs v2 directories", () => {
    expect(hasKeyring(tmp)).toBe(false);
    expect(detectVersion(tmp)).toBe(1);

    createKeyring(tmp, "0xowner", generateKey());

    expect(hasKeyring(tmp)).toBe(true);
    expect(detectVersion(tmp)).toBe(2);
  });

  it("a different KEK cannot unwrap the CK", () => {
    const aliceKEK = generateKey();
    const eveKEK = generateKey();
    createKeyring(tmp, "0xAlice", aliceKEK);
    const kr = loadKeyring(tmp)!;
    expect(() => unwrapCK(kr, eveKEK)).toThrow();
  });

  it("end-to-end: blob encrypted with CK stays readable after Alice→Bob re-wrap", () => {
    const aliceKEK = generateKey();
    const bobKEK = generateKey();

    // 1. Alice creates her Mind keyring and encrypts a memory blob with CK
    const { ck } = createKeyring(tmp, "0xAlice", aliceKEK);
    const blob = encrypt("Alice's encrypted memory", ck);

    // 2. Transfer to Bob: server re-wraps CK under Bob's KEK
    const ckCopy = rewrapForNewOwner(tmp, "0xBob", aliceKEK, bobKEK);
    expect(ckCopy.equals(ck)).toBe(true);  // CK is unchanged

    // 3. The keyring file now reflects Bob's ownership
    const kr = loadKeyring(tmp)!;
    expect(kr.owner).toBe("0xbob");
    expect(kr.rotatedAt).not.toBeNull();

    // 4. Bob can unwrap with his KEK and read Alice's memory verbatim
    const bobCK = unwrapCK(kr, bobKEK);
    expect(decryptToString(blob.bytes, bobCK)).toBe("Alice's encrypted memory");

    // 5. Alice's old KEK no longer unwraps the rotated wrappedCK
    expect(() => unwrapCK(kr, aliceKEK)).toThrow();
  });

  it("rewrapForNewOwner fails cleanly when no keyring exists", () => {
    expect(() => rewrapForNewOwner(tmp, "0xBob", generateKey(), generateKey()))
      .toThrow(/No keyring/);
  });

  it("loadKeyring rejects unknown versions", () => {
    fs.writeFileSync(
      keyringPath(tmp),
      JSON.stringify({ version: 99, owner: "0x", wrappedCK: "", createdAt: 0, rotatedAt: null }),
      "utf8",
    );
    expect(() => loadKeyring(tmp)).toThrow(/Unsupported keyring version/);
  });
});

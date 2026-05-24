import fs from "node:fs";
import path from "node:path";
import { wrapKey, unwrapKey, generateKey } from "./crypto.js";

/**
 * Mind keyring — the v0.2 transferable-Minds envelope.
 *
 * Each v2 Mind owns a random Content Key (CK). CK encrypts the memory blobs.
 * CK itself is wrapped under the owner's userKey (the KEK,
 * `HMAC(KEY_DERIVATION_SECRET, ownerAddress)`) and persisted to
 * `data/<address>/mind-keyring.json`.
 *
 * Wire format:
 *   {
 *     "version": 2,
 *     "owner": "0x…",                  // lowercased
 *     "wrappedCK": "<base64 [IV][tag][ct]>",
 *     "createdAt": <unix ms>,
 *     "rotatedAt": <unix ms | null>   // bumped each re-wrap (transfer)
 *   }
 *
 * v1 Minds have NO keyring file. The version resolver below disambiguates.
 * `crypto.ts` `encrypt/decrypt` are untouched; v1 remains pinned by
 * test/crypto.v1regression.test.ts.
 */

export const MIND_ENC_VERSION_LATEST = 2 as const;
export const KEYRING_FILENAME = "mind-keyring.json";

export interface KeyringFile {
  version: 2;
  owner: string;        // lowercased address
  wrappedCK: string;    // base64
  createdAt: number;
  rotatedAt: number | null;
}

/** Path helper. */
export function keyringPath(dataDir: string): string {
  return path.join(dataDir, KEYRING_FILENAME);
}

/** True if a v2 keyring exists for the given data dir. */
export function hasKeyring(dataDir: string): boolean {
  return fs.existsSync(keyringPath(dataDir));
}

/** Load and parse a keyring file. Returns null if absent. */
export function loadKeyring(dataDir: string): KeyringFile | null {
  const p = keyringPath(dataDir);
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as KeyringFile;
  if (raw.version !== 2) {
    throw new Error(`Unsupported keyring version: ${raw.version}`);
  }
  return raw;
}

/** Atomically persist a keyring file. */
export function saveKeyring(dataDir: string, kr: KeyringFile): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const p = keyringPath(dataDir);
  const tmp = `${p}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(kr, null, 2), "utf8");
  fs.renameSync(tmp, p);
}

/**
 * Create a fresh keyring for a new (v2) Mind: random CK wrapped under the
 * owner's KEK. Returns BOTH the unwrapped CK (for the engine to use) and
 * the persisted file.
 */
export function createKeyring(
  dataDir: string,
  owner: string,
  ownerKEK: Buffer,
): { ck: Buffer; file: KeyringFile } {
  const ck = generateKey();
  const file: KeyringFile = {
    version: 2,
    owner: owner.toLowerCase(),
    wrappedCK: wrapKey(ck, ownerKEK),
    createdAt: Date.now(),
    rotatedAt: null,
  };
  saveKeyring(dataDir, file);
  return { ck, file };
}

/** Unwrap the CK stored in a keyring with the current owner's KEK. */
export function unwrapCK(kr: KeyringFile, ownerKEK: Buffer): Buffer {
  return unwrapKey(kr.wrappedCK, ownerKEK);
}

/**
 * Transfer re-wrap: unwrap CK with `fromKEK`, re-wrap with `toKEK`, persist.
 * Atomic on disk. Returns the unchanged CK (so the caller can validate
 * round-trip).
 */
export function rewrapForNewOwner(
  dataDir: string,
  newOwner: string,
  fromKEK: Buffer,
  toKEK: Buffer,
): Buffer {
  const kr = loadKeyring(dataDir);
  if (!kr) throw new Error(`No keyring at ${keyringPath(dataDir)}`);
  const ck = unwrapKey(kr.wrappedCK, fromKEK);
  const next: KeyringFile = {
    ...kr,
    owner: newOwner.toLowerCase(),
    wrappedCK: wrapKey(ck, toKEK),
    rotatedAt: Date.now(),
  };
  saveKeyring(dataDir, next);
  return ck;
}

/**
 * Diagnostic — returns the encryption-version a given data dir resolves to.
 * Used by /v1/minds/:id/version and the engine's startup log.
 */
export function detectVersion(dataDir: string): 1 | 2 {
  return hasKeyring(dataDir) ? 2 : 1;
}

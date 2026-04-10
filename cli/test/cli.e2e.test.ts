/**
 * CLI e2e tests — require a live backend on SEALEDMIND_API_URL (default :4000)
 * and a valid SEALEDMIND_SESSION + SEALEDMIND_MIND_ID in the environment.
 *
 * Run: vitest run --pool=forks
 *
 * These tests are skipped automatically when the required env vars are absent
 * so `npm test` passes in CI without a live testnet connection.
 */
import { describe, it, expect } from "vitest";
import { execa } from "execa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, "../dist/index.js");

const API_URL = process.env.SEALEDMIND_API_URL ?? "http://localhost:4000";
const SESSION = process.env.SEALEDMIND_SESSION ?? "";
const MIND_ID = process.env.SEALEDMIND_MIND_ID ?? "";

const env = {
  ...process.env,
  SEALEDMIND_API_URL: API_URL,
  SEALEDMIND_SESSION: SESSION,
  SEALEDMIND_MIND_ID: MIND_ID,
};

const hasLiveEnv = Boolean(SESSION && MIND_ID);

describe("sealedmind CLI", () => {
  it("prints help and exits 0", async () => {
    const { exitCode, stdout } = await execa("node", [CLI, "--help"], {
      reject: false,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("recall");
    expect(stdout).toContain("remember");
    expect(stdout).toContain("grant");
  });

  it("exits 2 when SEALEDMIND_SESSION is missing", async () => {
    const { exitCode, stderr } = await execa(
      "node",
      [CLI, "recall", "--mind", "x", "--query", "x"],
      {
        env: { ...process.env, SEALEDMIND_API_URL: API_URL, SEALEDMIND_SESSION: "" },
        reject: false,
      }
    );
    expect(exitCode).toBe(2);
    expect(stderr).toContain("SEALEDMIND_SESSION");
  });

  it.skipIf(!hasLiveEnv)(
    "recall — returns JSON with answer and memories array",
    async () => {
      const { exitCode, stdout } = await execa(
        "node",
        [CLI, "recall", "--mind", MIND_ID, "--query", "What do you know about me?", "--top-k", "3"],
        { env, reject: false }
      );
      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(typeof data.answer).toBe("string");
      expect(Array.isArray(data.memories)).toBe(true);
    },
    60_000
  );

  it.skipIf(!hasLiveEnv)(
    "remember — seals a fact and returns CID",
    async () => {
      const { exitCode, stdout } = await execa(
        "node",
        [CLI, "remember", "--mind", MIND_ID, "--content", "I was born in Mumbai and I drink green tea every morning."],
        { env, reject: false }
      );
      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(typeof data.sealed).toBe("number");
      expect(data.sealed).toBeGreaterThanOrEqual(0);
      if (data.sealed > 0) {
        const first = data.memories[0];
        expect(first.cid).toBeTruthy();
      }
    },
    60_000
  );
});

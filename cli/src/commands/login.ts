import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ethers } from "ethers";
import { SiweMessage, generateNonce } from "siwe";

export const CONFIG_PATH = path.join(os.homedir(), ".sealedmind", "config.json");

export interface Config {
  host: string;
  address: string;
  token: string;
  apiKey: string;
  mindId: string;
}

export function loadConfig(): Config | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as Config;
    }
  } catch {}
  return null;
}

function saveConfig(cfg: Config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
}

export async function login(opts: { privateKey?: string; host: string }) {
  const privateKey = opts.privateKey ?? process.env.PRIVATE_KEY;
  if (!privateKey) {
    process.stderr.write(
      "error: provide --private-key <key> or set PRIVATE_KEY in your environment\n"
    );
    process.exit(1);
  }

  const host = opts.host.replace(/\/$/, "");
  const wallet = new ethers.Wallet(privateKey);
  const address = await wallet.getAddress();

  process.stderr.write(`Logging in as ${address} → ${host}\n`);

  // 1. Fetch nonce
  const nonceRes = await fetch(`${host}/v1/auth/nonce`);
  if (!nonceRes.ok) throw new Error(`Failed to fetch nonce: ${nonceRes.status}`);
  const { nonce } = (await nonceRes.json()) as { nonce: string };

  // 2. Build + sign SIWE message
  const siweMessage = new SiweMessage({
    domain: new URL(host).hostname || "localhost",
    address,
    statement: "Sign in to SealedMind",
    uri: host,
    version: "1",
    chainId: 16602,
    nonce,
  });
  const messageStr = siweMessage.prepareMessage();
  const signature = await wallet.signMessage(messageStr);

  // 3. Exchange for session token
  const loginRes = await fetch(`${host}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: messageStr, signature }),
  });
  if (!loginRes.ok) {
    const body = await loginRes.json().catch(() => ({}));
    throw new Error(`Login failed: ${(body as any).error ?? loginRes.status}`);
  }
  const { token } = (await loginRes.json()) as { token: string };

  const authHeader = { Authorization: `Bearer ${token}` };

  // 4. Create (or get) mind — mind ID = wallet address
  const mindRes = await fetch(`${host}/v1/minds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ name: "My Mind" }),
  });
  const { mind } = (await mindRes.json()) as { mind: { id: string } };
  const mindId = mind?.id ?? address.toLowerCase();

  // 5. Get long-lived API key (survives restarts, no re-auth needed)
  const apiKeyRes = await fetch(`${host}/v1/auth/apikey`, {
    method: "POST",
    headers: authHeader,
  });
  if (!apiKeyRes.ok) throw new Error(`Failed to get API key: ${apiKeyRes.status}`);
  const { apiKey } = (await apiKeyRes.json()) as { apiKey: string };

  // 6. Save config
  const cfg: Config = { host, address, token, apiKey, mindId };
  saveConfig(cfg);

  process.stdout.write(
    JSON.stringify({ success: true, address, mindId, apiKey }, null, 2) + "\n"
  );
  process.stderr.write(`Config saved to ${CONFIG_PATH}\n`);
  process.stderr.write(`Run commands without --token — API key is saved.\n`);
}

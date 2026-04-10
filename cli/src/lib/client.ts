import { SealedMind } from "@sealedmind/sdk";

let cached: SealedMind | null = null;

export function getClient(): SealedMind {
  if (cached) return cached;
  const apiUrl = required("SEALEDMIND_API_URL");
  const token = required("SEALEDMIND_SESSION");
  const address =
    process.env.SEALEDMIND_ADDRESS ??
    "0x0000000000000000000000000000000000000000";
  cached = new SealedMind({ apiUrl });
  cached.setSession({ token, address });
  return cached;
}

function required(k: string): string {
  const v = process.env[k];
  if (!v) {
    process.stderr.write(`error: missing env var ${k}\n`);
    process.exit(2);
  }
  return v;
}

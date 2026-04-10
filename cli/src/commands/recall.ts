import { getClient } from "../lib/client.js";

export async function recall(opts: {
  mind: string;
  query: string;
  shard?: string;
  topK?: string;
}) {
  const sm = getClient();
  const r = await sm.recall(opts.mind, {
    query: opts.query,
    shard: opts.shard,
    topK: opts.topK ? Number(opts.topK) : 5,
  });
  process.stdout.write(
    JSON.stringify(
      {
        answer: r.answer,
        memories: (r.memories ?? []).map((m) => ({
          content: m.content,
          shard: m.shard,
          cid: m.storageCID,
        })),
        attestation: r.attestation,
      },
      null,
      2
    ) + "\n"
  );
}

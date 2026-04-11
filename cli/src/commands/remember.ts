import { getClient, getMindId } from "../lib/client.js";

export async function remember(opts: {
  mind?: string;
  content: string;
  shard?: string;
}) {
  const sm = getClient();
  const mindId = getMindId(opts.mind);
  const r = await sm.remember(mindId, {
    content: opts.content,
    shard: opts.shard,
  });
  process.stdout.write(
    JSON.stringify(
      {
        sealed: r.memories?.length ?? 0,
        memories: (r.memories ?? []).map((m: any) => ({
          content: m.content,
          shard: m.shard,
          cid: m.storageCID,
          txHash: m.txHash ?? null,
          explorer: m.explorerUrl ?? null,
        })),
        attestation: r.attestation,
        totalMemories: r.mindStats?.totalMemories,
      },
      null,
      2
    ) + "\n"
  );
}

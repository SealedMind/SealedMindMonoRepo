import { getClient } from "../lib/client.js";

export async function grant(opts: {
  mind: string;
  shard: string;
  to: string;
  expiryDays: string;
  readOnly?: boolean;
}) {
  const sm = getClient();
  const expiry =
    Math.floor(Date.now() / 1000) + Number(opts.expiryDays) * 86400;
  const r = await sm.grantCapability(opts.mind, opts.shard, opts.to, {
    readOnly: !!opts.readOnly,
    expiry,
  });
  process.stdout.write(
    JSON.stringify(
      {
        capId: r.capability.capId,
        shard: r.capability.shardName,
        grantee: r.capability.grantee,
        readOnly: r.capability.readOnly,
        expiry: r.capability.expiry,
        explorer: `https://chainscan-galileo.0g.ai/address/0xf6b33aDa9dd4998E71FA070C1618C8a52A44Ec66`,
      },
      null,
      2
    ) + "\n"
  );
}

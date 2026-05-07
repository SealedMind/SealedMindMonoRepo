/**
 * Verify all 4 SealedMind contracts on the configured chainscan explorer.
 *
 * Usage:
 *   npx hardhat run scripts/verify-all.ts --network og_testnet
 *   npx hardhat run scripts/verify-all.ts --network og_mainnet
 *
 * Reads addresses from deployments/<network>.json. Re-derives constructor
 * args from the deploy script logic (same pattern as scripts/deploy.ts).
 */
import { run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface Deployment {
  network: string;
  chainId: number;
  deployer: string;
  contracts: {
    Verifier: string;
    SealedMindNFT: string;
    CapabilityRegistry: string;
    MemoryAccessLog: string;
  };
}

async function verify(name: string, address: string, args: any[]): Promise<void> {
  console.log(`\n→ Verifying ${name} @ ${address}`);
  try {
    await run("verify:verify", { address, constructorArguments: args });
    console.log(`  ✅ ${name} verified`);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.toLowerCase().includes("already verified")) {
      console.log(`  ✓ ${name} already verified`);
    } else {
      console.error(`  ✗ ${name} FAILED: ${msg.split("\n")[0]}`);
    }
  }
}

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment file at ${file} — deploy first`);
  }
  const dep: Deployment = JSON.parse(fs.readFileSync(file, "utf8"));

  console.log(`\n=== Verifying contracts on ${network.name} (chainId ${dep.chainId}) ===`);
  console.log(`Deployer: ${dep.deployer}`);

  // Constructor args mirror scripts/deploy.ts:
  //   Verifier:           (deployer, 0)            // VerifierType.TEE = 0
  //   SealedMindNFT:      ("SealedMind", "MIND", verifierAddr)
  //   CapabilityRegistry: (nftAddr)
  //   MemoryAccessLog:    ()
  await verify("Verifier", dep.contracts.Verifier, [dep.deployer, 0]);
  await verify("SealedMindNFT", dep.contracts.SealedMindNFT, [
    "SealedMind",
    "MIND",
    dep.contracts.Verifier,
  ]);
  await verify("CapabilityRegistry", dep.contracts.CapabilityRegistry, [
    dep.contracts.SealedMindNFT,
  ]);
  await verify("MemoryAccessLog", dep.contracts.MemoryAccessLog, []);

  console.log(`\n=== Done ===`);
  console.log(`Browse: https://${network.name === "og_mainnet" ? "chainscan.0g.ai" : "chainscan-galileo.0g.ai"}/address/${dep.contracts.SealedMindNFT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

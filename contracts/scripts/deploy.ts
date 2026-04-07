import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("\n=== SealedMind Phase 1 Deploy ===");
  console.log("Network:    ", network.name);
  console.log("Deployer:   ", deployer.address);
  console.log("Balance:    ", ethers.formatEther(balance), "OG");
  console.log("");

  // 1. Verifier (TEE type = 0). attestationContract placeholder = deployer.
  console.log("Deploying Verifier (TEE type)...");
  const VerifierFactory = await ethers.getContractFactory("Verifier");
  const verifier = await VerifierFactory.deploy(deployer.address, 0);
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("  Verifier:           ", verifierAddr);

  // 2. SealedMindNFT
  console.log("Deploying SealedMindNFT...");
  const NFTFactory = await ethers.getContractFactory("SealedMindNFT");
  const nft = await NFTFactory.deploy("SealedMind", "MIND", verifierAddr);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("  SealedMindNFT:      ", nftAddr);

  // 3. CapabilityRegistry
  console.log("Deploying CapabilityRegistry...");
  const RegistryFactory = await ethers.getContractFactory("CapabilityRegistry");
  const registry = await RegistryFactory.deploy(nftAddr);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("  CapabilityRegistry: ", registryAddr);

  // 4. MemoryAccessLog
  console.log("Deploying MemoryAccessLog...");
  const LogFactory = await ethers.getContractFactory("MemoryAccessLog");
  const log = await LogFactory.deploy();
  await log.waitForDeployment();
  const logAddr = await log.getAddress();
  console.log("  MemoryAccessLog:    ", logAddr);

  // Persist deployment artifacts
  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      Verifier: verifierAddr,
      SealedMindNFT: nftAddr,
      CapabilityRegistry: registryAddr,
      MemoryAccessLog: logAddr,
    },
  };

  const dir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));

  console.log("\nDeployment saved to:", file);
  console.log("Done.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

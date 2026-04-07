import { expect } from "chai";
import { ethers } from "hardhat";
import { CapabilityRegistry, SealedMindNFT, Verifier } from "../typechain-types";

const proofFromString = (s: string): string => ethers.id(s);

describe("CapabilityRegistry", () => {
  let nft: SealedMindNFT;
  let registry: CapabilityRegistry;
  let owner: any, alice: any, bob: any, agent: any;

  beforeEach(async () => {
    [owner, alice, bob, agent] = await ethers.getSigners();

    const VerifierFactory = await ethers.getContractFactory("Verifier");
    const verifier = (await VerifierFactory.deploy(owner.address, 0)) as unknown as Verifier;

    const NFTFactory = await ethers.getContractFactory("SealedMindNFT");
    nft = (await NFTFactory.deploy("SealedMind", "MIND", await verifier.getAddress())) as unknown as SealedMindNFT;

    const RegistryFactory = await ethers.getContractFactory("CapabilityRegistry");
    registry = (await RegistryFactory.deploy(await nft.getAddress())) as unknown as CapabilityRegistry;

    // Alice mints Mind #0
    await nft.connect(alice).mint([proofFromString("init")], ["init"], alice.address);
  });

  describe("grantCapability", () => {
    it("mind owner can grant a capability", async () => {
      const tx = await registry.connect(alice).grantCapability(0, "finance", agent.address, true, 0);
      const rcpt = await tx.wait();

      const ev = rcpt!.logs.find((l: any) => l.fragment?.name === "CapabilityGranted") as any;
      expect(ev).to.not.be.undefined;
      expect(ev!.args.mindId).to.equal(0n);
      expect(ev!.args.shardName).to.equal("finance");
      expect(ev!.args.grantee).to.equal(agent.address);
      expect(ev!.args.readOnly).to.equal(true);

      const caps = await registry.getCapabilities(0);
      expect(caps.length).to.equal(1);
    });

    it("non-owner cannot grant", async () => {
      await expect(
        registry.connect(bob).grantCapability(0, "finance", agent.address, true, 0)
      ).to.be.revertedWith("Not mind owner");
    });

    it("rejects zero grantee", async () => {
      await expect(
        registry.connect(alice).grantCapability(0, "finance", ethers.ZeroAddress, true, 0)
      ).to.be.revertedWith("Zero grantee");
    });
  });

  describe("verifyCapability", () => {
    let capId: string;

    beforeEach(async () => {
      const tx = await registry.connect(alice).grantCapability(0, "finance", agent.address, true, 0);
      const rcpt = await tx.wait();
      const ev = rcpt!.logs.find((l: any) => l.fragment?.name === "CapabilityGranted") as any;
      capId = ev!.args.capId;
    });

    it("returns true for the granted agent", async () => {
      expect(await registry.verifyCapability(capId, agent.address)).to.equal(true);
    });

    it("returns false for a different caller", async () => {
      expect(await registry.verifyCapability(capId, bob.address)).to.equal(false);
    });

    it("returns false after expiry", async () => {
      const future = (await ethers.provider.getBlock("latest"))!.timestamp + 100;
      const tx = await registry.connect(alice).grantCapability(0, "health", agent.address, true, future);
      const rcpt = await tx.wait();
      const ev = rcpt!.logs.find((l: any) => l.fragment?.name === "CapabilityGranted") as any;
      const expiringId = ev!.args.capId;

      expect(await registry.verifyCapability(expiringId, agent.address)).to.equal(true);

      // Advance time past expiry
      await ethers.provider.send("evm_increaseTime", [200]);
      await ethers.provider.send("evm_mine", []);

      expect(await registry.verifyCapability(expiringId, agent.address)).to.equal(false);
    });
  });

  describe("revokeCapability", () => {
    let capId: string;

    beforeEach(async () => {
      const tx = await registry.connect(alice).grantCapability(0, "finance", agent.address, true, 0);
      const rcpt = await tx.wait();
      const ev = rcpt!.logs.find((l: any) => l.fragment?.name === "CapabilityGranted") as any;
      capId = ev!.args.capId;
    });

    it("owner can revoke", async () => {
      await expect(registry.connect(alice).revokeCapability(capId))
        .to.emit(registry, "CapabilityRevoked")
        .withArgs(capId);

      expect(await registry.verifyCapability(capId, agent.address)).to.equal(false);
    });

    it("non-owner cannot revoke", async () => {
      await expect(
        registry.connect(bob).revokeCapability(capId)
      ).to.be.revertedWith("Not mind owner");
    });

    it("cannot revoke twice", async () => {
      await registry.connect(alice).revokeCapability(capId);
      await expect(
        registry.connect(alice).revokeCapability(capId)
      ).to.be.revertedWith("Already revoked");
    });
  });
});

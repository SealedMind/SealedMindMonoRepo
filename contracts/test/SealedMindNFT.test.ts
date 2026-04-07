import { expect } from "chai";
import { ethers } from "hardhat";
import { SealedMindNFT, Verifier } from "../typechain-types";

// Verifier.verifyPreimage requires each proof to be exactly 32 bytes (the data hash itself).
// We use ethers.id() (keccak256 of a string) for deterministic 32-byte hashes in tests.
const proofFromString = (s: string): string => ethers.id(s);

describe("SealedMindNFT", () => {
  let nft: SealedMindNFT;
  let verifier: Verifier;
  let owner: any, alice: any, bob: any;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy a TEE-type Verifier (VerifierType.TEE = 0).
    // Pass owner.address as the placeholder attestation contract.
    const VerifierFactory = await ethers.getContractFactory("Verifier");
    verifier = (await VerifierFactory.deploy(owner.address, 0)) as unknown as Verifier;

    const NFTFactory = await ethers.getContractFactory("SealedMindNFT");
    nft = (await NFTFactory.deploy(
      "SealedMind",
      "MIND",
      await verifier.getAddress()
    )) as unknown as SealedMindNFT;
  });

  describe("deployment", () => {
    it("sets name, symbol, and verifier", async () => {
      expect(await nft.name()).to.equal("SealedMind");
      expect(await nft.symbol()).to.equal("MIND");
      expect(await nft.verifier()).to.equal(await verifier.getAddress());
    });

    it("rejects zero verifier", async () => {
      const NFTFactory = await ethers.getContractFactory("SealedMindNFT");
      await expect(
        NFTFactory.deploy("X", "Y", ethers.ZeroAddress)
      ).to.be.revertedWith("Zero verifier");
    });

    it("starts with totalSupply 0", async () => {
      expect(await nft.totalSupply()).to.equal(0);
    });
  });

  describe("mint", () => {
    it("mints a Mind iNFT and emits Minted", async () => {
      const proofs = [proofFromString("init-memory-1")];
      const descs = ["Initial encrypted memory metadata"];

      await expect(nft.connect(alice).mint(proofs, descs, alice.address))
        .to.emit(nft, "Minted")
        .withArgs(0, alice.address, alice.address, [proofs[0]], descs);

      expect(await nft.ownerOf(0)).to.equal(alice.address);
      expect(await nft.totalSupply()).to.equal(1);
    });

    it("defaults _to to msg.sender when zero address passed", async () => {
      const proofs = [proofFromString("m1")];
      await nft.connect(alice).mint(proofs, ["d"], ethers.ZeroAddress);
      expect(await nft.ownerOf(0)).to.equal(alice.address);
    });

    it("reverts on length mismatch", async () => {
      await expect(
        nft.connect(alice).mint([proofFromString("a")], ["d1", "d2"], alice.address)
      ).to.be.revertedWith("Length mismatch");
    });

    it("stores dataHashes and dataDescriptions", async () => {
      const proofs = [proofFromString("p1"), proofFromString("p2")];
      const descs = ["episodic", "semantic"];
      await nft.connect(alice).mint(proofs, descs, alice.address);

      expect(await nft.dataHashesOf(0)).to.deep.equal(proofs);
      expect(await nft.dataDescriptionsOf(0)).to.deep.equal(descs);
    });
  });

  describe("mintMind (SealedMind extension)", () => {
    it("mints with storageCID and emits MindCreated", async () => {
      const proofs = [proofFromString("seed")];
      const cid = "bafkreig5initialcid";

      await expect(
        nft.connect(alice).mintMind(proofs, ["seed"], alice.address, cid)
      )
        .to.emit(nft, "MindCreated")
        .withArgs(0, alice.address, cid);

      const info = await nft.getMindInfo(0);
      expect(info.owner).to.equal(alice.address);
      expect(info.storageCID).to.equal(cid);
      expect(info.memoryCount).to.equal(0);
    });
  });

  describe("shards", () => {
    beforeEach(async () => {
      await nft.connect(alice).mint([proofFromString("s")], ["d"], alice.address);
    });

    it("owner can create a shard", async () => {
      await expect(nft.connect(alice).createShard(0, "health"))
        .to.emit(nft, "ShardCreated")
        .withArgs(0, "health");

      const info = await nft.getMindInfo(0);
      expect(info.shards).to.deep.equal(["health"]);
    });

    it("non-owner cannot create a shard", async () => {
      await expect(
        nft.connect(bob).createShard(0, "finance")
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("updateMindState", () => {
    beforeEach(async () => {
      await nft.connect(alice).mint([proofFromString("s")], ["d"], alice.address);
    });

    it("owner can update memoryCount and storageCID", async () => {
      const newCID = "bafkreig5updated";
      await expect(nft.connect(alice).updateMindState(0, 42, newCID))
        .to.emit(nft, "MindUpdated")
        .withArgs(0, 42, newCID);

      const info = await nft.getMindInfo(0);
      expect(info.memoryCount).to.equal(42);
      expect(info.storageCID).to.equal(newCID);
    });

    it("non-owner cannot update", async () => {
      await expect(
        nft.connect(bob).updateMindState(0, 1, "x")
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("authorizeUsage", () => {
    beforeEach(async () => {
      await nft.connect(alice).mint([proofFromString("s")], ["d"], alice.address);
    });

    it("owner can authorize a user", async () => {
      await expect(nft.connect(alice).authorizeUsage(0, bob.address))
        .to.emit(nft, "Authorization")
        .withArgs(alice.address, bob.address, 0);

      expect(await nft.authorizedUsersOf(0)).to.deep.equal([bob.address]);
    });

    it("non-owner cannot authorize", async () => {
      await expect(
        nft.connect(bob).authorizeUsage(0, bob.address)
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("view safety", () => {
    it("ownerOf reverts for non-existent token", async () => {
      await expect(nft.ownerOf(999)).to.be.revertedWith("Token not exist");
    });
    it("getMindInfo reverts for non-existent token", async () => {
      await expect(nft.getMindInfo(999)).to.be.revertedWith("Token not exist");
    });
  });
});

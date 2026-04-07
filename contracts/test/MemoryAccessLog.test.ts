import { expect } from "chai";
import { ethers } from "hardhat";
import { MemoryAccessLog } from "../typechain-types";

describe("MemoryAccessLog", () => {
  let log: MemoryAccessLog;
  let alice: any;

  beforeEach(async () => {
    [, alice] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MemoryAccessLog");
    log = (await Factory.deploy()) as unknown as MemoryAccessLog;
  });

  it("logs an access entry and emits event", async () => {
    const attHash = ethers.id("attestation-1");
    const cid = "bafkreig5att1";

    await expect(log.connect(alice).logAccess(0, "write", attHash, cid))
      .to.emit(log, "MemoryAccessed")
      .withArgs(0, alice.address, "write", attHash);

    expect(await log.getAccessCount(0)).to.equal(1);

    const entry = await log.getAccessEntry(0, 0);
    expect(entry.mindId).to.equal(0);
    expect(entry.accessor).to.equal(alice.address);
    expect(entry.operation).to.equal("write");
    expect(entry.attestationHash).to.equal(attHash);
    expect(entry.storageCID).to.equal(cid);
  });

  it("supports pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await log.connect(alice).logAccess(0, "recall", ethers.id(`a${i}`), `cid${i}`);
    }
    expect(await log.getAccessCount(0)).to.equal(5);

    const page = await log.getAccessLog(0, 1, 2);
    expect(page.length).to.equal(2);
    expect(page[0].storageCID).to.equal("cid1");
    expect(page[1].storageCID).to.equal("cid2");
  });

  it("returns empty array when offset beyond length", async () => {
    const page = await log.getAccessLog(0, 100, 10);
    expect(page.length).to.equal(0);
  });

  it("clamps end to length", async () => {
    await log.connect(alice).logAccess(0, "write", ethers.id("a"), "c");
    const page = await log.getAccessLog(0, 0, 100);
    expect(page.length).to.equal(1);
  });

  it("reverts on out-of-bounds entry index", async () => {
    await expect(log.getAccessEntry(0, 0)).to.be.revertedWith("Index out of bounds");
  });

  it("isolates logs per mindId", async () => {
    await log.connect(alice).logAccess(0, "write", ethers.id("a"), "c0");
    await log.connect(alice).logAccess(1, "write", ethers.id("b"), "c1");
    expect(await log.getAccessCount(0)).to.equal(1);
    expect(await log.getAccessCount(1)).to.equal(1);
  });
});

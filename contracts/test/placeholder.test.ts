import { expect } from "chai";
import { ethers } from "hardhat";

describe("Placeholder", () => {
  it("deploys and reports version", async () => {
    const C = await ethers.getContractFactory("Placeholder");
    const c = await C.deploy();
    expect(await c.VERSION()).to.equal("phase-0");
  });
});

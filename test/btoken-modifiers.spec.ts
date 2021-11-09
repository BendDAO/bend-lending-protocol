import { expect } from "chai";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { ProtocolErrors } from "../helpers/types";

makeSuite("BToken: Modifiers", (testEnv: TestEnv) => {
  const { CT_CALLER_MUST_BE_LEND_POOL } = ProtocolErrors;

  it("Tries to invoke mint not being the Pool", async () => {
    const { deployer, bDai } = testEnv;
    await expect(bDai.mint(deployer.address, "1", "1")).to.be.revertedWith(CT_CALLER_MUST_BE_LEND_POOL);
  });

  it("Tries to invoke burn not being the Pool", async () => {
    const { deployer, bDai } = testEnv;
    await expect(bDai.burn(deployer.address, deployer.address, "1", "1")).to.be.revertedWith(
      CT_CALLER_MUST_BE_LEND_POOL
    );
  });

  it("Tries to invoke mintToTreasury not being the Pool", async () => {
    const { deployer, users, bDai } = testEnv;
    await expect(bDai.mintToTreasury("1", "1")).to.be.revertedWith(CT_CALLER_MUST_BE_LEND_POOL);
  });

  it("Tries to invoke transferUnderlyingTo not being the Pool", async () => {
    const { deployer, bDai } = testEnv;
    await expect(bDai.transferUnderlyingTo(deployer.address, "1")).to.be.revertedWith(CT_CALLER_MUST_BE_LEND_POOL);
  });
});

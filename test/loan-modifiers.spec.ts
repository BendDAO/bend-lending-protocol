import { expect } from "chai";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { ProtocolErrors } from "../helpers/types";

makeSuite("LendPoolLoan: Modifiers", (testEnv: TestEnv) => {
  const { CT_CALLER_MUST_BE_LEND_POOL } = ProtocolErrors;

  it("Tries to invoke initNft not being the Pool", async () => {
    const { deployer, bayc, bBAYC, bWETH, loan } = testEnv;
    await expect(loan.initNft(bayc.address, bBAYC.address)).to.be.revertedWith(CT_CALLER_MUST_BE_LEND_POOL);
  });

  it("Tries to invoke createLoan not being the Pool", async () => {
    const { deployer, bayc, bBAYC, bWETH, loan } = testEnv;
    await expect(
      loan.createLoan(deployer.address, deployer.address, bayc.address, "1", bBAYC.address, bWETH.address, "1", "1")
    ).to.be.revertedWith(CT_CALLER_MUST_BE_LEND_POOL);
  });

  it("Tries to invoke updateLoan not being the Pool", async () => {
    const { deployer, bayc, bBAYC, bWETH, loan } = testEnv;
    await expect(loan.updateLoan(deployer.address, "1", "1", "0", "1")).to.be.revertedWith(CT_CALLER_MUST_BE_LEND_POOL);
  });

  it("Tries to invoke repayLoan not being the Pool", async () => {
    const { deployer, bayc, bBAYC, bWETH, loan } = testEnv;
    await expect(loan.repayLoan(deployer.address, "1", bBAYC.address, "1", "1")).to.be.revertedWith(
      CT_CALLER_MUST_BE_LEND_POOL
    );
  });

  it("Tries to invoke auctionLoan not being the Pool", async () => {
    const { deployer, bayc, bBAYC, bWETH, loan } = testEnv;
    await expect(loan.auctionLoan(deployer.address, "1", deployer.address, "1", "0", "0")).to.be.revertedWith(
      CT_CALLER_MUST_BE_LEND_POOL
    );
  });

  it("Tries to invoke redeemLoan not being the Pool", async () => {
    const { deployer, bayc, bBAYC, bWETH, loan } = testEnv;
    await expect(loan.redeemLoan(deployer.address, "1", "1", "1")).to.be.revertedWith(CT_CALLER_MUST_BE_LEND_POOL);
  });

  it("Tries to invoke liquidateLoan not being the Pool", async () => {
    const { deployer, bayc, bBAYC, bWETH, loan } = testEnv;
    await expect(loan.liquidateLoan(deployer.address, "1", bBAYC.address, "1", "1")).to.be.revertedWith(
      CT_CALLER_MUST_BE_LEND_POOL
    );
  });
});

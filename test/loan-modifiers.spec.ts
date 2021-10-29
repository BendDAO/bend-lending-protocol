import { expect } from "chai";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { ProtocolErrors } from "../helpers/types";

makeSuite("LendPoolLoan: Modifiers", (testEnv: TestEnv) => {
  const { CT_CALLER_MUST_BE_LENDING_POOL } = ProtocolErrors;

  it("Tries to invoke initNft not being the Pool", async () => {
    const { deployer, bayc, bBYAC, bWETH, loan } = testEnv;
    await expect(loan.initNft(bayc.address, bBYAC.address)).to.be.revertedWith(CT_CALLER_MUST_BE_LENDING_POOL);
  });

  it("Tries to invoke createLoan not being the Pool", async () => {
    const { deployer, bayc, bBYAC, bWETH, loan } = testEnv;
    await expect(
      loan.createLoan(deployer.address, deployer.address, bayc.address, "1", bBYAC.address, bWETH.address, "1", "1")
    ).to.be.revertedWith(CT_CALLER_MUST_BE_LENDING_POOL);
  });

  it("Tries to invoke updateLoan not being the Pool", async () => {
    const { deployer, bayc, bBYAC, bWETH, loan } = testEnv;
    await expect(loan.updateLoan(deployer.address, "1", "1", "0", "1")).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });

  it("Tries to invoke repayLoan not being the Pool", async () => {
    const { deployer, bayc, bBYAC, bWETH, loan } = testEnv;
    await expect(loan.repayLoan(deployer.address, "1", bBYAC.address)).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });

  it("Tries to invoke liquidateLoan not being the Pool", async () => {
    const { deployer, bayc, bBYAC, bWETH, loan } = testEnv;
    await expect(loan.liquidateLoan(deployer.address, "1", bBYAC.address)).to.be.revertedWith(
      CT_CALLER_MUST_BE_LENDING_POOL
    );
  });
});

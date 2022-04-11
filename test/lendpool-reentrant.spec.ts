import BigNumber from "bignumber.js";

import { DRE, increaseTime, waitForTx } from "../helpers/misc-utils";
import { APPROVAL_AMOUNT_LENDING_POOL, MAX_UINT_AMOUNT, oneEther, ONE_DAY } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { makeSuite } from "./helpers/make-suite";
import { ProtocolErrors } from "../helpers/types";
import { MaliciousHackerERC721Factory, MaliciousHackerERC721 } from "../types";
import { getDebtToken, getDeploySigner } from "../helpers/contracts-getters";

const chai = require("chai");

const { expect } = chai;

makeSuite("LendPool: Malicious Hacker Rentrant", (testEnv) => {
  let maliciousHackerErc721: MaliciousHackerERC721;

  before("Before: set config", async () => {
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    maliciousHackerErc721 = await new MaliciousHackerERC721Factory(await getDeploySigner()).deploy(
      testEnv.pool.address
    );
  });

  after("After: reset config", async () => {
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it("Malicious hacker try to reentrant (should revert)", async () => {
    const { weth, bayc, pool, users } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const user2 = users[2];
    const user3 = users[3];

    // delegates borrowing power
    await maliciousHackerErc721.approveDelegate(weth.address, borrower.address);

    // depositor mint and deposit 100 WETH
    await weth.connect(depositor.signer).mint(await convertToCurrencyDecimals(weth.address, "100"));
    await weth.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    const amountDeposit = await convertToCurrencyDecimals(weth.address, "100");
    await pool.connect(depositor.signer).deposit(weth.address, amountDeposit, depositor.address, "0");

    // borrower mint NFT and borrow 10 WETH
    await weth.connect(borrower.signer).mint(await convertToCurrencyDecimals(weth.address, "5"));
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    await bayc.connect(borrower.signer).mint("101");
    await bayc.connect(borrower.signer).setApprovalForAll(pool.address, true);
    const amountBorrow = await convertToCurrencyDecimals(weth.address, "10");
    await pool
      .connect(borrower.signer)
      .borrow(weth.address, amountBorrow.toString(), bayc.address, "101", maliciousHackerErc721.address, "0");

    // borrower repay and hacker try to do reentrant action
    console.log("hacker do reentrant action: ACTION_DEPOSIT");
    await maliciousHackerErc721.simulateAction(await maliciousHackerErc721.ACTION_DEPOSIT());
    await expect(pool.connect(borrower.signer).repay(bayc.address, "101", MAX_UINT_AMOUNT)).to.be.revertedWith(
      "ReentrancyGuard: reentrant call"
    );

    console.log("hacker do reentrant action: ACTION_WITHDRAW");
    await maliciousHackerErc721.simulateAction(await maliciousHackerErc721.ACTION_WITHDRAW());
    await expect(pool.connect(borrower.signer).repay(bayc.address, "101", MAX_UINT_AMOUNT)).to.be.revertedWith(
      "ReentrancyGuard: reentrant call"
    );

    console.log("hacker do reentrant action: ACTION_BORROW");
    await maliciousHackerErc721.simulateAction(await maliciousHackerErc721.ACTION_BORROW());
    await expect(pool.connect(borrower.signer).repay(bayc.address, "101", MAX_UINT_AMOUNT)).to.be.revertedWith(
      "ReentrancyGuard: reentrant call"
    );

    console.log("hacker do reentrant action: ACTION_REPAY");
    await maliciousHackerErc721.simulateAction(await maliciousHackerErc721.ACTION_REPAY());
    await expect(pool.connect(borrower.signer).repay(bayc.address, "101", MAX_UINT_AMOUNT)).to.be.revertedWith(
      "ReentrancyGuard: reentrant call"
    );

    console.log("hacker do reentrant action: ACTION_AUCTION");
    await maliciousHackerErc721.simulateAction(await maliciousHackerErc721.ACTION_AUCTION());
    await expect(pool.connect(borrower.signer).repay(bayc.address, "101", MAX_UINT_AMOUNT)).to.be.revertedWith(
      "ReentrancyGuard: reentrant call"
    );

    console.log("hacker do reentrant action: ACTION_REDEEM");
    await maliciousHackerErc721.simulateAction(await maliciousHackerErc721.ACTION_REDEEM());
    await expect(pool.connect(borrower.signer).repay(bayc.address, "101", MAX_UINT_AMOUNT)).to.be.revertedWith(
      "ReentrancyGuard: reentrant call"
    );

    console.log("hacker do reentrant action: ACTION_LIQUIDATE");
    await maliciousHackerErc721.simulateAction(await maliciousHackerErc721.ACTION_LIQUIDATE());
    await expect(pool.connect(borrower.signer).repay(bayc.address, "101", MAX_UINT_AMOUNT)).to.be.revertedWith(
      "ReentrancyGuard: reentrant call"
    );
  });
});

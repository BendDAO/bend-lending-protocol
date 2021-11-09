import BigNumber from "bignumber.js";

import { DRE, increaseTime } from "../helpers/misc-utils";
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { makeSuite } from "./helpers/make-suite";
import { ProtocolErrors } from "../helpers/types";

const chai = require("chai");

const { expect } = chai;

makeSuite("LendPool: Liquidation negtive test cases", (testEnv) => {
  const { INVALID_HF } = ProtocolErrors;

  before("Before liquidation: set config", () => {
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
  });

  after("After liquidation: reset config", () => {
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it("User 1 liquidate on a non-existent NFT", async () => {
    const { configurator, bayc, pool, users } = testEnv;
    const user1 = users[1];

    await expect(pool.connect(user1.signer).liquidate(bayc.address, "101")).to.be.revertedWith(
      ProtocolErrors.LP_NFT_IS_NOT_USED_AS_COLLATERAL
    );
  });

  it("User 0 deposit 10 WETH, user 1 mint NFT and borrow 10 WETH", async () => {
    const { configurator, weth, bayc, pool, users } = testEnv;
    const user0 = users[0];
    const user1 = users[1];

    // user 0 mint and deposit 10 WETH
    await weth.connect(user0.signer).mint(await convertToCurrencyDecimals(weth.address, "10"));
    await weth.connect(user0.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    const amountDeposit = await convertToCurrencyDecimals(weth.address, "10");
    await pool.connect(user0.signer).deposit(weth.address, amountDeposit, user0.address, "0");

    // user 1 mint NFT and borrow 10 WETH
    await bayc.connect(user1.signer).mint("101");
    await bayc.connect(user1.signer).setApprovalForAll(pool.address, true);
    const amountBorrow = await convertToCurrencyDecimals(weth.address, "10");
    await pool
      .connect(user1.signer)
      .borrow(weth.address, amountBorrow.toString(), bayc.address, "101", user1.address, "0");
  });

  it("User 1 liquidate on a non-active NFT", async () => {
    const { configurator, bayc, pool, users } = testEnv;
    const user1 = users[1];

    await configurator.deactivateNft(bayc.address);

    await expect(pool.connect(user1.signer).liquidate(bayc.address, "101")).to.be.revertedWith(
      ProtocolErrors.VL_NO_ACTIVE_NFT
    );

    await configurator.activateNft(bayc.address);
  });
  /* WETH liquidity and debt must be 0
  it("User 1 liquidate on a non-active Reserve", async () => {
    const { configurator, weth, bWETH, bayc, pool, users } = testEnv;
    const user0 = users[0];
    const user1 = users[1];

    console.log("WETH balanceOf", await weth.balanceOf(bWETH.address));
    await configurator.deactivateReserve(weth.address);

    await expect(
      pool.connect(user1.signer).liquidate(bayc.address, '101')
    ).to.be.revertedWith(ProtocolErrors.VL_NO_ACTIVE_RESERVE);

    await configurator.activateReserve(weth.address);
  });
  */

  it("User 1 liquidate on a loan health factor above 1", async () => {
    const { configurator, weth, bayc, pool, users } = testEnv;
    const user0 = users[0];
    const user1 = users[1];

    await expect(pool.connect(user1.signer).liquidate(bayc.address, "101")).to.be.revertedWith(
      ProtocolErrors.LP_PRICE_TOO_HIGH_TO_LIQUIDATE
    );
  });

  it("User 1 liquidate on a loan health factor below 1, but price unable to cover borrow", async () => {
    const { configurator, weth, bayc, nftOracle, pool, users } = testEnv;
    const user0 = users[0];
    const user1 = users[1];

    const baycPrice = await nftOracle.getAssetPrice(bayc.address);
    const latestTime = await nftOracle.getLatestTimestamp(bayc.address);
    await nftOracle.setAssetData(
      bayc.address,
      new BigNumber(baycPrice.toString()).multipliedBy(0.15).toFixed(0),
      latestTime.add(1),
      latestTime.add(1)
    );

    await expect(pool.connect(user1.signer).liquidate(bayc.address, "101")).to.be.revertedWith(
      ProtocolErrors.LP_PRICE_TOO_LOW_TO_LIQUIDATE
    );
  });
});

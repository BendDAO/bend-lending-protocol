import BigNumber from "bignumber.js";
import { advanceTimeAndBlock, DRE, getNowTimeInSeconds, increaseTime, waitForTx } from "../helpers/misc-utils";
import { APPROVAL_AMOUNT_LENDING_POOL, MAX_UINT_AMOUNT, oneEther, ONE_HOUR } from "../helpers/constants";
import { convertToCurrencyDecimals, convertToCurrencyUnits } from "../helpers/contracts-helpers";
import { makeSuite } from "./helpers/make-suite";
import { ProtocolErrors, ProtocolLoanState } from "../helpers/types";
import { setNftAssetPrice, setNftAssetPriceForDebt } from "./helpers/actions";
import { BigNumber as BN } from "ethers";

const chai = require("chai");

const { expect } = chai;

makeSuite("LendPool: Batch Liquidate", (testEnv) => {
  let baycInitPrice: BN;

  before("Before: set config", async () => {
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    baycInitPrice = await testEnv.nftOracle.getAssetPrice(testEnv.bayc.address);
  });

  after("After: reset config", async () => {
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });

    await setNftAssetPrice(testEnv, "BAYC", baycInitPrice.toString());
  });

  it("WETH - Borrows WETH", async () => {
    const { users, pool, reserveOracle, weth, bayc, configurator, dataProvider } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    //mints WETH to depositor
    await weth.connect(depositor.signer).mint(await convertToCurrencyDecimals(weth.address, "1000"));

    //approve protocol to access depositor wallet
    await weth.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //deposits WETH
    const amountDeposit = await convertToCurrencyDecimals(weth.address, "1000");

    await pool.connect(depositor.signer).deposit(weth.address, amountDeposit, depositor.address, "0");

    //mints BAYC to borrower
    await bayc.connect(borrower.signer).mint("101");
    await bayc.connect(borrower.signer).mint("102");

    //approve protocol to access borrower wallet
    await bayc.connect(borrower.signer).setApprovalForAll(pool.address, true);

    //borrows
    const nftColDataBefore = await pool.getNftCollateralData(bayc.address, weth.address);

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);

    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .batchBorrow(
        [weth.address, weth.address],
        [amountBorrow.toString(), amountBorrow.toString()],
        [bayc.address, bayc.address],
        ["101", "102"],
        borrower.address,
        "0"
      );
  });

  it("WETH - Drop the health factor below 1", async () => {
    const { weth, bayc, users, pool } = testEnv;

    const nftDebtDataBefore = await pool.getNftDebtData(bayc.address, "101");

    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataBefore.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "BAYC", "WETH", debAmountUnits, "80");

    const nftDebtDataAfter = await pool.getNftDebtData(bayc.address, "101");

    expect(nftDebtDataAfter.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toFixed(0),
      ProtocolErrors.VL_INVALID_HEALTH_FACTOR
    );
  });

  it("WETH - Auctions the borrow", async () => {
    const { weth, bayc, bBAYC, users, pool, dataProvider, loan } = testEnv;
    const liquidator = users[3];
    const borrower = users[1];

    //mints WETH to the liquidator
    await weth.connect(liquidator.signer).mint(await convertToCurrencyDecimals(weth.address, "1000"));

    //approve protocol to access the liquidator wallet
    await weth.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const lendPoolBalanceBefore = await weth.balanceOf(pool.address);

    const loanDataBefore = await dataProvider.getLoanDataByCollateral(bayc.address, "101");

    // accurate borrow index, increment interest to loanDataBefore.scaledAmount
    await increaseTime(100);

    const { liquidatePrice } = await pool.getNftLiquidatePrice(bayc.address, "101");
    const auctionPrice = new BigNumber(liquidatePrice.toString()).multipliedBy(1.1).toFixed(0);

    await pool
      .connect(liquidator.signer)
      .batchAuction([bayc.address, bayc.address], ["101", "102"], [auctionPrice, auctionPrice], liquidator.address);

    // check result
    const lendPoolBalanceAfter = await weth.balanceOf(pool.address);
    expect(lendPoolBalanceAfter).to.be.equal(
      lendPoolBalanceBefore.add(auctionPrice).add(auctionPrice),
      "Invalid lend pool balance after auction"
    );

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(loanDataBefore.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Auction, "Invalid loan state after auction");
  });

  it("WETH - Redeems the borrow", async () => {
    const { weth, bayc, bBAYC, users, pool, dataProvider, loan } = testEnv;
    const liquidator = users[3];
    const borrower = users[1];

    //mints WETH to the borrower
    await weth.connect(borrower.signer).mint(await convertToCurrencyDecimals(weth.address, "1000"));
    //approve protocol to access the borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const nftCfgData = await dataProvider.getNftConfigurationData(bayc.address);

    const auctionDataBefore = await pool.getNftAuctionData(bayc.address, "101");

    const loanDataBefore = await dataProvider.getLoanDataByCollateral(bayc.address, "101");

    // redeem duration
    await increaseTime(nftCfgData.redeemDuration.mul(ONE_HOUR).sub(ONE_HOUR).toNumber());

    const debtDataBeforeRedeem = await pool.getNftDebtData(bayc.address, "101");
    const repayDebtAmount = new BigNumber(debtDataBeforeRedeem.totalDebt.toString()).multipliedBy(0.6).toFixed(0);
    const bidFineAmount = new BigNumber(auctionDataBefore.bidFine.toString()).multipliedBy(1.1).toFixed(0);

    await pool
      .connect(borrower.signer)
      .batchRedeem(
        [bayc.address, bayc.address],
        ["101", "102"],
        [repayDebtAmount, repayDebtAmount],
        [bidFineAmount, bidFineAmount]
      );

    // check result
    const tokenOwner = await bayc.ownerOf("101");
    expect(tokenOwner).to.be.equal(bBAYC.address, "Invalid token owner after redeem");

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(loanDataBefore.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Active, "Invalid loan state after redeem");
  });

  it("USDC - Borrows USDC", async () => {
    const { users, pool, reserveOracle, usdc, bayc, configurator, dataProvider } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    await setNftAssetPrice(testEnv, "BAYC", baycInitPrice.toString());

    //mints USDC to depositor
    await usdc.connect(depositor.signer).mint(await convertToCurrencyDecimals(usdc.address, "200000"));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //deposits USDC
    const amountDeposit = await convertToCurrencyDecimals(usdc.address, "200000");

    await pool.connect(depositor.signer).deposit(usdc.address, amountDeposit, depositor.address, "0");

    //mints BAYC to borrower
    await bayc.connect(borrower.signer).mint("201");
    await bayc.connect(borrower.signer).mint("202");

    //uapprove protocol to access borrower wallet
    await bayc.connect(borrower.signer).setApprovalForAll(pool.address, true);

    //borrows
    const nftColDataBefore = await pool.getNftCollateralData(bayc.address, usdc.address);

    const usdcPrice = await reserveOracle.getAssetPrice(usdc.address);

    const amountBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .batchBorrow(
        [usdc.address, usdc.address],
        [amountBorrow.toString(), amountBorrow.toString()],
        [bayc.address, bayc.address],
        ["201", "202"],
        borrower.address,
        "0"
      );

    const nftDebtDataAfter = await pool.getNftDebtData(bayc.address, "201");

    expect(nftDebtDataAfter.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toFixed(0),
      ProtocolErrors.VL_INVALID_HEALTH_FACTOR
    );
  });

  it("USDC - Drop the health factor below 1", async () => {
    const { usdc, bayc, users, pool, nftOracle } = testEnv;

    const nftDebtDataBefore = await pool.getNftDebtData(bayc.address, "201");

    const debAmountUnits = await convertToCurrencyUnits(usdc.address, nftDebtDataBefore.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "BAYC", "USDC", debAmountUnits, "80");

    const nftDebtDataAfter = await pool.getNftDebtData(bayc.address, "201");

    expect(nftDebtDataAfter.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toFixed(0),
      ProtocolErrors.VL_INVALID_HEALTH_FACTOR
    );
  });

  it("USDC - Auctions the borrow", async () => {
    const { usdc, bayc, bBAYC, users, pool, dataProvider, loan } = testEnv;
    const liquidator = users[3];

    //mints USDC to the liquidator
    await usdc.connect(liquidator.signer).mint(await convertToCurrencyDecimals(usdc.address, "200000"));

    //approve protocol to access the liquidator wallet
    await usdc.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const lendpoolBalanceBefore = await usdc.balanceOf(pool.address);

    // accurate borrow index, increment interest to loanDataBefore.scaledAmount
    await increaseTime(100);

    const { liquidatePrice } = await pool.getNftLiquidatePrice(bayc.address, "201");
    const auctionPrice = new BigNumber(liquidatePrice.toString()).multipliedBy(1.1).toFixed(0);

    await pool
      .connect(liquidator.signer)
      .batchAuction([bayc.address, bayc.address], ["201", "202"], [auctionPrice, auctionPrice], liquidator.address);

    // check result
    const tokenOwner = await bayc.ownerOf("201");
    expect(tokenOwner).to.be.equal(bBAYC.address, "Invalid token owner after auction");

    const lendpoolBalanceAfter = await usdc.balanceOf(pool.address);
    expect(lendpoolBalanceAfter).to.be.equal(
      lendpoolBalanceBefore.add(auctionPrice).add(auctionPrice),
      "Invalid liquidator balance after auction"
    );

    const auctionDataAfter = await pool.getNftAuctionData(bayc.address, "201");
    expect(auctionDataAfter.bidPrice).to.be.equal(auctionPrice, "Invalid loan bid price after auction");
    expect(auctionDataAfter.bidderAddress).to.be.equal(liquidator.address, "Invalid loan bidder address after auction");

    const loanDataAfter = await dataProvider.getLoanDataByCollateral(bayc.address, "201");
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Auction, "Invalid loan state after acution");
  });

  it("USDC - Liquidates the borrow", async () => {
    const { usdc, bayc, bBAYC, users, pool, dataProvider, loan } = testEnv;
    const liquidator = users[3];

    const nftCfgData = await dataProvider.getNftConfigurationData(bayc.address);

    const loanDataBefore = await dataProvider.getLoanDataByCollateral(bayc.address, "201");

    // end auction duration
    await increaseTime(nftCfgData.auctionDuration.mul(ONE_HOUR).add(100).toNumber());

    const extraAmount = await convertToCurrencyDecimals(usdc.address, "10");
    await pool
      .connect(liquidator.signer)
      .batchLiquidate([bayc.address, bayc.address], ["201", "202"], [extraAmount, extraAmount]);

    // check result
    const tokenOwner = await bayc.ownerOf("201");
    expect(tokenOwner).to.be.equal(liquidator.address, "Invalid token owner after liquidation");

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(loanDataBefore.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");
  });
});

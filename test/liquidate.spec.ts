import BigNumber from "bignumber.js";
import { BigNumber as BN } from "ethers";
import { DRE, getNowTimeInSeconds, increaseTime, waitForTx } from "../helpers/misc-utils";
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther, ONE_DAY } from "../helpers/constants";
import { convertToCurrencyDecimals, convertToCurrencyUnits } from "../helpers/contracts-helpers";
import { makeSuite } from "./helpers/make-suite";
import { ProtocolErrors, ProtocolLoanState } from "../helpers/types";
import { getUserData } from "./helpers/utils/helpers";
import { setNftAssetPrice, setNftAssetPriceForDebt } from "./helpers/actions";

const chai = require("chai");

const { expect } = chai;

makeSuite("LendPool: Liquidation", (testEnv) => {
  let baycInitPrice: BN;

  before("Before liquidation: set config", async () => {
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    baycInitPrice = await testEnv.nftOracle.getAssetPrice(testEnv.bayc.address);
  });

  after("After liquidation: reset config", async () => {
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });

    await setNftAssetPrice(testEnv, "BAYC", baycInitPrice.toString());
  });

  it("WETH - Borrows WETH", async () => {
    const { users, pool, nftOracle, reserveOracle, weth, bayc, configurator, dataProvider } = testEnv;
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
      .borrow(weth.address, amountBorrow.toString(), bayc.address, "101", borrower.address, "0");

    const nftDebtDataAfter = await pool.getNftDebtData(bayc.address, "101");

    expect(nftDebtDataAfter.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toFixed(0),
      ProtocolErrors.VL_INVALID_HEALTH_FACTOR
    );
  });

  it("WETH - Drop the health factor below 1", async () => {
    const { weth, bayc, users, pool, nftOracle } = testEnv;
    const borrower = users[1];

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
    const { weth, bayc, bBAYC, users, pool, dataProvider } = testEnv;
    const liquidator = users[3];
    const borrower = users[1];

    //mints WETH to the liquidator
    await weth.connect(liquidator.signer).mint(await convertToCurrencyDecimals(weth.address, "1000"));

    //approve protocol to access the liquidator wallet
    await weth.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const lendpoolBalanceBefore = await weth.balanceOf(pool.address);

    const loanDataBefore = await dataProvider.getLoanDataByCollateral(bayc.address, "101");

    // accurate borrow index, increment interest to loanDataBefore.scaledAmount
    await increaseTime(100);

    const { liquidatePrice } = await pool.getNftLiquidatePrice(bayc.address, "101");
    const auctionPrice = new BigNumber(liquidatePrice.toString()).multipliedBy(1.1).toFixed(0);

    await pool.connect(liquidator.signer).auction(bayc.address, "101", auctionPrice, liquidator.address);

    // check result
    const tokenOwner = await bayc.ownerOf("101");
    expect(tokenOwner).to.be.equal(bBAYC.address, "Invalid token owner after auction");

    const lendpoolBalanceAfter = await weth.balanceOf(pool.address);
    expect(lendpoolBalanceAfter).to.be.equal(
      lendpoolBalanceBefore.add(auctionPrice),
      "Invalid liquidator balance after auction"
    );

    const auctionDataAfter = await pool.getNftAuctionData(bayc.address, "101");
    expect(auctionDataAfter.bidPrice).to.be.equal(auctionPrice, "Invalid loan bid price after auction");
    expect(auctionDataAfter.bidderAddress).to.be.equal(liquidator.address, "Invalid loan bidder address after auction");

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(loanDataBefore.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Auction, "Invalid loan state after acution");
  });

  it("WETH - Liquidates the borrow", async () => {
    const { weth, bayc, users, pool, dataProvider } = testEnv;
    const liquidator = users[3];
    const borrower = users[1];

    const nftCfgData = await dataProvider.getNftConfigurationData(bayc.address);

    const loanDataBefore = await dataProvider.getLoanDataByCollateral(bayc.address, "101");

    const ethReserveDataBefore = await dataProvider.getReserveData(weth.address);

    const userReserveDataBefore = await getUserData(pool, dataProvider, weth.address, borrower.address);

    // end auction duration
    await increaseTime(nftCfgData.auctionDuration.mul(ONE_DAY).add(100).toNumber());

    const extraAmount = await convertToCurrencyDecimals(weth.address, "1");
    await pool.connect(liquidator.signer).liquidate(bayc.address, "101", extraAmount);

    // check result
    const tokenOwner = await bayc.ownerOf("101");
    expect(tokenOwner).to.be.equal(liquidator.address, "Invalid token owner after liquidation");

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(loanDataBefore.loanId);

    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const userReserveDataAfter = await getUserData(pool, dataProvider, weth.address, borrower.address);

    const ethReserveDataAfter = await dataProvider.getReserveData(weth.address);

    const userVariableDebtAmountBeforeTx = new BigNumber(userReserveDataBefore.scaledVariableDebt).rayMul(
      new BigNumber(ethReserveDataAfter.variableBorrowIndex.toString())
    );

    // expect debt amount to be liquidated
    const expectedLiquidateAmount = new BigNumber(loanDataBefore.scaledAmount.toString()).rayMul(
      new BigNumber(ethReserveDataAfter.variableBorrowIndex.toString())
    );

    expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.almostEqual(
      userVariableDebtAmountBeforeTx.minus(expectedLiquidateAmount).toString(),
      "Invalid user debt after liquidation"
    );

    //the liquidity index of the principal reserve needs to be bigger than the index before
    expect(ethReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
      ethReserveDataBefore.liquidityIndex.toString(),
      "Invalid liquidity index"
    );

    //the principal APY after a liquidation needs to be lower than the APY before
    expect(ethReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
      ethReserveDataBefore.liquidityRate.toString(),
      "Invalid liquidity APY"
    );

    expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(ethReserveDataBefore.availableLiquidity.toString()).plus(expectedLiquidateAmount).toFixed(0),
      "Invalid principal available liquidity"
    );
  });

  it("USDC - Borrows USDC", async () => {
    const { users, pool, reserveOracle, usdc, bayc, configurator, dataProvider } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    await setNftAssetPrice(testEnv, "BAYC", baycInitPrice.toString());

    //mints USDC to depositor
    await usdc.connect(depositor.signer).mint(await convertToCurrencyDecimals(usdc.address, "100000"));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //deposits USDC
    const amountDeposit = await convertToCurrencyDecimals(usdc.address, "100000");

    await pool.connect(depositor.signer).deposit(usdc.address, amountDeposit, depositor.address, "0");

    //mints BAYC to borrower
    await bayc.connect(borrower.signer).mint("102");

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
      .borrow(usdc.address, amountBorrow.toString(), bayc.address, "102", borrower.address, "0");

    const nftDebtDataAfter = await pool.getNftDebtData(bayc.address, "102");

    expect(nftDebtDataAfter.healthFactor.toString()).to.be.bignumber.gt(
      oneEther.toFixed(0),
      ProtocolErrors.VL_INVALID_HEALTH_FACTOR
    );
  });

  it("USDC - Drop the health factor below 1", async () => {
    const { usdc, bayc, users, pool, nftOracle } = testEnv;
    const borrower = users[1];

    const nftDebtDataBefore = await pool.getNftDebtData(bayc.address, "102");

    const debAmountUnits = await convertToCurrencyUnits(usdc.address, nftDebtDataBefore.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "BAYC", "USDC", debAmountUnits, "80");

    const nftDebtDataAfter = await pool.getNftDebtData(bayc.address, "102");

    expect(nftDebtDataAfter.healthFactor.toString()).to.be.bignumber.lt(
      oneEther.toFixed(0),
      ProtocolErrors.VL_INVALID_HEALTH_FACTOR
    );
  });

  it("USDC - Auctions the borrow at first time", async () => {
    const { usdc, bayc, bBAYC, users, pool, dataProvider } = testEnv;
    const liquidator = users[3];
    const borrower = users[1];

    //mints USDC to the liquidator
    await usdc.connect(liquidator.signer).mint(await convertToCurrencyDecimals(usdc.address, "100000"));

    //approve protocol to access the liquidator wallet
    await usdc.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const lendpoolBalanceBefore = await usdc.balanceOf(pool.address);

    // accurate borrow index, increment interest to loanDataBefore.scaledAmount
    await increaseTime(100);

    const { liquidatePrice } = await pool.getNftLiquidatePrice(bayc.address, "102");
    const auctionPrice = new BigNumber(liquidatePrice.toString()).multipliedBy(1.1).toFixed(0);

    await pool.connect(liquidator.signer).auction(bayc.address, "102", auctionPrice, liquidator.address);

    // check result
    const tokenOwner = await bayc.ownerOf("102");
    expect(tokenOwner).to.be.equal(bBAYC.address, "Invalid token owner after auction");

    const lendpoolBalanceAfter = await usdc.balanceOf(pool.address);
    expect(lendpoolBalanceAfter).to.be.equal(
      lendpoolBalanceBefore.add(auctionPrice),
      "Invalid liquidator balance after auction"
    );

    const auctionDataAfter = await pool.getNftAuctionData(bayc.address, "102");
    expect(auctionDataAfter.bidPrice).to.be.equal(auctionPrice, "Invalid loan bid price after auction");
    expect(auctionDataAfter.bidderAddress).to.be.equal(liquidator.address, "Invalid loan bidder address after auction");

    const loanDataAfter = await dataProvider.getLoanDataByCollateral(bayc.address, "102");
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Auction, "Invalid loan state after acution");
  });

  it("USDC - Auctions the borrow at second time with higher price", async () => {
    const { usdc, bayc, bBAYC, users, pool, dataProvider } = testEnv;
    const liquidator3 = users[3];
    const liquidator4 = users[4];

    //mints USDC to the liquidator
    await usdc.connect(liquidator4.signer).mint(await convertToCurrencyDecimals(usdc.address, "150000"));
    //approve protocol to access the liquidator wallet
    await usdc.connect(liquidator4.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const liquidator3BalanceBefore = await usdc.balanceOf(liquidator3.address);

    const auctionDataBefore = await pool.getNftAuctionData(bayc.address, "102");

    const auctionPrice = new BigNumber(auctionDataBefore.bidPrice.toString()).multipliedBy(1.2).toFixed(0);

    await pool.connect(liquidator4.signer).auction(bayc.address, "102", auctionPrice, liquidator4.address);

    // check result
    const liquidator3BalanceAfter = await usdc.balanceOf(liquidator3.address);
    expect(liquidator3BalanceAfter).to.be.equal(
      liquidator3BalanceBefore.add(auctionDataBefore.bidPrice),
      "Invalid liquidator balance after auction"
    );

    const auctionDataAfter = await pool.getNftAuctionData(bayc.address, "102");
    expect(auctionDataAfter.bidPrice).to.be.equal(auctionPrice, "Invalid loan bid price after auction");
    expect(auctionDataAfter.bidderAddress).to.be.equal(
      liquidator4.address,
      "Invalid loan bidder address after auction"
    );

    const loanDataAfter = await dataProvider.getLoanDataByCollateral(bayc.address, "102");
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Auction, "Invalid loan state after acution");
  });

  it("USDC - Liquidates the borrow", async () => {
    const { usdc, bayc, users, pool, dataProvider } = testEnv;
    const liquidator = users[4];
    const borrower = users[1];

    const nftCfgData = await dataProvider.getNftConfigurationData(bayc.address);

    const loanDataBefore = await dataProvider.getLoanDataByCollateral(bayc.address, "102");

    const usdcReserveDataBefore = await dataProvider.getReserveData(usdc.address);

    const userReserveDataBefore = await getUserData(pool, dataProvider, usdc.address, borrower.address);

    // end auction duration
    await increaseTime(nftCfgData.auctionDuration.mul(ONE_DAY).add(100).toNumber());

    const extraAmount = await convertToCurrencyDecimals(usdc.address, "10");
    await pool.connect(liquidator.signer).liquidate(bayc.address, "102", extraAmount);

    // check result
    const tokenOwner = await bayc.ownerOf("102");
    expect(tokenOwner).to.be.equal(liquidator.address, "Invalid token owner after liquidation");

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(loanDataBefore.loanId);

    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const userReserveDataAfter = await getUserData(pool, dataProvider, usdc.address, borrower.address);

    const usdcReserveDataAfter = await dataProvider.getReserveData(usdc.address);

    const userVariableDebtAmountBeforeTx = new BigNumber(userReserveDataBefore.scaledVariableDebt).rayMul(
      new BigNumber(usdcReserveDataAfter.variableBorrowIndex.toString())
    );

    // expect debt amount to be liquidated
    const expectedLiquidateAmount = new BigNumber(loanDataBefore.scaledAmount.toString()).rayMul(
      new BigNumber(usdcReserveDataAfter.variableBorrowIndex.toString())
    );

    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.almostEqual(
      userVariableDebtAmountBeforeTx.minus(expectedLiquidateAmount).toString(),
      "Invalid user debt after liquidation"
    );

    //the liquidity index of the principal reserve needs to be bigger than the index before
    expect(usdcReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
      usdcReserveDataBefore.liquidityIndex.toString(),
      "Invalid liquidity index"
    );

    //the principal APY after a liquidation needs to be lower than the APY before
    expect(usdcReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
      usdcReserveDataBefore.liquidityRate.toString(),
      "Invalid liquidity APY"
    );

    expect(usdcReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
      new BigNumber(usdcReserveDataBefore.availableLiquidity.toString()).plus(expectedLiquidateAmount).toFixed(0),
      "Invalid principal available liquidity"
    );
  });
});

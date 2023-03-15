import BigNumber from "bignumber.js";
import { BigNumber as BN } from "ethers";
import { parseEther } from "ethers/lib/utils";

import { getReservesConfigByPool } from "../helpers/configuration";
import { MAX_UINT_AMOUNT, oneEther, ONE_HOUR } from "../helpers/constants";
import { getDebtToken } from "../helpers/contracts-getters";
import { convertToCurrencyDecimals, convertToCurrencyUnits } from "../helpers/contracts-helpers";
import { advanceBlock, advanceTimeAndBlock, increaseTime, sleep, waitForTx } from "../helpers/misc-utils";
import { BendPools, iBendPoolAssets, IReserveParams, ProtocolLoanState } from "../helpers/types";
import {
  approveERC20,
  approveERC20WrapperGateway,
  configuration as actionsConfiguration,
  deposit,
  mintERC20,
  setNftAssetPrice,
  setNftAssetPriceForDebt,
} from "./helpers/actions";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";

const chai = require("chai");
const { expect } = chai;

makeSuite("WrapperGateway-Liquidate", (testEnv: TestEnv) => {
  const zero = BN.from(0);
  let kodaInitPrice: BN;

  before("Initializing configuration", async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumber.config({
      DECIMAL_PLACES: 0,
      ROUNDING_MODE: BigNumber.ROUND_DOWN,
    });

    actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );

    kodaInitPrice = await testEnv.nftOracle.getAssetPrice(testEnv.wrappedKoda.address);
  });
  after("Reset", async () => {
    // Reset BigNumber
    BigNumber.config({
      DECIMAL_PLACES: 20,
      ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    });

    await setNftAssetPrice(testEnv, "WKODA", kodaInitPrice.toString());
  });

  it("Borrow USDC and liquidate it", async () => {
    const {
      users,
      mockOtherdeed,
      wrappedKoda,
      wrapperGateway,
      wethGateway,
      usdc,
      pool,
      dataProvider,
      reserveOracle,
      nftOracle,
    } = testEnv;

    const [depositor, borrower] = users;
    const liquidator = users[4];
    const depositUnit = "200000";
    const depositSize = await convertToCurrencyDecimals(usdc.address, "200000");

    await sleep(1000 * 1);
    await setNftAssetPrice(testEnv, "WKODA", kodaInitPrice.toString());

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(usdc.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(
      await debtToken.connect(borrower.signer).approveDelegation(wrapperGateway.address, MAX_UINT_AMOUNT)
    );

    const landId = testEnv.landIdTracker++;

    const getKodaOwner = async () => {
      return await mockOtherdeed.ownerOf(landId);
    };

    // Deposit USDC
    await mintERC20(testEnv, depositor, "USDC", depositUnit.toString());
    await approveERC20(testEnv, depositor, "USDC");
    await deposit(testEnv, depositor, "", "USDC", depositUnit.toString(), depositor.address, "success", "");

    await advanceTimeAndBlock(100);

    // mint native nft
    await waitForTx(await mockOtherdeed.connect(borrower.signer).mint(landId));
    await waitForTx(await mockOtherdeed.connect(borrower.signer).approve(wrapperGateway.address, landId));

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedKoda.address);

    await advanceTimeAndBlock(100);

    // borrow usdc, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedKoda.address, usdc.address);

    const usdcPrice = await reserveOracle.getAssetPrice(usdc.address);
    const amountBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(
      await wrapperGateway.connect(borrower.signer).borrow(usdc.address, amountBorrow, landId, borrower.address, "0")
    );

    await waitForTx(await wrappedKoda.connect(liquidator.signer).setApprovalForAll(wrapperGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedKoda.address, landId);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(usdc.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WKODA", "USDC", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedKoda.address, landId);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    await advanceTimeAndBlock(100);

    // Liquidate USDC loan
    await mintERC20(testEnv, liquidator, "USDC", depositUnit.toString());
    await approveERC20WrapperGateway(testEnv, liquidator, "USDC");

    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedKoda.address, landId);
    const liquidateAmount = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await wrapperGateway.connect(liquidator.signer).auction(landId, liquidateAmount, liquidator.address)
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_HOUR).add(100).toNumber());

    const extraAmount = await convertToCurrencyDecimals(usdc.address, "100");
    await waitForTx(await wrapperGateway.connect(liquidator.signer).liquidate(landId, extraAmount));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const kodaOwner = await getKodaOwner();
    expect(kodaOwner).to.be.equal(liquidator.address, "Invalid koda owner after liquidation");

    await advanceTimeAndBlock(100);
  });

  it("Borrow USDC and redeem it", async () => {
    const {
      users,
      mockOtherdeed,
      wrappedKoda,
      bWKoda,
      wrapperGateway,
      wethGateway,
      usdc,
      pool,
      dataProvider,
      reserveOracle,
      nftOracle,
    } = testEnv;

    const [depositor, borrower] = users;
    const liquidator = users[4];
    const depositUnit = "200000";
    const depositSize = await convertToCurrencyDecimals(usdc.address, "200000");

    await sleep(1000 * 1);
    await setNftAssetPrice(testEnv, "WKODA", kodaInitPrice.toString());

    const landId = testEnv.landIdTracker++;

    const getKodaOwner = async () => {
      return await mockOtherdeed.ownerOf(landId);
    };

    // mint native nft
    await waitForTx(await mockOtherdeed.connect(borrower.signer).mint(landId));
    await waitForTx(await mockOtherdeed.connect(borrower.signer).approve(wrapperGateway.address, landId));

    await advanceTimeAndBlock(100);

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedKoda.address);

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(usdc.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(
      await debtToken.connect(borrower.signer).approveDelegation(wrapperGateway.address, MAX_UINT_AMOUNT)
    );

    // borrow usdc, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedKoda.address, usdc.address);

    const usdcPrice = await reserveOracle.getAssetPrice(usdc.address);
    const amountBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(
      await wrapperGateway.connect(borrower.signer).borrow(usdc.address, amountBorrow, landId, borrower.address, "0")
    );

    await waitForTx(await wrappedKoda.connect(borrower.signer).setApprovalForAll(wrapperGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedKoda.address, landId);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(usdc.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WKODA", "USDC", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedKoda.address, landId);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    await advanceTimeAndBlock(100);

    // Auction loan
    await advanceTimeAndBlock(100);
    await mintERC20(testEnv, liquidator, "USDC", depositUnit.toString());
    await approveERC20WrapperGateway(testEnv, liquidator, "USDC");

    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedKoda.address, landId);
    const liquidateAmount = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await wrapperGateway.connect(liquidator.signer).auction(landId, liquidateAmount, liquidator.address)
    );

    await advanceTimeAndBlock(100);

    // Redeem loan
    await advanceTimeAndBlock(100);
    await mintERC20(testEnv, borrower, "USDC", depositUnit.toString());
    await approveERC20WrapperGateway(testEnv, borrower, "USDC");

    await increaseTime(nftCfgData.redeemDuration.mul(ONE_HOUR).sub(3600).toNumber());

    const nftDebtDataBeforeRedeem = await pool.getNftDebtData(wrappedKoda.address, landId);
    const nftAuctionDataBeforeRedeem = await pool.getNftAuctionData(wrappedKoda.address, landId);
    const repayAmount = new BigNumber(nftDebtDataBeforeRedeem.totalDebt.toString()).multipliedBy(0.51).toFixed(0);
    const bidFineAmount = new BigNumber(nftAuctionDataBeforeRedeem.bidFine.toString()).multipliedBy(1.1).toFixed(0);

    await waitForTx(await wrapperGateway.connect(borrower.signer).redeem(landId, repayAmount, bidFineAmount));

    const loanDataAfterRedeem = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfterRedeem.state).to.be.equal(ProtocolLoanState.Active, "Invalid loan state after redeem");

    const kodaOwner = await getKodaOwner();
    expect(kodaOwner).to.be.equal(wrappedKoda.address, "Invalid koda owner after redeem");

    const wkodaOwner = await wrappedKoda.ownerOf(landId);
    expect(wkodaOwner).to.be.equal(bWKoda.address, "Invalid wkoda owner after redeem");

    // Repay loan
    await advanceTimeAndBlock(100);
    await waitForTx(await wrapperGateway.connect(borrower.signer).repay(landId, MAX_UINT_AMOUNT));

    const loanDataAfterRepay = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfterRepay.state).to.be.equal(ProtocolLoanState.Repaid, "Invalid loan state after redeem");

    await advanceTimeAndBlock(100);
  });

  it("Borrow ETH and liquidate it", async () => {
    const {
      users,
      mockOtherdeed,
      wrappedKoda,
      wrapperGateway,
      weth,
      wethGateway,
      pool,
      dataProvider,
      loan,
      reserveOracle,
      nftOracle,
    } = testEnv;

    const [depositor, user] = users;
    const liquidator = users[4];
    const depositSize = parseEther("50");

    await sleep(1000 * 1);
    await setNftAssetPrice(testEnv, "WKODA", kodaInitPrice.toString());

    await advanceTimeAndBlock(100);

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    await advanceTimeAndBlock(100);

    const landId = testEnv.landIdTracker++;

    const getKodaOwner = async () => {
      return await mockOtherdeed.ownerOf(landId);
    };

    // mint native nft
    await waitForTx(await mockOtherdeed.connect(user.signer).mint(landId));
    await waitForTx(await mockOtherdeed.connect(user.signer).approve(wrapperGateway.address, landId));

    await advanceTimeAndBlock(100);

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedKoda.address);

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(weth.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(user.signer).approveDelegation(wethGateway.address, MAX_UINT_AMOUNT));

    // borrow eth, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedKoda.address, weth.address);

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);
    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(await wrapperGateway.connect(user.signer).borrowETH(amountBorrow, landId, user.address, "0"));

    await advanceTimeAndBlock(100);

    await waitForTx(await wrappedKoda.connect(liquidator.signer).setApprovalForAll(wrapperGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedKoda.address, landId);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WKODA", "WETH", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedKoda.address, landId);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Liquidate ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedKoda.address, landId);
    const liquidateAmountSend = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await wrapperGateway
        .connect(liquidator.signer)
        .auctionETH(landId, liquidator.address, { value: liquidateAmountSend })
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_HOUR).add(100).toNumber());

    const extraAmount = await convertToCurrencyDecimals(weth.address, "1");
    await waitForTx(await wrapperGateway.connect(liquidator.signer).liquidateETH(landId, { value: extraAmount }));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const kodaOwner = await getKodaOwner();
    expect(kodaOwner).to.be.equal(liquidator.address, "Invalid koda owner after liquidation");

    await advanceTimeAndBlock(100);
  });

  it("Borrow ETH and redeem it", async () => {
    const {
      users,
      mockOtherdeed,
      wrappedKoda,
      bWKoda,
      wrapperGateway,
      weth,
      wethGateway,
      pool,
      dataProvider,
      loan,
      reserveOracle,
      nftOracle,
    } = testEnv;

    const [depositor, borrower] = users;
    const liquidator = users[4];
    const depositSize = parseEther("50");

    await sleep(1000 * 1);
    await setNftAssetPrice(testEnv, "WKODA", kodaInitPrice.toString());

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    await advanceTimeAndBlock(100);

    const landId = testEnv.landIdTracker++;

    const getKodaOwner = async () => {
      return await mockOtherdeed.ownerOf(landId);
    };

    // mint native nft
    await waitForTx(await mockOtherdeed.connect(borrower.signer).mint(landId));
    await waitForTx(await mockOtherdeed.connect(borrower.signer).approve(wrapperGateway.address, landId));

    await advanceTimeAndBlock(100);

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedKoda.address);

    // borrow eth, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedKoda.address, weth.address);

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(weth.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(borrower.signer).approveDelegation(wethGateway.address, MAX_UINT_AMOUNT));

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);
    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(
      await wrapperGateway.connect(borrower.signer).borrowETH(amountBorrow, landId, borrower.address, "0")
    );

    await advanceTimeAndBlock(100);

    await waitForTx(await wrappedKoda.connect(borrower.signer).setApprovalForAll(wrapperGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedKoda.address, landId);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WKODA", "WETH", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedKoda.address, landId);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Auction ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedKoda.address, landId);
    const liquidateAmountSend = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await wrapperGateway
        .connect(liquidator.signer)
        .auctionETH(landId, liquidator.address, { value: liquidateAmountSend })
    );

    await advanceTimeAndBlock(100);

    // Redeem ETH loan with native ETH
    await increaseTime(nftCfgData.redeemDuration.mul(ONE_HOUR).sub(3600).toNumber());

    const auctionDataBeforeRedeem = await pool.getNftAuctionData(wrappedKoda.address, landId);
    const debtDataBeforeRedeem = await pool.getNftDebtData(wrappedKoda.address, landId);
    const redeemAmount = new BigNumber(debtDataBeforeRedeem.totalDebt.toString()).multipliedBy(0.51).toFixed(0);
    const bidFineAmount = new BigNumber(auctionDataBeforeRedeem.bidFine.toString()).multipliedBy(1.1).toFixed(0);
    const redeemAmountSend = new BigNumber(redeemAmount).plus(bidFineAmount).toFixed(0);
    await waitForTx(
      await wrapperGateway.connect(borrower.signer).redeemETH(landId, redeemAmount, bidFineAmount, {
        value: redeemAmountSend,
      })
    );

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Active, "Invalid loan state after redeem");

    const kodaOwner = await getKodaOwner();
    expect(kodaOwner).to.be.equal(wrappedKoda.address, "Invalid koda owner after redeem");

    const wkodaOwner = await wrappedKoda.ownerOf(landId);
    expect(wkodaOwner).to.be.equal(bWKoda.address, "Invalid wkoda owner after redeem");

    await advanceTimeAndBlock(100);

    // Repay loan
    const debtDataBeforeRepay = await pool.getNftDebtData(wrappedKoda.address, landId);
    const repayAmount = new BigNumber(debtDataBeforeRepay.totalDebt.toString()).multipliedBy(1.1).toFixed(0);
    await waitForTx(
      await wrapperGateway.connect(borrower.signer).repayETH(landId, MAX_UINT_AMOUNT, { value: repayAmount })
    );

    const loanDataAfterRepay = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfterRepay.state).to.be.equal(ProtocolLoanState.Repaid, "Invalid loan state after repay");

    await advanceTimeAndBlock(100);
  });
});

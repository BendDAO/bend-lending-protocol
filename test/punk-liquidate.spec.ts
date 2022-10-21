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
  approveERC20PunkGateway,
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

makeSuite("PunkGateway-Liquidate", (testEnv: TestEnv) => {
  const zero = BN.from(0);
  let punkInitPrice: BN;

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

    punkInitPrice = await testEnv.nftOracle.getAssetPrice(testEnv.wrappedPunk.address);
  });
  after("Reset", async () => {
    // Reset BigNumber
    BigNumber.config({
      DECIMAL_PLACES: 20,
      ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    });

    await setNftAssetPrice(testEnv, "WPUNKS", punkInitPrice.toString());
  });

  it("Borrow USDC and liquidate it", async () => {
    const {
      users,
      cryptoPunksMarket,
      wrappedPunk,
      punkGateway,
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
    await setNftAssetPrice(testEnv, "WPUNKS", punkInitPrice.toString());

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(usdc.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(borrower.signer).approveDelegation(punkGateway.address, MAX_UINT_AMOUNT));

    const punkIndex = testEnv.punkIndexTracker++;

    const getPunkOwner = async () => {
      const owner = await cryptoPunksMarket.punkIndexToAddress(punkIndex);

      return owner;
    };

    // Deposit USDC
    await mintERC20(testEnv, depositor, "USDC", depositUnit.toString());
    await approveERC20(testEnv, depositor, "USDC");
    await deposit(testEnv, depositor, "", "USDC", depositUnit.toString(), depositor.address, "success", "");

    await advanceTimeAndBlock(100);

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedPunk.address);

    await advanceTimeAndBlock(100);

    // borrow usdc, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedPunk.address, usdc.address);

    const usdcPrice = await reserveOracle.getAssetPrice(usdc.address);
    const amountBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(
      await punkGateway.connect(borrower.signer).borrow(usdc.address, amountBorrow, punkIndex, borrower.address, "0")
    );

    await waitForTx(await wrappedPunk.connect(liquidator.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(usdc.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WPUNKS", "USDC", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    await advanceTimeAndBlock(100);

    // Liquidate USDC loan
    await mintERC20(testEnv, liquidator, "USDC", depositUnit.toString());
    await approveERC20PunkGateway(testEnv, liquidator, "USDC");

    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, punkIndex);
    const liquidateAmount = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway.connect(liquidator.signer).auction(punkIndex, liquidateAmount, liquidator.address)
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_HOUR).add(100).toNumber());

    const extraAmount = await convertToCurrencyDecimals(usdc.address, "100");
    await waitForTx(await punkGateway.connect(liquidator.signer).liquidate(punkIndex, extraAmount));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const punkOwner = await getPunkOwner();
    expect(punkOwner).to.be.equal(liquidator.address, "Invalid punk owner after liquidation");

    await advanceTimeAndBlock(100);
  });

  it("Borrow USDC and redeem it", async () => {
    const {
      users,
      cryptoPunksMarket,
      wrappedPunk,
      bPUNK,
      punkGateway,
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
    await setNftAssetPrice(testEnv, "WPUNKS", punkInitPrice.toString());

    const punkIndex = testEnv.punkIndexTracker++;

    const getPunkOwner = async () => {
      const owner = await cryptoPunksMarket.punkIndexToAddress(punkIndex);
      return owner;
    };

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    await advanceTimeAndBlock(100);

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedPunk.address);

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(usdc.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(borrower.signer).approveDelegation(punkGateway.address, MAX_UINT_AMOUNT));

    // borrow usdc, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedPunk.address, usdc.address);

    const usdcPrice = await reserveOracle.getAssetPrice(usdc.address);
    const amountBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(
      await punkGateway.connect(borrower.signer).borrow(usdc.address, amountBorrow, punkIndex, borrower.address, "0")
    );

    await waitForTx(await wrappedPunk.connect(borrower.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(usdc.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WPUNKS", "USDC", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    await advanceTimeAndBlock(100);

    // Auction loan
    await advanceTimeAndBlock(100);
    await mintERC20(testEnv, liquidator, "USDC", depositUnit.toString());
    await approveERC20PunkGateway(testEnv, liquidator, "USDC");

    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, punkIndex);
    const liquidateAmount = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway.connect(liquidator.signer).auction(punkIndex, liquidateAmount, liquidator.address)
    );

    await advanceTimeAndBlock(100);

    // Redeem loan
    await advanceTimeAndBlock(100);
    await mintERC20(testEnv, borrower, "USDC", depositUnit.toString());
    await approveERC20PunkGateway(testEnv, borrower, "USDC");

    await increaseTime(nftCfgData.redeemDuration.mul(ONE_HOUR).sub(3600).toNumber());

    const nftDebtDataBeforeRedeem = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    const nftAuctionDataBeforeRedeem = await pool.getNftAuctionData(wrappedPunk.address, punkIndex);
    const repayAmount = new BigNumber(nftDebtDataBeforeRedeem.totalDebt.toString()).multipliedBy(0.51).toFixed(0);
    const bidFineAmount = new BigNumber(nftAuctionDataBeforeRedeem.bidFine.toString()).multipliedBy(1.1).toFixed(0);

    await waitForTx(await punkGateway.connect(borrower.signer).redeem(punkIndex, repayAmount, bidFineAmount));

    const loanDataAfterRedeem = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfterRedeem.state).to.be.equal(ProtocolLoanState.Active, "Invalid loan state after redeem");

    const punkOwner = await getPunkOwner();
    expect(punkOwner).to.be.equal(wrappedPunk.address, "Invalid punk owner after redeem");

    const wpunkOwner = await wrappedPunk.ownerOf(punkIndex);
    expect(wpunkOwner).to.be.equal(bPUNK.address, "Invalid wpunk owner after redeem");

    // Repay loan
    await advanceTimeAndBlock(100);
    await waitForTx(await punkGateway.connect(borrower.signer).repay(punkIndex, MAX_UINT_AMOUNT));

    const loanDataAfterRepay = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfterRepay.state).to.be.equal(ProtocolLoanState.Repaid, "Invalid loan state after redeem");

    await advanceTimeAndBlock(100);
  });

  it("Borrow ETH and liquidate it", async () => {
    const {
      users,
      cryptoPunksMarket,
      wrappedPunk,
      punkGateway,
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
    await setNftAssetPrice(testEnv, "WPUNKS", punkInitPrice.toString());

    await advanceTimeAndBlock(100);

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    await advanceTimeAndBlock(100);

    const punkIndex = testEnv.punkIndexTracker++;

    const getPunkOwner = async () => {
      const owner = await cryptoPunksMarket.punkIndexToAddress(punkIndex);

      return owner;
    };

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    await advanceTimeAndBlock(100);

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedPunk.address);

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(weth.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(user.signer).approveDelegation(wethGateway.address, MAX_UINT_AMOUNT));

    // borrow eth, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedPunk.address, weth.address);

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);
    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(await punkGateway.connect(user.signer).borrowETH(amountBorrow, punkIndex, user.address, "0"));

    await advanceTimeAndBlock(100);

    await waitForTx(await wrappedPunk.connect(liquidator.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WPUNKS", "WETH", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Liquidate ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, punkIndex);
    const liquidateAmountSend = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway
        .connect(liquidator.signer)
        .auctionETH(punkIndex, liquidator.address, { value: liquidateAmountSend })
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_HOUR).add(100).toNumber());

    const extraAmount = await convertToCurrencyDecimals(weth.address, "1");
    await waitForTx(await punkGateway.connect(liquidator.signer).liquidateETH(punkIndex, { value: extraAmount }));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const punkOwner = await getPunkOwner();
    expect(punkOwner).to.be.equal(liquidator.address, "Invalid punk owner after liquidation");

    await advanceTimeAndBlock(100);
  });

  it("Borrow ETH and redeem it", async () => {
    const {
      users,
      cryptoPunksMarket,
      wrappedPunk,
      bPUNK,
      punkGateway,
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
    await setNftAssetPrice(testEnv, "WPUNKS", punkInitPrice.toString());

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    await advanceTimeAndBlock(100);

    const punkIndex = testEnv.punkIndexTracker++;

    const getPunkOwner = async () => {
      const owner = await cryptoPunksMarket.punkIndexToAddress(punkIndex);

      return owner;
    };

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    await advanceTimeAndBlock(100);

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedPunk.address);

    // borrow eth, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedPunk.address, weth.address);

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
      await punkGateway.connect(borrower.signer).borrowETH(amountBorrow, punkIndex, borrower.address, "0")
    );

    await advanceTimeAndBlock(100);

    await waitForTx(await wrappedPunk.connect(borrower.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WPUNKS", "WETH", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Auction ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, punkIndex);
    const liquidateAmountSend = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway
        .connect(liquidator.signer)
        .auctionETH(punkIndex, liquidator.address, { value: liquidateAmountSend })
    );

    await advanceTimeAndBlock(100);

    // Redeem ETH loan with native ETH
    await increaseTime(nftCfgData.redeemDuration.mul(ONE_HOUR).sub(3600).toNumber());

    const auctionDataBeforeRedeem = await pool.getNftAuctionData(wrappedPunk.address, punkIndex);
    const debtDataBeforeRedeem = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    const redeemAmount = new BigNumber(debtDataBeforeRedeem.totalDebt.toString()).multipliedBy(0.51).toFixed(0);
    const bidFineAmount = new BigNumber(auctionDataBeforeRedeem.bidFine.toString()).multipliedBy(1.1).toFixed(0);
    const redeemAmountSend = new BigNumber(redeemAmount).plus(bidFineAmount).toFixed(0);
    await waitForTx(
      await punkGateway.connect(borrower.signer).redeemETH(punkIndex, redeemAmount, bidFineAmount, {
        value: redeemAmountSend,
      })
    );

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Active, "Invalid loan state after redeem");

    const punkOwner = await getPunkOwner();
    expect(punkOwner).to.be.equal(wrappedPunk.address, "Invalid punk owner after redeem");

    const wpunkOwner = await wrappedPunk.ownerOf(punkIndex);
    expect(wpunkOwner).to.be.equal(bPUNK.address, "Invalid wpunk owner after redeem");

    await advanceTimeAndBlock(100);

    // Repay loan
    const debtDataBeforeRepay = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    const repayAmount = new BigNumber(debtDataBeforeRepay.totalDebt.toString()).multipliedBy(1.1).toFixed(0);
    await waitForTx(
      await punkGateway.connect(borrower.signer).repayETH(punkIndex, MAX_UINT_AMOUNT, { value: repayAmount })
    );

    const loanDataAfterRepay = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfterRepay.state).to.be.equal(ProtocolLoanState.Repaid, "Invalid loan state after repay");

    await advanceTimeAndBlock(100);
  });
});

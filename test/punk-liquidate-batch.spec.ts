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

makeSuite("PunkGateway: Batch Liquidate", (testEnv: TestEnv) => {
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

  it("Batch Borrow USDC and liquidate it", async () => {
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
    const depositUnit = "400000";
    const depositSize = await convertToCurrencyDecimals(usdc.address, "400000");

    await sleep(1000 * 1);
    await setNftAssetPrice(testEnv, "WPUNKS", punkInitPrice.toString());

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(usdc.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(borrower.signer).approveDelegation(punkGateway.address, MAX_UINT_AMOUNT));

    // Deposit USDC
    await mintERC20(testEnv, depositor, "USDC", depositUnit.toString());
    await approveERC20(testEnv, depositor, "USDC");
    await deposit(testEnv, depositor, "", "USDC", depositUnit.toString(), depositor.address, "success", "");

    await advanceTimeAndBlock(100);

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(101));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(101, 0, punkGateway.address)
    );

    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(102));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(102, 0, punkGateway.address)
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
      await punkGateway
        .connect(borrower.signer)
        .batchBorrow([usdc.address, usdc.address], [amountBorrow, amountBorrow], [101, 102], borrower.address, "0")
    );

    await waitForTx(await wrappedPunk.connect(liquidator.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, 101);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(usdc.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WPUNKS", "USDC", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedPunk.address, 101);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    await advanceTimeAndBlock(100);

    // Liquidate USDC loan
    await mintERC20(testEnv, liquidator, "USDC", depositUnit.toString());
    await approveERC20PunkGateway(testEnv, liquidator, "USDC");

    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, 101);
    const liquidateAmount = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway
        .connect(liquidator.signer)
        .batchAuction([101, 102], [liquidateAmount, liquidateAmount], liquidator.address)
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_HOUR).add(100).toNumber());

    const extraAmount = await convertToCurrencyDecimals(usdc.address, "100");
    await waitForTx(
      await punkGateway.connect(liquidator.signer).batchLiquidate([101, 102], [extraAmount, extraAmount])
    );

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const punkOwner = await cryptoPunksMarket.punkIndexToAddress(101);
    expect(punkOwner).to.be.equal(liquidator.address, "Invalid punk owner after liquidation");

    await advanceTimeAndBlock(100);
  });

  it("Batch Borrow USDC and redeem it", async () => {
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
    const depositUnit = "400000";
    const depositSize = await convertToCurrencyDecimals(usdc.address, "400000");

    await sleep(1000 * 1);
    await setNftAssetPrice(testEnv, "WPUNKS", punkInitPrice.toString());

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(201));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(201, 0, punkGateway.address)
    );

    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(202));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(202, 0, punkGateway.address)
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
      await punkGateway
        .connect(borrower.signer)
        .batchBorrow([usdc.address, usdc.address], [amountBorrow, amountBorrow], [201, 202], borrower.address, "0")
    );

    await waitForTx(await wrappedPunk.connect(borrower.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, 201);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(usdc.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WPUNKS", "USDC", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedPunk.address, 201);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Auction loan
    await advanceTimeAndBlock(100);
    await mintERC20(testEnv, liquidator, "USDC", depositUnit.toString());
    await approveERC20PunkGateway(testEnv, liquidator, "USDC");

    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, 201);
    const liquidateAmount = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway
        .connect(liquidator.signer)
        .batchAuction([201, 202], [liquidateAmount, liquidateAmount], liquidator.address)
    );

    await advanceTimeAndBlock(100);

    // Redeem loan
    await advanceTimeAndBlock(100);
    await mintERC20(testEnv, borrower, "USDC", depositUnit.toString());
    await approveERC20PunkGateway(testEnv, borrower, "USDC");

    await increaseTime(nftCfgData.redeemDuration.mul(ONE_HOUR).sub(3600).toNumber());

    const nftDebtDataBeforeRedeem = await pool.getNftDebtData(wrappedPunk.address, 201);
    const nftAuctionDataBeforeRedeem = await pool.getNftAuctionData(wrappedPunk.address, 201);
    const repayAmount = new BigNumber(nftDebtDataBeforeRedeem.totalDebt.toString()).multipliedBy(0.51).toFixed(0);
    const bidFineAmount = new BigNumber(nftAuctionDataBeforeRedeem.bidFine.toString()).multipliedBy(1.1).toFixed(0);

    await waitForTx(await punkGateway.connect(borrower.signer).redeem(201, repayAmount, bidFineAmount));

    const loanDataAfterRedeem = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfterRedeem.state).to.be.equal(ProtocolLoanState.Active, "Invalid loan state after redeem");

    const punkOwner = await cryptoPunksMarket.punkIndexToAddress(201);
    expect(punkOwner).to.be.equal(wrappedPunk.address, "Invalid punk owner after redeem");

    const wpunkOwner = await wrappedPunk.ownerOf(201);
    expect(wpunkOwner).to.be.equal(bPUNK.address, "Invalid wpunk owner after redeem");

    await advanceTimeAndBlock(100);
  });

  it("Batch Borrow ETH and liquidate it", async () => {
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
    const depositSize = parseEther("100");

    await sleep(1000 * 1);
    await setNftAssetPrice(testEnv, "WPUNKS", punkInitPrice.toString());

    await advanceTimeAndBlock(100);

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    await advanceTimeAndBlock(100);

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(301));
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(301, 0, punkGateway.address)
    );

    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(302));
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(302, 0, punkGateway.address)
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

    await waitForTx(
      await punkGateway.connect(user.signer).batchBorrowETH([amountBorrow, amountBorrow], [301, 302], user.address, "0")
    );

    await advanceTimeAndBlock(100);

    await waitForTx(await wrappedPunk.connect(liquidator.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, 301);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WPUNKS", "WETH", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedPunk.address, 301);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Liquidate ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, 301);
    const bidPrice = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    const liquidateAmountSend = bidPrice.mul(2);
    await waitForTx(
      await punkGateway
        .connect(liquidator.signer)
        .batchAuctionETH([301, 302], [bidPrice, bidPrice], liquidator.address, { value: liquidateAmountSend })
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_HOUR).add(100).toNumber());

    const extraAmount = await convertToCurrencyDecimals(weth.address, "1");
    await waitForTx(await punkGateway.connect(liquidator.signer).liquidateETH(301, { value: extraAmount }));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const punkOwner = await await cryptoPunksMarket.punkIndexToAddress(301);
    expect(punkOwner).to.be.equal(liquidator.address, "Invalid punk owner after liquidation");

    await advanceTimeAndBlock(100);
  });

  it("Batch Borrow ETH and redeem it", async () => {
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

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(401));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(401, 0, punkGateway.address)
    );

    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(402));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(402, 0, punkGateway.address)
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
      await punkGateway
        .connect(borrower.signer)
        .batchBorrowETH([amountBorrow, amountBorrow], [401, 402], borrower.address, "0")
    );

    await advanceTimeAndBlock(100);

    await waitForTx(await wrappedPunk.connect(borrower.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, 401);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataAfterBorrow.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "WPUNKS", "WETH", debAmountUnits, "80");
    const nftDebtDataAfterOracle = await pool.getNftDebtData(wrappedPunk.address, 401);
    expect(nftDebtDataAfterOracle.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Auction ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, 401);
    const bidPrice = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    const liquidateAmountSend = bidPrice.mul(2);
    await waitForTx(
      await punkGateway
        .connect(liquidator.signer)
        .batchAuctionETH([401, 402], [bidPrice, bidPrice], liquidator.address, { value: liquidateAmountSend })
    );

    await advanceTimeAndBlock(100);

    // Redeem ETH loan with native ETH
    await increaseTime(nftCfgData.redeemDuration.mul(ONE_HOUR).sub(3600).toNumber());

    const auctionDataBeforeRedeem = await pool.getNftAuctionData(wrappedPunk.address, 401);
    const debtDataBeforeRedeem = await pool.getNftDebtData(wrappedPunk.address, 401);
    const redeemAmount = new BigNumber(debtDataBeforeRedeem.totalDebt.toString()).multipliedBy(0.51).toFixed(0);
    const bidFineAmount = new BigNumber(auctionDataBeforeRedeem.bidFine.toString()).multipliedBy(1.1).toFixed(0);
    const redeemAmountSend = new BigNumber(redeemAmount).plus(bidFineAmount).multipliedBy(2).toFixed(0);
    await waitForTx(
      await punkGateway
        .connect(borrower.signer)
        .batchRedeemETH([401, 402], [redeemAmount, redeemAmount], [bidFineAmount, bidFineAmount], {
          value: redeemAmountSend,
        })
    );

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Active, "Invalid loan state after redeem");

    const punkOwner = await await cryptoPunksMarket.punkIndexToAddress(401);
    expect(punkOwner).to.be.equal(wrappedPunk.address, "Invalid punk owner after redeem");

    const wpunkOwner = await wrappedPunk.ownerOf(401);
    expect(wpunkOwner).to.be.equal(bPUNK.address, "Invalid wpunk owner after redeem");

    await advanceTimeAndBlock(100);
  });
});

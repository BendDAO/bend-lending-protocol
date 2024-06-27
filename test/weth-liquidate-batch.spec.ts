import BigNumber from "bignumber.js";
import { BigNumber as BN, BigNumberish } from "ethers";
import { parseEther } from "ethers/lib/utils";
import DRE from "hardhat";

import { getReservesConfigByPool } from "../helpers/configuration";
import { MAX_UINT_AMOUNT, oneEther, ONE_HOUR } from "../helpers/constants";
import { convertToCurrencyDecimals, convertToCurrencyUnits } from "../helpers/contracts-helpers";
import { advanceBlock, advanceTimeAndBlock, getNowTimeInSeconds, increaseTime, waitForTx } from "../helpers/misc-utils";
import { BendPools, iBendPoolAssets, IReserveParams, ProtocolLoanState } from "../helpers/types";
import {
  configuration as actionsConfiguration,
  mintERC721,
  setApprovalForAll,
  setApprovalForAllWETHGateway,
  setNftAssetPrice,
  setNftAssetPriceForDebt,
} from "./helpers/actions";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { getLoanData, getNftAddressFromSymbol } from "./helpers/utils/helpers";
import { getDebtToken } from "../helpers/contracts-getters";

const chai = require("chai");
const { expect } = chai;

makeSuite("WETHGateway - Batch Liquidate", (testEnv: TestEnv) => {
  let baycInitPrice: BN;
  let depositSize: BigNumberish;

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

    baycInitPrice = await testEnv.nftOracle.getAssetPrice(testEnv.bayc.address);
    depositSize = new BigNumber(baycInitPrice.toString()).multipliedBy(2).toFixed(0);
  });
  after("Reset configuration", async () => {
    // Reset BigNumber
    BigNumber.config({
      DECIMAL_PLACES: 20,
      ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    });

    await setNftAssetPrice(testEnv, "BAYC", baycInitPrice.toString());
  });

  it("Batch Borrow ETH and Liquidate it", async () => {
    const { users, wethGateway, pool, loan, reserveOracle, nftOracle, weth, bWETH, bayc, dataProvider } = testEnv;
    const depositor = users[0];
    const user = users[1];
    const user3 = users[3];
    const liquidator = users[4];

    {
      const latestTime = await getNowTimeInSeconds();
      await waitForTx(await nftOracle.setAssetData(bayc.address, baycInitPrice));
    }

    // Deposit with native ETH
    console.log("depositETH:", depositSize);
    await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize });

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(weth.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(user.signer).approveDelegation(wethGateway.address, MAX_UINT_AMOUNT));

    await advanceTimeAndBlock(100);

    // Start loan
    const nftAsset = await getNftAddressFromSymbol("BAYC");
    await mintERC721(testEnv, user, "BAYC", "101");
    await mintERC721(testEnv, user, "BAYC", "102");
    await setApprovalForAll(testEnv, user, "BAYC");
    await setApprovalForAllWETHGateway(testEnv, user, "BAYC");

    const nftCfgData = await dataProvider.getNftConfigurationData(nftAsset);

    const nftColDataBefore = await pool.getNftCollateralData(nftAsset, weth.address);

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);
    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await advanceTimeAndBlock(100);

    // Borrow with NFT
    console.log("batchBorrowETH:", amountBorrow);
    await waitForTx(
      await wethGateway
        .connect(user.signer)
        .batchBorrowETH([amountBorrow, amountBorrow], [nftAsset, nftAsset], [101, 102], user.address, "0")
    );
    const nftDebtDataAfterBorrow = await pool.getNftDebtData(bayc.address, 101);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const nftDebtDataBefore = await pool.getNftDebtData(bayc.address, 101);
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataBefore.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "BAYC", "WETH", debAmountUnits, "80");

    const nftDebtDataBeforeAuction = await pool.getNftDebtData(bayc.address, 101);
    expect(nftDebtDataBeforeAuction.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    await advanceTimeAndBlock(100);

    // Liquidate ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(bayc.address, 101);
    const bidPrice = new BigNumber(liquidatePrice.toString()).multipliedBy(1.05).toFixed(0);
    const liquidateAmountSend = new BigNumber(bidPrice).multipliedBy(2.0).toFixed();
    console.log("batchAuctionETH:", liquidatePrice.toString(), bidPrice);
    await waitForTx(
      await wethGateway
        .connect(liquidator.signer)
        .batchAuctionETH([nftAsset, nftAsset], [101, 102], [bidPrice, bidPrice], liquidator.address, {
          value: liquidateAmountSend,
        })
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_HOUR).add(100).toNumber());

    await increaseTime(new BigNumber(ONE_HOUR).multipliedBy(365).toNumber()); // accrue more interest, debt exceed bid price

    const loanDataBeforeLiquidate = await dataProvider.getLoanDataByCollateral(nftAsset, 101);
    let extraAmount = new BigNumber(0);
    if (loanDataBeforeLiquidate.currentAmount.gt(loanDataBeforeLiquidate.bidPrice)) {
      extraAmount = new BigNumber(
        loanDataBeforeLiquidate.currentAmount.sub(loanDataBeforeLiquidate.bidPrice).toString()
      ).multipliedBy(1.1);
    }
    console.log("batchLiquidateETH:", "extraAmount:", extraAmount.toFixed(0));
    await waitForTx(
      await wethGateway
        .connect(liquidator.signer)
        .batchLiquidateETH([nftAsset, nftAsset], [101, 102], [extraAmount.toFixed(0), extraAmount.toFixed(0)], {
          value: extraAmount.toFixed(0),
        })
    );

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataBeforeAuction.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const tokenOwner = await bayc.ownerOf(101);
    expect(tokenOwner).to.be.equal(liquidator.address, "Invalid token owner after liquidation");

    await advanceTimeAndBlock(100);
  });

  it("Batch Borrow ETH and Redeem it", async () => {
    const { users, wethGateway, pool, loan, reserveOracle, nftOracle, weth, bWETH, bayc, bBAYC, dataProvider } =
      testEnv;
    const depositor = users[0];
    const user = users[1];
    const user3 = users[3];
    const liquidator = users[4];

    await setNftAssetPrice(testEnv, "BAYC", baycInitPrice.toString());

    // Deposit with native ETH
    await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize });

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(weth.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(user.signer).approveDelegation(wethGateway.address, MAX_UINT_AMOUNT));

    await advanceTimeAndBlock(100);

    // Start loan
    const nftAsset = await getNftAddressFromSymbol("BAYC");
    await mintERC721(testEnv, user, "BAYC", "201");
    await mintERC721(testEnv, user, "BAYC", "202");
    await setApprovalForAll(testEnv, user, "BAYC");
    await setApprovalForAllWETHGateway(testEnv, user, "BAYC");

    const nftCfgData = await dataProvider.getNftConfigurationData(nftAsset);

    const nftColDataBefore = await pool.getNftCollateralData(nftAsset, weth.address);

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);
    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await advanceTimeAndBlock(100);

    // Borrow with NFT
    console.log("batchBorrowETH:", amountBorrow);
    await waitForTx(
      await wethGateway
        .connect(user.signer)
        .batchBorrowETH([amountBorrow, amountBorrow], [nftAsset, nftAsset], [201, 202], user.address, "0")
    );
    const nftDebtDataAfterBorrow = await pool.getNftDebtData(bayc.address, 201);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const nftDebtDataBefore = await pool.getNftDebtData(bayc.address, 201);
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataBefore.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "BAYC", "WETH", debAmountUnits, "80");

    const nftDebtDataBeforeAuction = await pool.getNftDebtData(bayc.address, 201);
    expect(nftDebtDataBeforeAuction.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    await advanceTimeAndBlock(100);

    // Liquidate ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(bayc.address, 201);
    const bidPrice = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    const liquidateAmountSend = bidPrice.mul(2);
    console.log("batchAuctionETH:", liquidatePrice, bidPrice);
    await waitForTx(
      await wethGateway
        .connect(liquidator.signer)
        .batchAuctionETH([nftAsset, nftAsset], [201, 202], [bidPrice, bidPrice], liquidator.address, {
          value: liquidateAmountSend,
        })
    );

    // Redeem ETH loan with native ETH
    await increaseTime(nftCfgData.auctionDuration.mul(ONE_HOUR).sub(100).toNumber());
    const auctionData = await pool.getNftAuctionData(nftAsset, 201);
    const bidFineAmount = new BigNumber(auctionData.bidFine.toString()).multipliedBy(1.1).toFixed(0);
    const repayAmount = new BigNumber(auctionData.bidBorrowAmount.toString()).multipliedBy(0.51).toFixed(0);
    const redeemAmountSend = new BigNumber(repayAmount).plus(bidFineAmount).multipliedBy(2.0).toFixed(0);
    console.log("batchRedeemETH:", redeemAmountSend.toString());
    await waitForTx(
      await wethGateway
        .connect(user.signer)
        .batchRedeemETH([nftAsset, nftAsset], [201, 202], [repayAmount, repayAmount], [bidFineAmount, bidFineAmount], {
          value: redeemAmountSend,
        })
    );

    const loanDataAfterRedeem = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfterRedeem.state).to.be.equal(ProtocolLoanState.Active, "Invalid loan state after redeem");

    const tokenOwnerAfterRedeem = await bayc.ownerOf(201);
    expect(tokenOwnerAfterRedeem).to.be.equal(bBAYC.address, "Invalid token owner after redeem");

    await advanceTimeAndBlock(100);
  });
});

import BigNumber from "bignumber.js";
import { BigNumber as BN } from "ethers";
import { parseEther } from "ethers/lib/utils";
import DRE from "hardhat";

import { getReservesConfigByPool } from "../helpers/configuration";
import { MAX_UINT_AMOUNT, oneEther, ONE_DAY } from "../helpers/constants";
import { deploySelfdestructTransferMock } from "../helpers/contracts-deployments";
import { convertToCurrencyDecimals, convertToCurrencyUnits } from "../helpers/contracts-helpers";
import { getNowTimeInSeconds, increaseTime, waitForTx } from "../helpers/misc-utils";
import { BendPools, iBendPoolAssets, IReserveParams, ProtocolLoanState } from "../helpers/types";
import {
  borrow,
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
import { NETWORKS_DEFAULT_GAS } from "../helper-hardhat-config";

const chai = require("chai");
const { expect } = chai;

makeSuite("WETHGateway - Liquidate", (testEnv: TestEnv) => {
  let baycInitPrice: BN;

  const zero = BN.from(0);
  const depositSize = parseEther("5");
  const depositSize500 = parseEther("500");
  const GAS_PRICE = NETWORKS_DEFAULT_GAS[DRE.network.name];

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
  });
  after("Reset", () => {
    // Reset BigNumber
    BigNumber.config({
      DECIMAL_PLACES: 20,
      ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    });
  });

  it("Borrow ETH and Liquidate it", async () => {
    const { users, wethGateway, pool, loan, reserveOracle, nftOracle, weth, bWETH, bayc, dataProvider } = testEnv;
    const depositor = users[0];
    const user = users[1];
    const user3 = users[3];
    const liquidator = users[4];

    {
      const latestTime = await getNowTimeInSeconds();
      await waitForTx(await nftOracle.setAssetData(bayc.address, baycInitPrice, latestTime, latestTime));
    }

    // Deposit with native ETH
    await wethGateway.connect(user3.signer).depositETH(user.address, "0", { value: depositSize500 });

    // Start loan
    const nftAsset = await getNftAddressFromSymbol("BAYC");
    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, user, "BAYC", tokenId);
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

    // Borrow with NFT
    await waitForTx(
      await wethGateway.connect(user.signer).borrowETH(amountBorrow, nftAsset, tokenId, user.address, "0")
    );
    const nftDebtDataAfterBorrow = await pool.getNftDebtData(bayc.address, tokenId);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const nftDebtDataBefore = await pool.getNftDebtData(bayc.address, tokenId);
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataBefore.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "BAYC", "WETH", debAmountUnits, "80");

    const nftDebtDataBeforeAuction = await pool.getNftDebtData(bayc.address, tokenId);
    expect(nftDebtDataBeforeAuction.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Liquidate ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(bayc.address, tokenId);
    const liquidateAmountSend = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await wethGateway
        .connect(liquidator.signer)
        .auctionETH(nftAsset, tokenId, liquidator.address, { value: liquidateAmountSend })
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_DAY).add(100).toNumber());

    await waitForTx(await wethGateway.connect(liquidator.signer).liquidateETH(nftAsset, tokenId));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataBeforeAuction.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const tokenOwner = await bayc.ownerOf(tokenId);
    expect(tokenOwner).to.be.equal(liquidator.address, "Invalid token owner after liquidation");
  });

  it("Borrow ETH and Redeem it", async () => {
    const { users, wethGateway, pool, loan, reserveOracle, nftOracle, weth, bWETH, bayc, dataProvider } = testEnv;
    const depositor = users[0];
    const user = users[1];
    const user3 = users[3];
    const liquidator = users[4];

    await setNftAssetPrice(testEnv, "BAYC", baycInitPrice.toString());

    // Deposit with native ETH
    await wethGateway.connect(user3.signer).depositETH(user.address, "0", { value: depositSize500 });

    // Start loan
    const nftAsset = await getNftAddressFromSymbol("BAYC");
    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, user, "BAYC", tokenId);
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

    // Borrow with NFT
    await waitForTx(
      await wethGateway.connect(user.signer).borrowETH(amountBorrow, nftAsset, tokenId, user.address, "0")
    );
    const nftDebtDataAfterBorrow = await pool.getNftDebtData(bayc.address, tokenId);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const nftDebtDataBefore = await pool.getNftDebtData(bayc.address, tokenId);
    const debAmountUnits = await convertToCurrencyUnits(weth.address, nftDebtDataBefore.totalDebt.toString());
    await setNftAssetPriceForDebt(testEnv, "BAYC", "WETH", debAmountUnits, "80");

    const nftDebtDataBeforeAuction = await pool.getNftDebtData(bayc.address, tokenId);
    expect(nftDebtDataBeforeAuction.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Liquidate ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(bayc.address, tokenId);
    const liquidateAmountSend = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await wethGateway
        .connect(liquidator.signer)
        .auctionETH(nftAsset, tokenId, liquidator.address, { value: liquidateAmountSend })
    );

    // Redeem ETH loan with native ETH
    await increaseTime(nftCfgData.auctionDuration.mul(ONE_DAY).sub(100).toNumber());
    const auctionData = await pool.getNftAuctionData(nftAsset, tokenId);
    const redeemAmountSend = auctionData.bidBorrowAmount.add(auctionData.bidFine);
    await waitForTx(await wethGateway.connect(user.signer).redeemETH(nftAsset, tokenId, { value: redeemAmountSend }));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after redeem");

    const tokenOwner = await bayc.ownerOf(tokenId);
    expect(tokenOwner).to.be.equal(user.address, "Invalid token owner after redeem");
  });
});

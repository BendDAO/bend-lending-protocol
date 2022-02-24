import {
  auction,
  configuration as actionsConfiguration,
  increaseAuctionDuration,
  increaseRedeemDuration,
  liquidate,
  redeem,
  setNftAssetPrice,
  setNftAssetPriceForDebt,
} from "./helpers/actions";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";

import BigNumber from "bignumber.js";
import { makeSuite } from "./helpers/make-suite";
import { getReservesConfigByPool } from "../helpers/configuration";
import { BendPools, iBendPoolAssets, IReserveParams } from "../helpers/types";

import {
  mintERC20,
  mintERC721,
  approveERC20,
  approveERC721,
  setApprovalForAll,
  deposit,
  borrow,
  withdraw,
  repay,
} from "./helpers/actions";
import { increaseTime, waitForTx } from "../helpers/misc-utils";
import { convertToCurrencyUnits } from "../helpers/contracts-helpers";

const { expect } = require("chai");

makeSuite("Subgraph tests", async (testEnv) => {
  let saveBaycAssetPrice: string;

  before("Initializing configuration", async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );

    saveBaycAssetPrice = (await testEnv.nftOracle.getAssetPrice(testEnv.bayc.address)).toString();
  });
  after("Reset", () => {
    // Reset BigNumber
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it("deposit-withdraw", async () => {
    const { users } = testEnv;
    const depositor = users[0];

    await mintERC20(testEnv, depositor, "WETH", "100");
    await approveERC20(testEnv, depositor, "WETH");

    await deposit(testEnv, depositor, "", "WETH", "100", depositor.address, "success", "");

    await increaseTime(100);

    await withdraw(testEnv, depositor, "WETH", "10", "success", "");
  });

  it("borrow-repay", async () => {
    const { users } = testEnv;
    const borrower = users[1];

    await mintERC20(testEnv, borrower, "WETH", "100");
    await approveERC20(testEnv, borrower, "WETH");

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    await borrow(testEnv, borrower, "WETH", "5", "BAYC", tokenId, borrower.address, "365", "success", "");

    await increaseTime(100);

    await borrow(testEnv, borrower, "WETH", "2", "BAYC", tokenId, borrower.address, "365", "success", "");

    await increaseTime(100);

    await repay(testEnv, borrower, "", "BAYC", tokenId, "3", borrower, "success", "");

    await increaseTime(100);

    await repay(testEnv, borrower, "", "BAYC", tokenId, "-1", borrower, "success", "");
  });

  it("borrow-auction-redeem", async () => {
    const { users, pool, weth, bayc } = testEnv;
    const borrower = users[1];
    const liquidator = users[2];

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    await borrow(testEnv, borrower, "WETH", "10", "BAYC", tokenId, borrower.address, "365", "success", "");

    await increaseTime(100);

    // auction
    await mintERC20(testEnv, liquidator, "WETH", "100");
    await approveERC20(testEnv, liquidator, "WETH");

    const { oldNftPrice, newNftPrice } = await setNftAssetPriceForDebt(testEnv, "BAYC", "WETH", "10", "95");
    const auctionPrice = new BigNumber(newNftPrice).multipliedBy(1.1).toFixed(0);
    const auctionAmount = await convertToCurrencyUnits(weth.address, auctionPrice);

    await auction(testEnv, liquidator, "BAYC", tokenId, auctionAmount.toString(), liquidator, true, "success", "");

    await increaseRedeemDuration(testEnv, "BAYC", false);

    // redeem
    await mintERC20(testEnv, borrower, "WETH", "100");
    await approveERC20(testEnv, borrower, "WETH");

    await redeem(testEnv, borrower, "BAYC", tokenId, "-1", "success", "");
  });

  it("borrow-auction-liquidate", async () => {
    const { users, pool, weth } = testEnv;
    const borrower = users[1];
    const liquidator = users[2];

    await setNftAssetPrice(testEnv, "BAYC", saveBaycAssetPrice);

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    await borrow(testEnv, borrower, "WETH", "10", "BAYC", tokenId, borrower.address, "365", "success", "");

    await increaseTime(100);

    // auction
    await mintERC20(testEnv, liquidator, "WETH", "100");
    await approveERC20(testEnv, liquidator, "WETH");

    const { oldNftPrice, newNftPrice } = await setNftAssetPriceForDebt(testEnv, "BAYC", "WETH", "10", "95");
    const auctionPrice = new BigNumber(newNftPrice).multipliedBy(1.1).toFixed(0);
    const auctionAmount = await convertToCurrencyUnits(weth.address, auctionPrice);

    await auction(testEnv, liquidator, "BAYC", tokenId, auctionAmount.toString(), liquidator, true, "success", "");

    await increaseAuctionDuration(testEnv, "BAYC", true);

    // liquidate
    await liquidate(testEnv, liquidator, "BAYC", tokenId, "0", "success", "");
  });
});

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

import { mintERC20, mintERC721, approveERC20, setApprovalForAll, deposit, borrow } from "./helpers/actions";
import { advanceTimeAndBlock, increaseTime, waitForTx } from "../helpers/misc-utils";
import { convertToCurrencyUnits } from "../helpers/contracts-helpers";
import { getEmergencyAdminSigner } from "../helpers/contracts-getters";

const { expect } = require("chai");

makeSuite("Liquidate: Pause", async (testEnv) => {
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

  it("borrow-auction-redeem", async () => {
    const { users, pool, weth, configurator } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const liquidator = users[2];
    const liquidatorB = users[3];
    const emAdmin = await getEmergencyAdminSigner();

    console.log("deposit");
    await mintERC20(testEnv, depositor, "WETH", "100");
    await approveERC20(testEnv, depositor, "WETH");

    await deposit(testEnv, depositor, "", "WETH", "100", depositor.address, "success", "");

    console.log("borrow");
    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    await borrow(testEnv, borrower, "WETH", "10", "BAYC", tokenId, borrower.address, "365", "success", "");

    await advanceTimeAndBlock(100);

    // auction
    console.log("auction");
    await mintERC20(testEnv, liquidator, "WETH", "100");
    await approveERC20(testEnv, liquidator, "WETH");

    const { oldNftPrice, newNftPrice } = await setNftAssetPriceForDebt(testEnv, "BAYC", "WETH", "10", "95");
    const auctionPrice = new BigNumber(newNftPrice).multipliedBy(1.1).toFixed(0);
    const auctionAmount = await convertToCurrencyUnits(weth.address, auctionPrice);

    await auction(testEnv, liquidator, "BAYC", tokenId, auctionAmount.toString(), liquidator, true, "success", "");

    // remain 1 hour to redeem
    await increaseRedeemDuration(testEnv, "BAYC", false);

    // pause
    console.log("pause and unpause the pool");
    await waitForTx(await configurator.connect(emAdmin).setPoolPause(true));

    await advanceTimeAndBlock(24 * 3600);

    await waitForTx(await configurator.connect(emAdmin).setPoolPause(false));

    const pausedTime = await pool.getPausedTime();
    expect(pausedTime[1]).to.be.gte(24 * 3600, "Invalid paused duration time after unpuase");

    // auction by liquidator B
    await mintERC20(testEnv, liquidatorB, "WETH", "100");
    await approveERC20(testEnv, liquidatorB, "WETH");
    const auctionAmountB = new BigNumber(auctionAmount).multipliedBy(1.2).toFixed(0);
    await auction(testEnv, liquidatorB, "BAYC", tokenId, auctionAmountB, liquidator, true, "success", "");

    // redeem
    console.log("redeem");
    await mintERC20(testEnv, borrower, "WETH", "100");
    await approveERC20(testEnv, borrower, "WETH");

    await redeem(testEnv, borrower, "BAYC", tokenId, "-1", "success", "");
  });

  it("borrow-auction-liquidate", async () => {
    const { users, pool, weth, configurator } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const liquidator = users[2];
    const liquidatorB = users[3];
    const emAdmin = await getEmergencyAdminSigner();

    await setNftAssetPrice(testEnv, "BAYC", saveBaycAssetPrice);

    console.log("deposit");
    await mintERC20(testEnv, depositor, "WETH", "100");
    await approveERC20(testEnv, depositor, "WETH");

    console.log("borrow");
    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    await borrow(testEnv, borrower, "WETH", "10", "BAYC", tokenId, borrower.address, "365", "success", "");

    await advanceTimeAndBlock(100);

    // auction
    console.log("auction");
    await mintERC20(testEnv, liquidator, "WETH", "100");
    await approveERC20(testEnv, liquidator, "WETH");

    const { oldNftPrice, newNftPrice } = await setNftAssetPriceForDebt(testEnv, "BAYC", "WETH", "10", "95");
    const auctionPrice = new BigNumber(newNftPrice).multipliedBy(1.1).toFixed(0);
    const auctionAmount = await convertToCurrencyUnits(weth.address, auctionPrice);

    await auction(testEnv, liquidator, "BAYC", tokenId, auctionAmount.toString(), liquidator, true, "success", "");

    await increaseAuctionDuration(testEnv, "BAYC", false);

    // pause
    console.log("pause and unpause the pool");
    await waitForTx(await configurator.connect(emAdmin).setPoolPause(true));

    await advanceTimeAndBlock(24 * 3600);

    await waitForTx(await configurator.connect(emAdmin).setPoolPause(false));

    const pausedTime = await pool.getPausedTime();
    expect(pausedTime[1]).to.be.gte(24 * 3600, "Invalid paused duration time after unpuase");

    // auction by liquidator B
    await mintERC20(testEnv, liquidatorB, "WETH", "100");
    await approveERC20(testEnv, liquidatorB, "WETH");

    await advanceTimeAndBlock(100);

    const auctionAmountB = new BigNumber(auctionAmount).multipliedBy(1.2).toFixed(0);
    await auction(testEnv, liquidatorB, "BAYC", tokenId, auctionAmountB, liquidator, true, "success", "");

    await advanceTimeAndBlock(3600);

    // liquidate
    console.log("liquidate");
    await liquidate(testEnv, liquidator, "BAYC", tokenId, "0", "success", "");
  });
});

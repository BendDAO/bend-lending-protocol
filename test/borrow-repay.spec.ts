import { TestEnv, makeSuite } from "./helpers/make-suite";
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
import { configuration as actionsConfiguration } from "./helpers/actions";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import BigNumber from "bignumber.js";
import { getReservesConfigByPool } from "../helpers/configuration";
import { BendPools, iBendPoolAssets, IReserveParams } from "../helpers/types";
import { string } from "hardhat/internal/core/params/argumentTypes";

const { expect } = require("chai");

makeSuite("LendPool: Borrow/repay test cases", (testEnv: TestEnv) => {
  let cachedTokenId;

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
  });
  after("Reset", () => {
    // Reset BigNumber
    BigNumber.config({
      DECIMAL_PLACES: 20,
      ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    });
  });

  it("User 2 deposits 1 WETH to account for rounding errors", async () => {
    const { users } = testEnv;
    const user2 = users[2];

    await mintERC20(testEnv, user2, "WETH", "1");

    await approveERC20(testEnv, user2, "WETH");

    await deposit(testEnv, user2, "", "WETH", "1", user2.address, "success", "");
  });

  it("User 0 deposits 1000 WETH, user 1 uses 1 NFT as collateral and borrows 10 WETH", async () => {
    const { users } = testEnv;
    const user0 = users[0];
    const user1 = users[1];

    await mintERC20(testEnv, user0, "WETH", "1000");

    await approveERC20(testEnv, user0, "WETH");

    await deposit(testEnv, user0, "", "WETH", "1000", user0.address, "success", "");

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, user1, "BAYC", tokenId);

    await setApprovalForAll(testEnv, user1, "BAYC");

    await borrow(testEnv, user1, "WETH", "10", "BAYC", tokenId, user1.address, "365", "success", "");

    cachedTokenId = tokenId;
  });

  it("User 1 tries to borrow the rest of the WETH liquidity (revert expected)", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    const tokenId = cachedTokenId;

    await borrow(
      testEnv,
      user1,
      "WETH",
      "990",
      "BAYC",
      tokenId,
      user1.address,
      "365",
      "revert",
      "There is not enough collateral to cover a new borrow"
    );
  });

  it("User 1 tries to repay 0 WETH (revert expected)", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    const tokenId = cachedTokenId;

    await repay(testEnv, user1, "", "BAYC", tokenId, "0", user1, "revert", "Amount must be greater than 0");
  });

  it("User 1 repays a small amount of WETH, enough to cover a small part of the interest", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    const tokenId = cachedTokenId;

    await approveERC20(testEnv, user1, "WETH");

    await repay(testEnv, user1, "", "BAYC", tokenId, "1.25", user1, "success", "");
  });
});

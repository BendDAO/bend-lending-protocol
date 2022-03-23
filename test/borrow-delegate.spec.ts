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
  delegateBorrowAllowance,
} from "./helpers/actions";
import { configuration as actionsConfiguration } from "./helpers/actions";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import BigNumber from "bignumber.js";
import { getReservesConfigByPool } from "../helpers/configuration";
import { BendPools, iBendPoolAssets, IReserveParams } from "../helpers/types";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { waitForTx } from "../helpers/misc-utils";

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

  it("Delegatee try to Borrow WETH to different onBehalf", async () => {
    const { users, bayc } = testEnv;
    const depositor = users[1];
    const borrower = users[2];
    const delegatee = users[3];

    // WETH
    await mintERC20(testEnv, depositor, "WETH", "10");

    await approveERC20(testEnv, depositor, "WETH");

    await deposit(testEnv, depositor, "", "WETH", "10", depositor.address, "success", "");

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId);
    await bayc.connect(borrower.signer).transferFrom(borrower.address, delegatee.address, tokenId);

    await setApprovalForAll(testEnv, delegatee, "BAYC");

    await borrow(
      testEnv,
      delegatee,
      "WETH",
      "1",
      "BAYC",
      tokenId,
      borrower.address,
      "365",
      "revert",
      "no borrow allowance"
    );

    await delegateBorrowAllowance(testEnv, borrower, "WETH", "1", delegatee.address, "success", "");

    await borrow(testEnv, delegatee, "WETH", "1", "BAYC", tokenId, borrower.address, "365", "success", "");
  });
});

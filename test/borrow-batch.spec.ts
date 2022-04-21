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
import { parseEther } from "ethers/lib/utils";

const { expect } = require("chai");

makeSuite("LendPool: Batch borrow test cases", (testEnv: TestEnv) => {
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

  it("Batch Borrow WETH using many NFTs", async () => {
    const { users, weth, bayc, pool } = testEnv;
    const depositor = users[1];
    const borrower = users[2];

    // WETH
    await mintERC20(testEnv, depositor, "WETH", "10");

    await approveERC20(testEnv, depositor, "WETH");

    await deposit(testEnv, depositor, "", "WETH", "10", depositor.address, "success", "");

    // mint NFTs
    const tokenId1 = (testEnv.tokenIdTracker++).toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId1);

    const tokenId2 = (testEnv.tokenIdTracker++).toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId2);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    const userBalanceBeforeBorrow = await weth.balanceOf(borrower.address);

    // batch borrow
    const borrowAmount1 = parseEther("1");
    const borrowAmount2 = parseEther("2");
    await waitForTx(
      await pool
        .connect(borrower.signer)
        .batchBorrow(
          [weth.address, weth.address],
          [borrowAmount1, borrowAmount2],
          [bayc.address, bayc.address],
          [tokenId1, tokenId2],
          borrower.address,
          "0"
        )
    );

    const userBalanceAfterBorrow = await weth.balanceOf(borrower.address);
    expect(userBalanceAfterBorrow, "current weth balance shoud increase").to.be.eq(
      userBalanceBeforeBorrow.add(borrowAmount1).add(borrowAmount2)
    );
  });
});

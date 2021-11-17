import { configuration as actionsConfiguration } from "./helpers/actions";
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
import { waitForTx } from "../helpers/misc-utils";

const { expect } = require("chai");

makeSuite("Subgraph tests", async (testEnv) => {
  before("Initializing configuration", async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );
  });
  after("Reset", () => {
    // Reset BigNumber
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it("deposit-borrow", async () => {
    const { users } = testEnv;
    const user0 = users[0];
    const user1 = users[1];

    await mintERC20(testEnv, user0, "WETH", "100");

    await approveERC20(testEnv, user0, "WETH");

    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());

    await deposit(testEnv, user0, "", "WETH", "100", user0.address, "success", "");

    const checkResult1 = await testEnv.mockIncentivesController.checkHandleActionIsCalled();
    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());
    expect(checkResult1).to.be.equal(true, "IncentivesController not called");

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, user1, "BAYC", tokenId);

    await setApprovalForAll(testEnv, user1, "BAYC");

    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());

    await borrow(testEnv, user1, "WETH", "1", "BAYC", tokenId, user1.address, "365", "success", "");

    const checkResult2 = await testEnv.mockIncentivesController.checkHandleActionIsCalled();
    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());
    expect(checkResult2).to.be.equal(true, "IncentivesController not called");
  });
});

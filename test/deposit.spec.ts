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
import { waitForTx } from "../helpers/misc-utils";

const { expect } = require("chai");

makeSuite("LendPool: Deposit", (testEnv: TestEnv) => {
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

  it("User 0 Deposits 1000 DAI in an empty reserve", async () => {
    const { users } = testEnv;
    const user0 = users[0];

    await mintERC20(testEnv, user0, "DAI", "1000");

    await approveERC20(testEnv, user0, "DAI");

    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());

    await deposit(testEnv, user0, "", "DAI", "1000", user0.address, "success", "");

    const checkResult = await testEnv.mockIncentivesController.checkHandleActionIsCalled();
    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());
    expect(checkResult).to.be.equal(true, "IncentivesController not called");
  });

  it("User 1 deposits 1000 DAI after user 0", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    await mintERC20(testEnv, user1, "DAI", "1000");

    await approveERC20(testEnv, user1, "DAI");

    await deposit(testEnv, user1, "", "DAI", "1000", user1.address, "success", "");
  });

  it("User 0 deposits 1000 USDC in an empty reserve", async () => {
    const { users } = testEnv;
    const user0 = users[1];

    await mintERC20(testEnv, user0, "USDC", "1000");

    await approveERC20(testEnv, user0, "USDC");

    await deposit(testEnv, user0, "", "USDC", "1000", user0.address, "success", "");
  });

  it("User 1 deposits 1000 USDC after user 0", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    await mintERC20(testEnv, user1, "USDC", "1000");

    await approveERC20(testEnv, user1, "USDC");

    await deposit(testEnv, user1, "", "USDC", "1000", user1.address, "success", "");
  });

  it("User 0 deposits 1 WETH in an empty reserve", async () => {
    const { users } = testEnv;
    const user0 = users[0];

    await mintERC20(testEnv, user0, "WETH", "1");

    await approveERC20(testEnv, user0, "WETH");

    await deposit(testEnv, user0, "", "WETH", "1", user0.address, "success", "");
  });

  it("User 1 deposits 1 WETH after user 0", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    await mintERC20(testEnv, user1, "WETH", "1");

    await approveERC20(testEnv, user1, "WETH");

    await deposit(testEnv, user1, "", "WETH", "1", user1.address, "success", "");
  });

  it("User 1 deposits 0 WETH (revert expected)", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    await mintERC20(testEnv, user1, "WETH", "1");

    await deposit(testEnv, user1, "", "WETH", "0", user1.address, "revert", "Amount must be greater than 0");
  });

  it("User 1 deposits 0 DAI (revert expected)", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    await mintERC20(testEnv, user1, "DAI", "1");

    await deposit(testEnv, user1, "", "DAI", "0", user1.address, "revert", "Amount must be greater than 0");
  });

  it("User 1 deposits 100 DAI on behalf of user 2, user 2 tries to borrow 0.01 WETH", async () => {
    const { users } = testEnv;
    const user1 = users[1];
    const user2 = users[2];

    await mintERC20(testEnv, user1, "DAI", "100");

    await deposit(testEnv, user1, "", "DAI", "100", user2.address, "success", "");

    await mintERC721(testEnv, user2, "BAYC", "101");

    await setApprovalForAll(testEnv, user2, "BAYC");

    await borrow(testEnv, user2, "WETH", "0.01", "BAYC", "101", user2.address, "", "success", "");
  });
});

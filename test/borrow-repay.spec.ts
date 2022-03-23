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

  it("User 2 deposits 1 WETH and 1000 DAI to account for rounding errors", async () => {
    const { users } = testEnv;
    const user2 = users[2];

    // WETH
    await mintERC20(testEnv, user2, "WETH", "1");

    await approveERC20(testEnv, user2, "WETH");

    await deposit(testEnv, user2, "", "WETH", "1", user2.address, "success", "");

    // DAI
    await mintERC20(testEnv, user2, "DAI", "1000");

    await approveERC20(testEnv, user2, "DAI");

    await deposit(testEnv, user2, "", "DAI", "1000", user2.address, "success", "");
  });

  it("User 0 deposits 100 WETH, user 1 uses NFT as collateral and borrows 1 WETH", async () => {
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

    cachedTokenId = tokenId;
  });

  it("User 1 uses existed collateral and borrows more 100 DAI (revert expected)", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await borrow(
      testEnv,
      user1,
      "DAI",
      "200",
      "BAYC",
      tokenId,
      user1.address,
      "365",
      "revert",
      "The reserve must be same"
    );
  });

  it("User 1 uses existed collateral and borrows more 2 WETH", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await borrow(testEnv, user1, "WETH", "2", "BAYC", tokenId, user1.address, "365", "success", "");

    const checkResult = await testEnv.mockIncentivesController.checkHandleActionIsCalled();
    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());
    expect(checkResult).to.be.equal(true, "IncentivesController not called");
  });

  it("User 1 tries to borrow the rest of the WETH liquidity (revert expected)", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await borrow(
      testEnv,
      user1,
      "WETH",
      "97",
      "BAYC",
      tokenId,
      user1.address,
      "",
      "revert",
      "There is not enough collateral to cover a new borrow"
    );
  });

  it("User 1 tries to repay 0 WETH (revert expected)", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await repay(testEnv, user1, "", "BAYC", tokenId, "0", user1, "revert", "Amount must be greater than 0");
  });

  it("User 1 repays 0.5 WETH, enough to cover a small part of the interest", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await approveERC20(testEnv, user1, "WETH");

    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());

    await repay(testEnv, user1, "", "BAYC", tokenId, "0.5", user1, "success", "");

    const checkResult = await testEnv.mockIncentivesController.checkHandleActionIsCalled();
    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());
    expect(checkResult).to.be.equal(true, "IncentivesController not called");
  });

  it("User 1 repays all WETH borrow after one year", async () => {
    const { users } = testEnv;
    const user1 = users[1];

    await mintERC20(testEnv, user1, "WETH", "10");

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await approveERC20(testEnv, user1, "WETH");

    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());

    await repay(testEnv, user1, "", "BAYC", tokenId, "-1", user1, "success", "");

    const checkResult = await testEnv.mockIncentivesController.checkHandleActionIsCalled();
    await waitForTx(await testEnv.mockIncentivesController.resetHandleActionIsCalled());
    expect(checkResult).to.be.equal(true, "IncentivesController not called");
  });

  it("User 0 withdraws the deposited WETH plus interest", async () => {
    const { users } = testEnv;
    const user0 = users[0];

    await withdraw(testEnv, user0, "WETH", "-1", "success", "");
  });

  it("User 1 deposits 1 USDC to account for rounding errors", async () => {
    const { users } = testEnv;
    const user2 = users[2];

    await mintERC20(testEnv, user2, "USDC", "1");

    await approveERC20(testEnv, user2, "USDC");

    await deposit(testEnv, user2, "", "USDC", "1", user2.address, "success", "");
  });

  it("User 1 deposits 1000 USDC, user 3 uses not owned NFT as collateral and borrows 10 USDC", async () => {
    const { users } = testEnv;
    const user1 = users[1];
    const user2 = users[2];
    const user3 = users[3];

    await mintERC20(testEnv, user1, "USDC", "1000");

    await approveERC20(testEnv, user1, "USDC");

    await deposit(testEnv, user1, "", "USDC", "100", user1.address, "success", "");

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, user2, "BAYC", tokenId);

    await setApprovalForAll(testEnv, user2, "BAYC");

    await borrow(testEnv, user3, "USDC", "10", "BAYC", tokenId, user3.address, "", "revert", "NFT is not owned");

    cachedTokenId = tokenId;
  });

  it("user 2 uses owned NFT as collateral on behalf of user 3 and borrows 10 USDC", async () => {
    const { users } = testEnv;
    const user2 = users[2];
    const user3 = users[3];

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await delegateBorrowAllowance(testEnv, user3, "USDC", "10", user2.address, "success", "");

    await borrow(testEnv, user2, "USDC", "10", "BAYC", tokenId, user3.address, "365", "success", "");
  });

  it("user 2 uses existed collateral on behalf of user 3 and borrows more 20 USDC", async () => {
    const { users } = testEnv;
    const user2 = users[2];
    const user3 = users[3];

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await delegateBorrowAllowance(testEnv, user3, "USDC", "20", user2.address, "success", "");

    await borrow(testEnv, user2, "USDC", "20", "BAYC", tokenId, user3.address, "365", "success", "");
  });

  it("user 3 repay 10 USDC, a fraction of borrow amount", async () => {
    const { users } = testEnv;
    const user2 = users[2];
    const user3 = users[3];

    await mintERC20(testEnv, user3, "USDC", "1000");

    await approveERC20(testEnv, user3, "USDC");

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await repay(testEnv, user3, "", "BAYC", tokenId, "10", user3, "success", "");
  });

  it("user 3 repay all USDC, full of borrow amount", async () => {
    const { users } = testEnv;
    const user2 = users[2];
    const user3 = users[3];

    await mintERC20(testEnv, user3, "USDC", "1000");

    await approveERC20(testEnv, user3, "USDC");

    expect(cachedTokenId, "previous test case is faild").to.not.be.undefined;
    const tokenId = cachedTokenId;

    await repay(testEnv, user3, "", "BAYC", tokenId, "-1", user3, "success", "");
  });
});

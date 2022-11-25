import { expect } from "chai";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { BendPools, iBendPoolAssets, IReserveParams, ProtocolErrors } from "../helpers/types";
import { advanceTimeAndBlock, waitForTx } from "../helpers/misc-utils";
import { MockLoanRepaidInterceptor, MockLoanRepaidInterceptorFactory } from "../types";
import { approveERC20, borrow, deposit, mintERC20, mintERC721, repay, setApprovalForAll } from "./helpers/actions";
import BigNumber from "bignumber.js";
import { configuration as actionsConfiguration } from "./helpers/actions";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { getReservesConfigByPool } from "../helpers/configuration";

makeSuite("LendPoolLoan: Token Interceptor", (testEnv: TestEnv) => {
  const { LP_CALLER_NOT_LEND_POOL_CONFIGURATOR, LP_CALLER_NOT_VALID_INTERCEPTOR } = ProtocolErrors;

  let mockLoanRepaidInterceptor: MockLoanRepaidInterceptor;
  let mockLoanRepaidInterceptor2: MockLoanRepaidInterceptor;

  before("Before: set config", async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );

    mockLoanRepaidInterceptor = await new MockLoanRepaidInterceptorFactory(testEnv.deployer.signer).deploy(
      testEnv.addressesProvider.address
    );

    mockLoanRepaidInterceptor2 = await new MockLoanRepaidInterceptorFactory(testEnv.deployer.signer).deploy(
      testEnv.addressesProvider.address
    );
  });
  after("After: reset config", () => {
    // Reset BigNumber
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it("Tries to invoke approve interceptor not being the Configurator", async () => {
    const { loan, pool } = testEnv;
    await expect(loan.approveLoanRepaidInterceptor(pool.address, true)).to.be.revertedWith(
      LP_CALLER_NOT_LEND_POOL_CONFIGURATOR
    );
  });

  it("Tries to invoke purge interceptor not being the Configurator", async () => {
    const { loan, pool, bayc } = testEnv;
    await expect(loan.purgeLoanRepaidInterceptor(bayc.address, [], pool.address)).to.be.revertedWith(
      LP_CALLER_NOT_LEND_POOL_CONFIGURATOR
    );
  });

  it("Tries to invoke add interceptor not being the Interceptor", async () => {
    const { bayc, pool, loan } = testEnv;
    await expect(loan.addLoanRepaidInterceptor(bayc.address, 100)).to.be.revertedWith(LP_CALLER_NOT_VALID_INTERCEPTOR);
  });

  it("Tries to invoke delete interceptor not being the Interceptor", async () => {
    const { bayc, pool, loan } = testEnv;
    await expect(loan.deleteLoanRepaidInterceptor(bayc.address, 100)).to.be.revertedWith(
      LP_CALLER_NOT_VALID_INTERCEPTOR
    );
  });

  it("Interceptor add and delete some tokens", async () => {
    const { bayc, pool, loan, configurator } = testEnv;
    const tokenId = testEnv.tokenIdTracker++;

    await waitForTx(await configurator.approveLoanRepaidInterceptor(mockLoanRepaidInterceptor.address, true));

    await waitForTx(await mockLoanRepaidInterceptor.addLoanRepaidInterceptor(bayc.address, tokenId));
    const checkInterceptors1 = await loan.getLoanRepaidInterceptors(bayc.address, tokenId);
    expect(checkInterceptors1.length).eq(1);
    expect(checkInterceptors1[0]).eq(mockLoanRepaidInterceptor.address);

    await waitForTx(await mockLoanRepaidInterceptor.deleteLoanRepaidInterceptor(bayc.address, tokenId));
    const checkInterceptors2 = await loan.getLoanRepaidInterceptors(bayc.address, tokenId);
    expect(checkInterceptors2.length).eq(0);
  });

  it("Configurator forcedly purge token interceptors", async () => {
    const { bayc, pool, loan, configurator } = testEnv;
    const tokenId = testEnv.tokenIdTracker++;

    await waitForTx(await configurator.approveLoanRepaidInterceptor(mockLoanRepaidInterceptor.address, true));

    await waitForTx(await mockLoanRepaidInterceptor.addLoanRepaidInterceptor(bayc.address, tokenId));
    const checkInterceptors1 = await loan.getLoanRepaidInterceptors(bayc.address, tokenId);
    expect(checkInterceptors1.length).eq(1);
    expect(checkInterceptors1[0]).eq(mockLoanRepaidInterceptor.address);

    await waitForTx(
      await configurator.purgeLoanRepaidInterceptor(bayc.address, [tokenId], mockLoanRepaidInterceptor.address)
    );
    const checkInterceptors2 = await loan.getLoanRepaidInterceptors(bayc.address, tokenId);
    expect(checkInterceptors2.length).eq(0);
  });

  it("Multiple Interceptors configure diff tokens", async () => {
    const { bayc, pool, loan, configurator } = testEnv;

    const tokenId1 = testEnv.tokenIdTracker++;
    const tokenId2 = testEnv.tokenIdTracker++;

    await waitForTx(await configurator.approveLoanRepaidInterceptor(mockLoanRepaidInterceptor.address, true));
    await waitForTx(await configurator.approveLoanRepaidInterceptor(mockLoanRepaidInterceptor2.address, true));

    await waitForTx(await mockLoanRepaidInterceptor.addLoanRepaidInterceptor(bayc.address, tokenId1));
    await waitForTx(await mockLoanRepaidInterceptor2.addLoanRepaidInterceptor(bayc.address, tokenId2));

    const checkInterceptors1 = await loan.getLoanRepaidInterceptors(bayc.address, tokenId1);
    expect(checkInterceptors1.length).eq(1);
    expect(checkInterceptors1[0]).eq(mockLoanRepaidInterceptor.address);

    const checkInterceptors2 = await loan.getLoanRepaidInterceptors(bayc.address, tokenId2);
    expect(checkInterceptors2.length).eq(1);
    expect(checkInterceptors2[0]).eq(mockLoanRepaidInterceptor2.address);
  });

  it("Multiple Interceptors configure same tokens", async () => {
    const { bayc, pool, loan, configurator } = testEnv;
    const tokenId = testEnv.tokenIdTracker++;

    await waitForTx(await configurator.approveLoanRepaidInterceptor(mockLoanRepaidInterceptor.address, true));
    await waitForTx(await configurator.approveLoanRepaidInterceptor(mockLoanRepaidInterceptor2.address, true));

    await waitForTx(await mockLoanRepaidInterceptor.addLoanRepaidInterceptor(bayc.address, tokenId));
    await waitForTx(await mockLoanRepaidInterceptor2.addLoanRepaidInterceptor(bayc.address, tokenId));

    const checkInterceptors1 = await loan.getLoanRepaidInterceptors(bayc.address, tokenId);
    expect(checkInterceptors1.length).eq(2);
    expect(checkInterceptors1[1]).eq(mockLoanRepaidInterceptor2.address);

    await waitForTx(await mockLoanRepaidInterceptor.deleteLoanRepaidInterceptor(bayc.address, tokenId));
    const checkInterceptors2 = await loan.getLoanRepaidInterceptors(bayc.address, tokenId);
    expect(checkInterceptors2.length).eq(1);
    expect(checkInterceptors2[0]).eq(mockLoanRepaidInterceptor2.address);

    await waitForTx(await mockLoanRepaidInterceptor.addLoanRepaidInterceptor(bayc.address, tokenId));
  });

  it("Multiple Interceptors for borrow and repay", async () => {
    const { users, configurator, bayc } = testEnv;
    const depositor = users[0];
    const borrower = users[1];

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();

    await waitForTx(await mockLoanRepaidInterceptor.addLoanRepaidInterceptor(bayc.address, tokenId));
    await waitForTx(await mockLoanRepaidInterceptor2.addLoanRepaidInterceptor(bayc.address, tokenId));

    console.log("depositor do mint erc20 and deposit");
    await mintERC20(testEnv, depositor, "WETH", "100");
    await approveERC20(testEnv, depositor, "WETH");
    await deposit(testEnv, depositor, "", "WETH", "100", depositor.address, "success", "");

    console.log("borrower do mint erc20");
    await mintERC20(testEnv, borrower, "WETH", "100");
    await approveERC20(testEnv, borrower, "WETH");

    console.log("borrower do mint erc721");
    await mintERC721(testEnv, borrower, "BAYC", tokenId);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    console.log("borrower do borrow");
    await borrow(testEnv, borrower, "WETH", "5", "BAYC", tokenId, borrower.address, "365", "success", "");

    await advanceTimeAndBlock(100);

    await waitForTx(await mockLoanRepaidInterceptor.resetCallState());
    await waitForTx(await mockLoanRepaidInterceptor2.resetCallState());

    console.log("borrower do repay");
    await repay(testEnv, borrower, "", "BAYC", tokenId, "-1", borrower, "success", "");

    await advanceTimeAndBlock(100);

    const isBeforeHookCalled = await mockLoanRepaidInterceptor.isBeforeHookCalled();
    expect(isBeforeHookCalled).eq(true);
    const isAfterHookCalled = await mockLoanRepaidInterceptor.isAfterHookCalled();
    expect(isAfterHookCalled).eq(true);

    const isBeforeHookCalled2 = await mockLoanRepaidInterceptor2.isBeforeHookCalled();
    expect(isBeforeHookCalled2).eq(true);
    const isAfterHookCalled2 = await mockLoanRepaidInterceptor2.isAfterHookCalled();
    expect(isAfterHookCalled2).eq(true);
  });
});

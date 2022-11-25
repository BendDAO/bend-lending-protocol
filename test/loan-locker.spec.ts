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

makeSuite("LendPoolLoan: Token Locker", (testEnv: TestEnv) => {
  const { LP_CALLER_NOT_LEND_POOL_CONFIGURATOR, LP_CALLER_NOT_VALID_LOCKER } = ProtocolErrors;
  let mockFlashLoanLocker: MockLoanRepaidInterceptor;

  before("Before: set config", async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );

    mockFlashLoanLocker = await new MockLoanRepaidInterceptorFactory(testEnv.deployer.signer).deploy(
      testEnv.addressesProvider.address
    );
  });
  after("After: reset config", () => {
    // Reset BigNumber
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it("Tries to invoke approve locker not being the Configurator", async () => {
    const { loan, pool } = testEnv;
    await expect(loan.approveFlashLoanLocker(pool.address, true)).to.be.revertedWith(
      LP_CALLER_NOT_LEND_POOL_CONFIGURATOR
    );
  });

  it("Tries to invoke purge locker not being the Configurator", async () => {
    const { loan, pool, bayc } = testEnv;
    await expect(loan.purgeFlashLoanLocking(bayc.address, [], pool.address)).to.be.revertedWith(
      LP_CALLER_NOT_LEND_POOL_CONFIGURATOR
    );
  });

  it("Tries to invoke locking not being the Interceptor", async () => {
    const { bayc, pool, loan } = testEnv;
    await expect(loan.setFlashLoanLocking(bayc.address, 100, true)).to.be.revertedWith(LP_CALLER_NOT_VALID_LOCKER);
  });

  it("Locker add and delete some tokens", async () => {
    const { bayc, bBAYC, loan, configurator } = testEnv;
    const tokenId = testEnv.tokenIdTracker++;

    await waitForTx(await configurator.approveFlashLoanLocker(mockFlashLoanLocker.address, true));

    await waitForTx(await mockFlashLoanLocker.setFlashLoanLocking(bayc.address, tokenId, true));

    await waitForTx(await mockFlashLoanLocker.setFlashLoanLocking(bayc.address, tokenId, false));
  });

  it("Configurator forcedly purge token lockers", async () => {
    const { bayc, pool, loan, configurator } = testEnv;
    const tokenId = testEnv.tokenIdTracker++;

    await waitForTx(await configurator.approveFlashLoanLocker(mockFlashLoanLocker.address, true));

    await waitForTx(await mockFlashLoanLocker.setFlashLoanLocking(bayc.address, tokenId, true));

    await waitForTx(await configurator.purgeFlashLoanLocking(bayc.address, [tokenId], mockFlashLoanLocker.address));
  });
});

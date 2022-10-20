import { expect } from "chai";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { ProtocolErrors } from "../helpers/types";
import { waitForTx } from "../helpers/misc-utils";
import { MockTokenInterceptor, MockTokenInterceptorFactory } from "../types";

makeSuite("LendPoolLoan: Token Interceptor", (testEnv: TestEnv) => {
  const { LP_CALLER_NOT_LEND_POOL_CONFIGURATOR, LP_CALLER_NOT_VALID_INTERCEPTOR } = ProtocolErrors;

  let mockTokenInterceptor: MockTokenInterceptor;

  before("Before liquidation: set config", async () => {
    mockTokenInterceptor = await new MockTokenInterceptorFactory(testEnv.deployer.signer).deploy(testEnv.loan.address);
  });

  it("Tries to invoke approveTokenInterceptor not being the Configurator", async () => {
    const { loan, pool } = testEnv;
    await expect(loan.approveTokenInterceptor(pool.address, true)).to.be.revertedWith(
      LP_CALLER_NOT_LEND_POOL_CONFIGURATOR
    );
  });

  it("Tries to invoke purgeTokenInterceptor not being the Configurator", async () => {
    const { loan, pool, bBAYC } = testEnv;
    await expect(loan.purgeTokenInterceptor(bBAYC.address, [], pool.address)).to.be.revertedWith(
      LP_CALLER_NOT_LEND_POOL_CONFIGURATOR
    );
  });

  it("Tries to invoke addTokenInterceptor not being the Interceptor", async () => {
    const { bBAYC, pool, loan } = testEnv;
    await expect(loan.addTokenInterceptor(bBAYC.address, 100)).to.be.revertedWith(LP_CALLER_NOT_VALID_INTERCEPTOR);
  });

  it("Tries to invoke deleteTokenInterceptor not being the Interceptor", async () => {
    const { bBAYC, pool, loan } = testEnv;
    await expect(loan.deleteTokenInterceptor(bBAYC.address, 100)).to.be.revertedWith(LP_CALLER_NOT_VALID_INTERCEPTOR);
  });

  it("Interceptor add and delete some tokens", async () => {
    const { bBAYC, pool, loan, configurator } = testEnv;

    await waitForTx(await configurator.approveTokenInterceptor(mockTokenInterceptor.address, true));

    await waitForTx(await mockTokenInterceptor.addTokenInterceptor(bBAYC.address, 100));
    const checkInterceptors1 = await bBAYC.getTokenInterceptors(loan.address, 100);
    expect(checkInterceptors1.length).eq(1);
    expect(checkInterceptors1[0]).eq(mockTokenInterceptor.address);

    await waitForTx(await mockTokenInterceptor.deleteTokenInterceptor(bBAYC.address, 100));
    const checkInterceptors2 = await bBAYC.getTokenInterceptors(loan.address, 100);
    expect(checkInterceptors2.length).eq(0);
  });

  it("Configurator forcedly purge token interceptors", async () => {
    const { bBAYC, pool, loan, configurator } = testEnv;

    await waitForTx(await configurator.approveTokenInterceptor(mockTokenInterceptor.address, true));

    await waitForTx(await mockTokenInterceptor.addTokenInterceptor(bBAYC.address, 100));
    const checkInterceptors1 = await bBAYC.getTokenInterceptors(loan.address, 100);
    expect(checkInterceptors1.length).eq(1);
    expect(checkInterceptors1[0]).eq(mockTokenInterceptor.address);

    await waitForTx(await configurator.purgeTokenInterceptor(bBAYC.address, [100], mockTokenInterceptor.address));
    const checkInterceptors2 = await bBAYC.getTokenInterceptors(loan.address, 100);
    expect(checkInterceptors2.length).eq(0);
  });
});

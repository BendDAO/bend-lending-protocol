import { TestEnv, makeSuite } from "./helpers/make-suite";
import { APPROVAL_AMOUNT_LENDING_POOL, RAY } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { ProtocolErrors } from "../helpers/types";
import { strategyWETH } from "../markets/bend/reservesConfigs";

const { expect } = require("chai");

makeSuite("Configurator-Reserve", (testEnv: TestEnv) => {
  const {
    CALLER_NOT_POOL_ADMIN,
    LPC_RESERVE_LIQUIDITY_NOT_0,
    RC_INVALID_LTV,
    RC_INVALID_LIQ_THRESHOLD,
    RC_INVALID_LIQ_BONUS,
    RC_INVALID_DECIMALS,
    RC_INVALID_RESERVE_FACTOR,
  } = ProtocolErrors;

  it("Reverts trying to set an invalid reserve factor", async () => {
    const { configurator, weth } = testEnv;

    const invalidReserveFactor = 65536;

    await expect(configurator.setReserveFactor(weth.address, invalidReserveFactor)).to.be.revertedWith(
      RC_INVALID_RESERVE_FACTOR
    );
  });

  it("Deactivates the ETH reserve", async () => {
    const { configurator, weth, dataProvider } = testEnv;
    await configurator.deactivateReserve(weth.address);
    const { isActive } = await dataProvider.getReserveConfigurationData(weth.address);
    expect(isActive).to.be.equal(false);
  });

  it("Rectivates the ETH reserve", async () => {
    const { configurator, weth, dataProvider } = testEnv;
    await configurator.activateReserve(weth.address);

    const { isActive } = await dataProvider.getReserveConfigurationData(weth.address);
    expect(isActive).to.be.equal(true);
  });

  it("Check the onlyAdmin on deactivateReserve ", async () => {
    const { configurator, users, weth } = testEnv;
    await expect(
      configurator.connect(users[2].signer).deactivateReserve(weth.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Check the onlyAdmin on activateReserve ", async () => {
    const { configurator, users, weth } = testEnv;
    await expect(
      configurator.connect(users[2].signer).activateReserve(weth.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Freezes the ETH reserve", async () => {
    const { configurator, weth, dataProvider } = testEnv;

    await configurator.freezeReserve(weth.address);
    const { decimals, reserveFactor, borrowingEnabled, isActive, isFrozen } =
      await dataProvider.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(true);
    expect(decimals).to.be.equal(strategyWETH.reserveDecimals);
    expect(reserveFactor).to.be.equal(strategyWETH.reserveFactor);
  });

  it("Unfreezes the ETH reserve", async () => {
    const { configurator, dataProvider, weth } = testEnv;
    await configurator.unfreezeReserve(weth.address);

    const { decimals, reserveFactor, borrowingEnabled, isActive, isFrozen } =
      await dataProvider.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWETH.reserveDecimals);
    expect(reserveFactor).to.be.equal(strategyWETH.reserveFactor);
  });

  it("Check the onlyAdmin on freezeReserve ", async () => {
    const { configurator, users, weth } = testEnv;
    await expect(
      configurator.connect(users[2].signer).freezeReserve(weth.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Check the onlyAdmin on unfreezeReserve ", async () => {
    const { configurator, users, weth } = testEnv;
    await expect(
      configurator.connect(users[2].signer).unfreezeReserve(weth.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Deactivates the ETH reserve for borrowing", async () => {
    const { configurator, dataProvider, weth } = testEnv;
    await configurator.disableBorrowingOnReserve(weth.address);
    const { decimals, reserveFactor, borrowingEnabled, isActive, isFrozen } =
      await dataProvider.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWETH.reserveDecimals);
    expect(reserveFactor).to.be.equal(strategyWETH.reserveFactor);
  });

  it("Activates the ETH reserve for borrowing", async () => {
    const { configurator, weth, dataProvider } = testEnv;
    await configurator.enableBorrowingOnReserve(weth.address);
    const { variableBorrowIndex } = await dataProvider.getReserveData(weth.address);

    const { decimals, reserveFactor, borrowingEnabled, isActive, isFrozen } =
      await dataProvider.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWETH.reserveDecimals);
    expect(reserveFactor).to.be.equal(strategyWETH.reserveFactor);

    expect(variableBorrowIndex.toString()).to.be.equal(RAY);
  });

  it("Check the onlyAdmin on disableBorrowingOnReserve ", async () => {
    const { configurator, users, weth } = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableBorrowingOnReserve(weth.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Check the onlyAdmin on enableBorrowingOnReserve ", async () => {
    const { configurator, users, weth } = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableBorrowingOnReserve(weth.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Changes the reserve factor of WETH", async () => {
    const { configurator, dataProvider, weth } = testEnv;
    await configurator.setReserveFactor(weth.address, "1000");
    const { decimals, reserveFactor, borrowingEnabled, isActive, isFrozen } =
      await dataProvider.getReserveConfigurationData(weth.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWETH.reserveDecimals);
    expect(reserveFactor).to.be.equal(1000);
  });

  it("Check the onlyLendingPoolManager on setReserveFactor", async () => {
    const { configurator, users, weth } = testEnv;
    await expect(
      configurator.connect(users[2].signer).setReserveFactor(weth.address, "2000"),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Reverts when trying to disable the DAI reserve with liquidity on it", async () => {
    const { dai, pool, configurator } = testEnv;
    const userAddress = await pool.signer.getAddress();
    await dai.mint(await convertToCurrencyDecimals(dai.address, "1000"));

    //approve protocol to access depositor wallet
    await dai.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, "1000");

    //user 1 deposits 1000 DAI
    await pool.deposit(dai.address, amountDAItoDeposit, userAddress, "0");

    await expect(configurator.deactivateReserve(dai.address), LPC_RESERVE_LIQUIDITY_NOT_0).to.be.revertedWith(
      LPC_RESERVE_LIQUIDITY_NOT_0
    );
  });
});

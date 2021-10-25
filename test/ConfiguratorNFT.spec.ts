import { TestEnv, makeSuite } from "./helpers/make-suite";
import { APPROVAL_AMOUNT_LENDING_POOL, RAY } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { ProtocolErrors } from "../helpers/types";
import { strategyBAYC } from "../markets/bend/reservesConfigs";

const { expect } = require("chai");

makeSuite("LendingPoolConfigurator-NFT", (testEnv: TestEnv) => {
  const {
    CALLER_NOT_POOL_ADMIN,
    RC_INVALID_LTV,
    RC_INVALID_LIQ_THRESHOLD,
    RC_INVALID_LIQ_BONUS,
  } = ProtocolErrors;

  it("Deactivates the BAYC NFT", async () => {
    const { configurator, bayc, dataProvider } = testEnv;
    await configurator.deactivateNft(bayc.address);
    const { isActive } = await dataProvider.getNftConfigurationData(
      bayc.address
    );
    expect(isActive).to.be.equal(false);
  });

  it("Rectivates the BAYC NFT", async () => {
    const { configurator, bayc, dataProvider } = testEnv;
    await configurator.activateNft(bayc.address);

    const { isActive } = await dataProvider.getNftConfigurationData(
      bayc.address
    );
    expect(isActive).to.be.equal(true);
  });

  it("Check the onlyAdmin on deactivateRNft ", async () => {
    const { configurator, users, bayc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).deactivateNft(bayc.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Check the onlyAdmin on activateNft ", async () => {
    const { configurator, users, bayc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).activateNft(bayc.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Freezes the BAYC NFT", async () => {
    const { configurator, bayc, dataProvider } = testEnv;

    await configurator.freezeNft(bayc.address);
    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await dataProvider.getNftConfigurationData(bayc.address);

    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(true);
    expect(ltv).to.be.equal(strategyBAYC.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyBAYC.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyBAYC.liquidationBonus);
  });

  it("Unfreezes the BAYC NFT", async () => {
    const { configurator, dataProvider, bayc } = testEnv;
    await configurator.unfreezeNft(bayc.address);

    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await dataProvider.getNftConfigurationData(bayc.address);

    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(ltv).to.be.equal(strategyBAYC.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyBAYC.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyBAYC.liquidationBonus);
  });

  it("Check the onlyAdmin on freezeNft ", async () => {
    const { configurator, users, bayc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).freezeNft(bayc.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Check the onlyAdmin on unfreezeNft ", async () => {
    const { configurator, users, bayc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).unfreezeNft(bayc.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Deactivates the BAYC NFT as collateral", async () => {
    const { configurator, dataProvider, bayc } = testEnv;
    await configurator.configureNftAsCollateral(bayc.address, 0, 0, 0);

    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await dataProvider.getNftConfigurationData(bayc.address);

    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(ltv).to.be.equal(0);
    expect(liquidationThreshold).to.be.equal(0);
    expect(liquidationBonus).to.be.equal(0);
  });

  it("Activates the BAYC NFT as collateral", async () => {
    const { configurator, dataProvider, bayc } = testEnv;
    await configurator.configureNftAsCollateral(
      bayc.address,
      "8000",
      "8250",
      "10500"
    );

    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await dataProvider.getNftConfigurationData(bayc.address);

    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(ltv).to.be.equal(8000);
    expect(liquidationThreshold).to.be.equal(8250);
    expect(liquidationBonus).to.be.equal(10500);
  });

  it("Check the onlyAdmin on configureNftAsCollateral ", async () => {
    const { configurator, users, bayc } = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .configureNftAsCollateral(bayc.address, "7500", "8000", "10500"),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });
});

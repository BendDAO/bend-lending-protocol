import { TestEnv, makeSuite } from "./helpers/make-suite";
import { APPROVAL_AMOUNT_LENDING_POOL, RAY } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { ProtocolErrors } from "../helpers/types";
import { strategyAPE } from "../markets/bend/reservesConfigs";

const { expect } = require("chai");

makeSuite("LendingPoolConfigurator-NFT", (testEnv: TestEnv) => {
  const {
    CALLER_NOT_POOL_ADMIN,
    RC_INVALID_LTV,
    RC_INVALID_LIQ_THRESHOLD,
    RC_INVALID_LIQ_BONUS,
  } = ProtocolErrors;

  it("Deactivates the APE NFT", async () => {
    const { configurator, ape, helpersContract } = testEnv;
    await configurator.deactivateNft(ape.address);
    const { isActive } = await helpersContract.getNftConfigurationData(
      ape.address
    );
    expect(isActive).to.be.equal(false);
  });

  it("Rectivates the APE NFT", async () => {
    const { configurator, ape, helpersContract } = testEnv;
    await configurator.activateNft(ape.address);

    const { isActive } = await helpersContract.getNftConfigurationData(
      ape.address
    );
    expect(isActive).to.be.equal(true);
  });

  it("Check the onlyAdmin on deactivateRNft ", async () => {
    const { configurator, users, ape } = testEnv;
    await expect(
      configurator.connect(users[2].signer).deactivateNft(ape.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Check the onlyAdmin on activateNft ", async () => {
    const { configurator, users, ape } = testEnv;
    await expect(
      configurator.connect(users[2].signer).activateNft(ape.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Freezes the APE NFT", async () => {
    const { configurator, ape, helpersContract } = testEnv;

    await configurator.freezeNft(ape.address);
    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await helpersContract.getNftConfigurationData(ape.address);

    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(true);
    expect(ltv).to.be.equal(strategyAPE.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyAPE.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyAPE.liquidationBonus);
  });

  it("Unfreezes the APE NFT", async () => {
    const { configurator, helpersContract, ape } = testEnv;
    await configurator.unfreezeNft(ape.address);

    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await helpersContract.getNftConfigurationData(ape.address);

    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(ltv).to.be.equal(strategyAPE.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyAPE.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyAPE.liquidationBonus);
  });

  it("Check the onlyAdmin on freezeNft ", async () => {
    const { configurator, users, ape } = testEnv;
    await expect(
      configurator.connect(users[2].signer).freezeNft(ape.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Check the onlyAdmin on unfreezeNft ", async () => {
    const { configurator, users, ape } = testEnv;
    await expect(
      configurator.connect(users[2].signer).unfreezeNft(ape.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Deactivates the APE NFT as collateral", async () => {
    const { configurator, helpersContract, ape } = testEnv;
    await configurator.configureNftAsCollateral(ape.address, 0, 0, 0);

    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await helpersContract.getNftConfigurationData(ape.address);

    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(ltv).to.be.equal(0);
    expect(liquidationThreshold).to.be.equal(0);
    expect(liquidationBonus).to.be.equal(0);
  });

  it("Activates the APE NFT as collateral", async () => {
    const { configurator, helpersContract, ape } = testEnv;
    await configurator.configureNftAsCollateral(
      ape.address,
      "8000",
      "8250",
      "10500"
    );

    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await helpersContract.getNftConfigurationData(ape.address);

    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(ltv).to.be.equal(8000);
    expect(liquidationThreshold).to.be.equal(8250);
    expect(liquidationBonus).to.be.equal(10500);
  });

  it("Check the onlyAdmin on configureNftAsCollateral ", async () => {
    const { configurator, users, ape } = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .configureNftAsCollateral(ape.address, "7500", "8000", "10500"),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });
});

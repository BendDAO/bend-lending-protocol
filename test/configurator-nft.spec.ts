import { TestEnv, makeSuite } from "./helpers/make-suite";
import { APPROVAL_AMOUNT_LENDING_POOL, RAY } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { ProtocolErrors } from "../helpers/types";
import { strategyNftClassB } from "../markets/bend/nftsConfigs";

const { expect } = require("chai");

makeSuite("Configurator-NFT", (testEnv: TestEnv) => {
  const { CALLER_NOT_POOL_ADMIN, LPC_INVALID_CONFIGURATION, LPC_NFT_LIQUIDITY_NOT_0 } = ProtocolErrors;

  it("Deactivates the BAYC NFT", async () => {
    const { configurator, bayc, dataProvider } = testEnv;
    await configurator.deactivateNft(bayc.address);
    const { isActive } = await dataProvider.getNftConfigurationData(bayc.address);
    expect(isActive).to.be.equal(false);
  });

  it("Rectivates the BAYC NFT", async () => {
    const { configurator, bayc, dataProvider } = testEnv;
    await configurator.activateNft(bayc.address);

    const { isActive } = await dataProvider.getNftConfigurationData(bayc.address);
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

    expect(isFrozen).to.be.equal(true);
  });

  it("Unfreezes the BAYC NFT", async () => {
    const { configurator, dataProvider, bayc } = testEnv;
    await configurator.unfreezeNft(bayc.address);

    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await dataProvider.getNftConfigurationData(bayc.address);

    expect(isFrozen).to.be.equal(false);
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
    await configurator.configureNftAsCollateral(bayc.address, "8000", "8250", "500");

    const { ltv, liquidationBonus, liquidationThreshold, isActive, isFrozen } =
      await dataProvider.getNftConfigurationData(bayc.address);

    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(ltv).to.be.equal(8000);
    expect(liquidationThreshold).to.be.equal(8250);
    expect(liquidationBonus).to.be.equal(500);
  });

  it("Check the onlyAdmin on configureNftAsCollateral ", async () => {
    const { configurator, users, bayc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).configureNftAsCollateral(bayc.address, "7500", "8000", "500"),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Deactivates the BAYC NFT as auction", async () => {
    const { configurator, dataProvider, bayc } = testEnv;
    await configurator.configureNftAsAuction(bayc.address, 0, 0, 0, 0);

    const { redeemDuration, auctionDuration, redeemFine, redeemThreshold } = await dataProvider.getNftConfigurationData(
      bayc.address
    );

    expect(redeemDuration).to.be.equal(0);
    expect(auctionDuration).to.be.equal(0);
    expect(redeemFine).to.be.equal(0);
    expect(redeemThreshold).to.be.equal(0);
  });

  it("Activates the BAYC NFT as auction", async () => {
    const { configurator, dataProvider, bayc } = testEnv;
    await configurator.configureNftAsAuction(bayc.address, "1", "1", "100", "5000");

    const { redeemDuration, auctionDuration, redeemFine, redeemThreshold } = await dataProvider.getNftConfigurationData(
      bayc.address
    );

    expect(redeemDuration).to.be.equal(1);
    expect(auctionDuration).to.be.equal(1);
    expect(redeemFine).to.be.equal(100);
    expect(redeemThreshold).to.be.equal(5000);
  });

  it("Check the onlyAdmin on configureNftAsAuction ", async () => {
    const { configurator, users, bayc } = testEnv;
    await expect(
      configurator.connect(users[2].signer).configureNftAsAuction(bayc.address, "1", "1", "100", "5000"),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it("Reverts when trying to disable the BAYC nft with liquidity on it", async () => {
    const { weth, bayc, pool, configurator } = testEnv;
    const userAddress = await pool.signer.getAddress();

    await weth.mint(await convertToCurrencyDecimals(weth.address, "10"));
    await weth.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    const amountToDeposit = await convertToCurrencyDecimals(weth.address, "10");
    await pool.deposit(weth.address, amountToDeposit, userAddress, "0");

    const tokenId = testEnv.tokenIdTracker++;
    await bayc.mint(tokenId);
    await bayc.setApprovalForAll(pool.address, true);

    const amountToBorrow = await convertToCurrencyDecimals(weth.address, "1");
    await pool.borrow(weth.address, amountToBorrow, bayc.address, tokenId, userAddress, "0");

    await expect(configurator.deactivateNft(bayc.address), LPC_NFT_LIQUIDITY_NOT_0).to.be.revertedWith(
      LPC_NFT_LIQUIDITY_NOT_0
    );
  });

  it("Config setMaxNumberOfNfts valid value", async () => {
    const { configurator, users, pool } = testEnv;
    await configurator.setMaxNumberOfNfts(512);

    const wantVal = await pool.getMaxNumberOfNfts();
    expect(wantVal).to.be.equal(512);
  });

  it("Config setMaxNumberOfNfts invalid value", async () => {
    const { configurator, users, pool } = testEnv;
    await expect(configurator.setMaxNumberOfNfts(2), LPC_INVALID_CONFIGURATION).to.be.revertedWith(
      LPC_INVALID_CONFIGURATION
    );
  });

  it("Check the onlyAdmin on setMaxNumberOfNfts ", async () => {
    const { configurator, users, pool } = testEnv;
    await expect(
      configurator.connect(users[2].signer).setMaxNumberOfNfts(512),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });
});

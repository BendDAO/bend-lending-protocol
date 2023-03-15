import { ethers } from "hardhat";
import { ZERO_ADDRESS } from "../helpers/constants";
import { getDeploySigner } from "../helpers/contracts-getters";
import { waitForTx } from "../helpers/misc-utils";
import { NFTLevelAsset, NFTLevelAssetFactory } from "../types";
import { TestEnv, makeSuite } from "./helpers/make-suite";

const { expect } = require("chai");

makeSuite("NFTOracle: Level Asset", (testEnv: TestEnv) => {
  let mockNftLevelAsset1: NFTLevelAsset;
  let mockNftLevelAsset2: NFTLevelAsset;

  let commonAssetTokenId: string;
  let levelAsset1TokenId: string;
  let levelAsset2TokenId: string;

  before(async () => {
    const levelKey1 = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address", "string"], [testEnv.bayc.address, "LASER"])
    );
    const levelKey2 = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address", "string"], [testEnv.bayc.address, "GOLD"])
    );

    commonAssetTokenId = (testEnv.tokenIdTracker++).toString();

    mockNftLevelAsset1 = await new NFTLevelAssetFactory(await getDeploySigner()).deploy();
    await waitForTx(await mockNftLevelAsset1.initialize(testEnv.bayc.address, levelKey1, "LASER", []));
    levelAsset1TokenId = (testEnv.tokenIdTracker++).toString();
    await waitForTx(await mockNftLevelAsset1.enableTokenIds([levelAsset1TokenId]));

    mockNftLevelAsset2 = await new NFTLevelAssetFactory(await getDeploySigner()).deploy();
    await waitForTx(await mockNftLevelAsset2.initialize(testEnv.bayc.address, levelKey2, "GOLD", []));
    levelAsset2TokenId = (testEnv.tokenIdTracker++).toString();
    await waitForTx(await mockNftLevelAsset2.enableTokenIds([levelAsset2TokenId]));
  });

  it("Manage Level Asset withour permission (revert expect)", async () => {
    const { mockNftOracle, users } = testEnv;

    await expect(mockNftOracle.connect(users[5].signer).addLevelAsset(mockNftLevelAsset1.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    await expect(
      mockNftOracle.connect(users[5].signer).removeLevelAsset(mockNftLevelAsset1.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Add Single Level Asset", async () => {
    const { mockNftOracle, users } = testEnv;

    await waitForTx(await mockNftOracle.addLevelAsset(mockNftLevelAsset1.address));
    expect(await mockNftOracle.nftPriceFeedKeys(0)).eq(mockNftLevelAsset1.address);

    await waitForTx(await mockNftOracle.removeLevelAsset(mockNftLevelAsset1.address));
  });

  it("Add Multi Level Assets", async () => {
    const { mockNftOracle, users } = testEnv;

    await waitForTx(await mockNftOracle.addLevelAsset(mockNftLevelAsset1.address));
    await waitForTx(await mockNftOracle.addLevelAsset(mockNftLevelAsset2.address));

    expect(await mockNftOracle.nftPriceFeedKeys(0)).eq(mockNftLevelAsset1.address);
    expect(await mockNftOracle.nftPriceFeedKeys(1)).eq(mockNftLevelAsset2.address);

    await waitForTx(await mockNftOracle.removeLevelAsset(mockNftLevelAsset1.address));
    await waitForTx(await mockNftOracle.removeLevelAsset(mockNftLevelAsset2.address));
  });

  it("Set Price to Level Asset", async () => {
    const { mockNftOracle, bayc, users } = testEnv;
    const commonAssetPrice = 123400000000000;
    const levelAsset1Price = 432100000000000;
    const levelAsset2Price = 654300000000000;

    await waitForTx(await mockNftOracle.addAsset(bayc.address));
    await waitForTx(await mockNftOracle.addLevelAsset(mockNftLevelAsset1.address));
    await waitForTx(await mockNftOracle.addLevelAsset(mockNftLevelAsset2.address));

    await waitForTx(await mockNftOracle.setAssetData(bayc.address, commonAssetPrice));
    await waitForTx(await mockNftOracle.setAssetData(mockNftLevelAsset1.address, levelAsset1Price));
    await waitForTx(await mockNftOracle.setAssetData(mockNftLevelAsset2.address, levelAsset2Price));

    const commonTokenPrice = await mockNftOracle.getAssetPriceByTokenId(bayc.address, commonAssetTokenId);
    const level1TokenPrice = await mockNftOracle.getAssetPriceByTokenId(bayc.address, levelAsset1TokenId);
    const level12okenPrice = await mockNftOracle.getAssetPriceByTokenId(bayc.address, levelAsset2TokenId);

    expect(commonTokenPrice).eq(commonAssetPrice);
    expect(level1TokenPrice).eq(levelAsset1Price);
    expect(level12okenPrice).eq(levelAsset2Price);
  });
});

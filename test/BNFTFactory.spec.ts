import { TestEnv, makeSuite } from "./helpers/make-suite";
import { ZERO_ADDRESS, RAY } from "../helpers/constants";
import { deployMintableERC721, deployGenericBNFTImpl } from "../helpers/contracts-deployments";
import { getIErc721Detailed } from "../helpers/contracts-getters";
import { waitForTx } from "../helpers/misc-utils";

const { expect } = require("chai");

makeSuite("BNFTRegistry", (testEnv: TestEnv) => {
  const extraParams = "0x10";

  before(async () => {});

  it("Creates the BNFT for duplicate NFT asset", async () => {
    const { bnftRegistry, bayc } = testEnv;

    await expect(bnftRegistry.createBNFT(bayc.address, extraParams)).to.be.revertedWith("BNFTRegistry: asset exist");
  });

  it("Creates the BNFT for nonexistent NFT asset", async () => {
    const { bnftRegistry } = testEnv;

    const testNftAsset = await deployMintableERC721(["testNftAsset1", "TNFT1"]);

    const allProxyLenBefore = await bnftRegistry.allBNFTProxyLength();

    await waitForTx(await bnftRegistry.createBNFT(testNftAsset.address, extraParams));

    const allProxyLenAfter = await bnftRegistry.allBNFTProxyLength();

    expect(Number(allProxyLenAfter)).to.be.equal(Number(allProxyLenBefore) + 1);

    const { bNftProxy, bNftImpl } = await bnftRegistry.getBNFT(testNftAsset.address);

    expect(bNftProxy).to.not.equal(ZERO_ADDRESS);
    expect(bNftImpl).to.not.equal(ZERO_ADDRESS);
    expect(bNftProxy).to.not.equal(bNftImpl);

    const token = await getIErc721Detailed(bNftProxy);
    expect("bTNFT1").to.not.equal(token.symbol());
  });

  it("Creates the BNFT with implement for nonexistent NFT asset", async () => {
    const { bnftRegistry } = testEnv;

    const testNftAsset = await deployMintableERC721(["testNftAsset2", "TNFT2"]);

    const testBNFTImpl = await deployGenericBNFTImpl(false);

    const allProxyLenBefore = await bnftRegistry.allBNFTProxyLength();

    await waitForTx(await bnftRegistry.createBNFTWithImpl(testNftAsset.address, testBNFTImpl.address, extraParams));

    const allProxyLenAfter = await bnftRegistry.allBNFTProxyLength();

    expect(Number(allProxyLenAfter)).to.be.equal(Number(allProxyLenBefore) + 1);

    const { bNftProxy, bNftImpl } = await bnftRegistry.getBNFT(testNftAsset.address);

    expect(bNftProxy).to.not.equal(ZERO_ADDRESS);
    expect(bNftImpl).to.be.equal(testBNFTImpl.address);
    expect(bNftProxy).to.not.equal(bNftImpl);

    const token = await getIErc721Detailed(bNftProxy);
    expect("bTNFT2").to.not.equal(token.symbol());
  });

  it("Creates the BNFT with implement for duplicate NFT asset", async () => {
    const { bnftRegistry, bayc } = testEnv;

    const testBNFTImpl = await deployGenericBNFTImpl(false);

    await expect(bnftRegistry.createBNFTWithImpl(bayc.address, testBNFTImpl.address, extraParams)).to.be.revertedWith(
      "BNFTRegistry: asset exist"
    );
  });

  it("Upgrades the BNFT with implement for existent NFT asset", async () => {
    const { bnftRegistry, bayc } = testEnv;

    const testBNFTImpl = await deployGenericBNFTImpl(false);

    await waitForTx(await bnftRegistry.upgradeBNFTWithImpl(bayc.address, testBNFTImpl.address, []));

    const { bNftProxy, bNftImpl } = await bnftRegistry.getBNFT(bayc.address);

    expect(bNftImpl).to.be.equal(testBNFTImpl.address);
  });

  it("Upgrades the BNFT with implement for nonexistent NFT asset", async () => {
    const { bnftRegistry, bayc } = testEnv;

    const testNftAsset = await deployMintableERC721(["testNftAsset", "TNFT"]);

    const testBNFTImpl = await deployGenericBNFTImpl(false);

    await expect(bnftRegistry.upgradeBNFTWithImpl(testNftAsset.address, testBNFTImpl.address, [])).to.be.revertedWith(
      "BNFTRegistry: asset nonexist"
    );
  });
});

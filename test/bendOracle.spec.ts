import { TestEnv, makeSuite } from "./helpers/make-suite";
import { ZERO_ADDRESS } from "../helpers/constants";

const { expect } = require("chai");

makeSuite("BendOracle", (testEnv: TestEnv) => {
  before(async () => {});

  it("BendOracle:Set Oracle contract", async () => {
    const { bendOracle, bPUNK, nftOracle, users } = testEnv;
    await bendOracle.setOracleContract(bPUNK.address, nftOracle.address);
    expect(await bendOracle.assetOracleContract(bPUNK.address)).to.equal(nftOracle.address);
    await expect(bendOracle.setOracleContract(ZERO_ADDRESS, nftOracle.address)).to.be.revertedWith(
      "BendOracle: asset not existed"
    );
    await expect(bendOracle.setOracleContract(bPUNK.address, ZERO_ADDRESS)).to.be.revertedWith(
      "BendOracle: oracle not existed"
    );
    await expect(bendOracle.connect(users[0].signer).setOracleContract(bPUNK.address, ZERO_ADDRESS)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("BendOracle:Get Asset Price", async () => {
    const { bendOracle, bPUNK, nftOracle, users } = testEnv;
    await nftOracle.addAsset(bPUNK.address);
    await nftOracle.setAssetData(bPUNK.address, 100, 100, 100);
    await bendOracle.setOracleContract(bPUNK.address, nftOracle.address);
    expect(await bendOracle.getAssetPrice(bPUNK.address)).to.equal(100);
  });
});

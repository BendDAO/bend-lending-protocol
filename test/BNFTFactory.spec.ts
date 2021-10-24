import { TestEnv, makeSuite } from "./helpers/make-suite";
import { APPROVAL_AMOUNT_LENDING_POOL, RAY } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { ProtocolErrors } from "../helpers/types";
import { strategyBAYC } from "../markets/bend/reservesConfigs";

const { expect } = require("chai");

makeSuite("BNFTFactory", (testEnv: TestEnv) => {
  it("Deactivates the BAYC NFT", async () => {
    const { configurator, bayc, helpersContract } = testEnv;
    await configurator.deactivateNft(bayc.address);
    const { isActive } = await helpersContract.getNftConfigurationData(
      bayc.address
    );
    expect(isActive).to.be.equal(false);
  });
});

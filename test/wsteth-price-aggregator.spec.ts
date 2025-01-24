import { BigNumber as BN } from "ethers";
import BigNumber from "bignumber.js";

import { expect } from "chai";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { BendPools, iBendPoolAssets, IReserveParams } from "../helpers/types";
import { waitForTx } from "../helpers/misc-utils";
import {
  MockChainlinkOracle,
  MockChainlinkOracleFactory,
  MockStETH,
  MockStETHFactory,
  WstETH,
  WstETHFactory,
  WstETHPriceAggregator,
  WstETHPriceAggregatorFactory,
} from "../types";
import { configuration as actionsConfiguration } from "./helpers/actions";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { getReservesConfigByPool } from "../helpers/configuration";

makeSuite("Price Aggregator: wstETH / ETH", (testEnv: TestEnv) => {
  let mockStETH: MockStETH;
  let mockWstETH: WstETH;
  let mockStETHtoETHAggregator: MockChainlinkOracle;
  let wstETHPriceAggregator: WstETHPriceAggregator;

  before("Before: set config", async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );

    mockStETH = await new MockStETHFactory(testEnv.deployer.signer).deploy();
    mockWstETH = await new WstETHFactory(testEnv.deployer.signer).deploy(mockStETH.address);
    mockStETHtoETHAggregator = await new MockChainlinkOracleFactory(testEnv.deployer.signer).deploy(18);

    wstETHPriceAggregator = await new WstETHPriceAggregatorFactory(testEnv.deployer.signer).deploy(
      mockStETHtoETHAggregator.address,
      mockWstETH.address
    );

    await testEnv.mockReserveOracle.addAggregator(mockWstETH.address, wstETHPriceAggregator.address);
  });
  after("After: reset config", () => {
    // Reset BigNumber
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it("Query wstETH price", async () => {
    const { mockReserveOracle } = testEnv;

    const wstethUnit = BN.from(10).pow(await mockWstETH.decimals());

    let stethPrice = BN.from("999692734093987600");
    await waitForTx(await mockStETHtoETHAggregator.mockAddAnswer(1, stethPrice, "1", "1", "1"));

    const tokenShare = await mockWstETH.tokensPerStEth();
    const wstethPrice = stethPrice.mul(wstethUnit).div(tokenShare);

    const law1 = await wstETHPriceAggregator.latestAnswer();
    expect(law1).to.be.eq(wstethPrice, "latestAnswer not match");

    const gaw1 = await wstETHPriceAggregator.getAnswer(1);
    expect(gaw1).to.be.eq(wstethPrice, "getAnswer not match");

    const lrd1 = await wstETHPriceAggregator.latestRoundData();
    expect(lrd1.answer).to.be.eq(wstethPrice, "latestRoundData not match");

    const grd1 = await wstETHPriceAggregator.getRoundData(1);
    expect(grd1.answer).to.be.eq(wstethPrice, "getRoundData not match");

    const priceInRO1 = await mockReserveOracle.getAssetPrice(mockWstETH.address);
    expect(priceInRO1).to.be.eq(wstethPrice, "getAssetPrice not match");
  });
});

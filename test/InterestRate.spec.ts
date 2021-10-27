import { TestEnv, makeSuite } from "./helpers/make-suite";
import { deployInterestRate } from "../helpers/contracts-deployments";

import { APPROVAL_AMOUNT_LENDING_POOL, PERCENTAGE_FACTOR, RAY } from "../helpers/constants";

import { rateStrategyStableOne } from "../markets/bend/rateStrategies";

import { strategyDAI } from "../markets/bend/reservesConfigs";
import { BToken, InterestRate, MintableERC20 } from "../types";
import BigNumber from "bignumber.js";
import "./helpers/utils/math";

const { expect } = require("chai");

makeSuite("Interest rate tests", (testEnv: TestEnv) => {
  let rateInstance: InterestRate;
  let dai: MintableERC20;
  let bDai: BToken;

  before(async () => {
    dai = testEnv.dai;
    bDai = testEnv.bDai;

    const { addressesProvider } = testEnv;

    rateInstance = await deployInterestRate(
      [
        addressesProvider.address,
        rateStrategyStableOne.optimalUtilizationRate,
        rateStrategyStableOne.baseVariableBorrowRate,
        rateStrategyStableOne.variableRateSlope1,
        rateStrategyStableOne.variableRateSlope2,
      ],
      false
    );
  });

  it("Checks rates at 0% utilization rate, empty reserve", async () => {
    const { 0: currentLiquidityRate, 1: currentVariableBorrowRate } = await rateInstance[
      "calculateInterestRates(address,address,uint256,uint256,uint256,uint256)"
    ](dai.address, bDai.address, 0, 0, 0, strategyDAI.reserveFactor);

    expect(currentLiquidityRate.toString()).to.be.equal("0", "Invalid liquidity rate");
    expect(currentVariableBorrowRate.toString()).to.be.equal(
      rateStrategyStableOne.baseVariableBorrowRate,
      "Invalid variable rate"
    );
  });

  it("Checks rates at 80% utilization rate", async () => {
    const { 0: currentLiquidityRate, 1: currentVariableBorrowRate } = await rateInstance[
      "calculateInterestRates(address,address,uint256,uint256,uint256,uint256)"
    ](dai.address, bDai.address, "200000000000000000", "0", "800000000000000000", strategyDAI.reserveFactor);

    const expectedVariableRate = new BigNumber(rateStrategyStableOne.baseVariableBorrowRate).plus(
      rateStrategyStableOne.variableRateSlope1
    );

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedVariableRate
        .times(0.8)
        .percentMul(new BigNumber(PERCENTAGE_FACTOR).minus(strategyDAI.reserveFactor))
        .toFixed(0),
      "Invalid liquidity rate"
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(expectedVariableRate.toFixed(0), "Invalid variable rate");
  });

  it("Checks rates at 100% utilization rate", async () => {
    const { 0: currentLiquidityRate, 1: currentVariableBorrowRate } = await rateInstance[
      "calculateInterestRates(address,address,uint256,uint256,uint256,uint256)"
    ](dai.address, bDai.address, "0", "0", "800000000000000000", strategyDAI.reserveFactor);

    const expectedVariableRate = new BigNumber(rateStrategyStableOne.baseVariableBorrowRate)
      .plus(rateStrategyStableOne.variableRateSlope1)
      .plus(rateStrategyStableOne.variableRateSlope2);

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedVariableRate.percentMul(new BigNumber(PERCENTAGE_FACTOR).minus(strategyDAI.reserveFactor)).toFixed(0),
      "Invalid liquidity rate"
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(expectedVariableRate.toFixed(0), "Invalid variable rate");
  });
});

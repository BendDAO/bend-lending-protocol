import BigNumber from "bignumber.js";

import { DRE, increaseTime } from "../helpers/misc-utils";
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { makeSuite } from "./helpers/make-suite";
import { ProtocolErrors } from "../helpers/types";
import { getUserData } from "./helpers/utils/helpers";
import { CommonsConfig } from "../markets/bend/commons";

import { parseEther } from "ethers/lib/utils";

const chai = require("chai");

const { expect } = chai;

makeSuite("LendPool: Liquidation negtive test cases", (testEnv) => {
  const { INVALID_HF } = ProtocolErrors;

  before("Before liquidation: set config", () => {
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
  });

  after("After liquidation: reset config", () => {
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });
  /*
  it("It's not possible to liquidate on a non-active reserve", async () => {
    const { configurator, weth, bayc, pool, users } = testEnv;
    const user = users[1];

    await configurator.deactivateReserve(weth.address);

    await expect(
      pool.liquidate(bayc.address, dai.address, user.address, parseEther('1000'), false)
    ).to.be.revertedWith('2');

    await configurator.activateReserve(weth.address);

    await configurator.deactivateReserve(dai.address);

    await expect(
      pool.liquidationCall(weth.address, dai.address, user.address, parseEther('1000'), false)
    ).to.be.revertedWith('2');

    await configurator.activateReserve(dai.address);
  });
*/
});

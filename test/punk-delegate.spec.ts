import BigNumber from "bignumber.js";
import { BigNumber as BN } from "ethers";
import { parseEther } from "ethers/lib/utils";
import DRE from "hardhat";

import { getReservesConfigByPool } from "../helpers/configuration";
import { BendPools, iBendPoolAssets, IReserveParams, ProtocolErrors, ProtocolLoanState } from "../helpers/types";
import { configuration as actionsConfiguration } from "./helpers/actions";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { NETWORKS_DEFAULT_GAS } from "../helper-hardhat-config";

const chai = require("chai");
const { expect } = chai;

makeSuite("PunkGateway: Delegate", (testEnv: TestEnv) => {
  const depositSize = parseEther("5");

  before("Initializing configuration", async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumber.config({
      DECIMAL_PLACES: 0,
      ROUNDING_MODE: BigNumber.ROUND_DOWN,
    });

    actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );
  });
  after("Reset", () => {
    // Reset BigNumber
    BigNumber.config({
      DECIMAL_PLACES: 20,
      ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
    });
  });

  it("Hacker try to borrow and delegate different onBehalf (should revert)", async () => {
    const { users, punkGateway, weth } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const liquidator = users[2];
    const hacker = users[3];
    const borrowSize1 = parseEther("1");
    const borrowSize2 = parseEther("2");
    const borrowSizeAll = borrowSize1.add(borrowSize2);

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();

    console.log("borrow");
    await expect(
      punkGateway.connect(hacker.signer).borrow(weth.address, borrowSize2, tokenId, borrower.address, "0")
    ).to.be.revertedWith(ProtocolErrors.CALLER_NOT_ONBEHALFOF_OR_IN_WHITELIST);

    console.log("borrowETH");
    await expect(
      punkGateway.connect(hacker.signer).borrowETH(borrowSize2, tokenId, borrower.address, "0")
    ).to.be.revertedWith(ProtocolErrors.CALLER_NOT_ONBEHALFOF_OR_IN_WHITELIST);
  });

  it("Hacker try to auction and delegate different onBehalf (should revert)", async () => {
    const { users, punkGateway, weth } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const liquidator = users[2];
    const hacker = users[3];
    const borrowSize1 = parseEther("1");
    const borrowSize2 = parseEther("2");
    const borrowSizeAll = borrowSize1.add(borrowSize2);

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();

    console.log("auction");
    await expect(punkGateway.connect(hacker.signer).auction(tokenId, "1000000", liquidator.address)).to.be.revertedWith(
      ProtocolErrors.CALLER_NOT_ONBEHALFOF_OR_IN_WHITELIST
    );

    console.log("auctionETH");
    await expect(
      punkGateway.connect(hacker.signer).auctionETH(tokenId, liquidator.address, { value: depositSize })
    ).to.be.revertedWith(ProtocolErrors.CALLER_NOT_ONBEHALFOF_OR_IN_WHITELIST);
  });
});

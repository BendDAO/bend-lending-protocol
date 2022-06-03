import { configuration as actionsConfiguration, setApprovalForAllExt } from "./helpers/actions";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";

import BigNumber from "bignumber.js";
import { makeSuite } from "./helpers/make-suite";
import { getReservesConfigByPool } from "../helpers/configuration";
import { BendPools, iBendPoolAssets, IReserveParams } from "../helpers/types";

import { mintERC20, mintERC721, approveERC20, setApprovalForAll, deposit, borrow, repay } from "./helpers/actions";
import { increaseTime, waitForTx } from "../helpers/misc-utils";
import { RepayAndTransferHelper, RepayAndTransferHelperFactory } from "../types";
import { getDeploySigner } from "../helpers/contracts-getters";
import { parseEther } from "ethers/lib/utils";

const { expect } = require("chai");

makeSuite("Repay and transfer helper tests", async (testEnv) => {
  let saveBaycAssetPrice: string;
  let repayAndTransferHelper: RepayAndTransferHelper;

  before("Initializing configuration", async () => {
    // Sets BigNumber for this suite, instead of globally
    BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

    calculationsConfiguration.reservesParams = <iBendPoolAssets<IReserveParams>>(
      getReservesConfigByPool(BendPools.proto)
    );

    saveBaycAssetPrice = (await testEnv.nftOracle.getAssetPrice(testEnv.bayc.address)).toString();

    repayAndTransferHelper = await new RepayAndTransferHelperFactory(await getDeploySigner()).deploy(
      testEnv.addressesProvider.address
    );
  });
  after("Reset", () => {
    // Reset BigNumber
    BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
  });

  it("borrow-repay-transfer", async () => {
    const { users, bayc } = testEnv;
    const depositor = users[0];
    const borrower = users[1];
    const borrower2 = users[2];

    // deposit
    await mintERC20(testEnv, depositor, "WETH", "100");
    await approveERC20(testEnv, depositor, "WETH");

    await deposit(testEnv, depositor, "", "WETH", "100", depositor.address, "success", "");

    await increaseTime(100);

    // mint nft
    await mintERC20(testEnv, borrower, "WETH", "100");
    await approveERC20(testEnv, borrower, "WETH");

    const tokenIdNum = testEnv.tokenIdTracker++;
    const tokenId = tokenIdNum.toString();
    await mintERC721(testEnv, borrower, "BAYC", tokenId);

    await setApprovalForAll(testEnv, borrower, "BAYC");

    // borrow
    await borrow(testEnv, borrower, "WETH", "5", "BAYC", tokenId, borrower.address, "365", "success", "");

    await increaseTime(100);

    await setApprovalForAllExt(testEnv, borrower, "BAYC", repayAndTransferHelper.address);
    await waitForTx(
      await repayAndTransferHelper.repayETHAndTransferERC721(bayc.address, tokenId, borrower2.address, {
        value: parseEther("6"),
      })
    );

    expect(await bayc.ownerOf(tokenId), "debt should gte borrowSize").to.be.eq(borrower2.address);
  });
});

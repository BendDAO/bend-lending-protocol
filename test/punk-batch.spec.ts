import BigNumber from "bignumber.js";
import { BigNumber as BN } from "ethers";
import { parseEther } from "ethers/lib/utils";
import DRE from "hardhat";

import { getReservesConfigByPool } from "../helpers/configuration";
import { BendPools, iBendPoolAssets, IReserveParams, ProtocolErrors, ProtocolLoanState } from "../helpers/types";
import {
  approveERC20,
  approveERC20PunkGateway,
  configuration as actionsConfiguration,
  deposit,
  mintERC20,
} from "./helpers/actions";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { advanceTimeAndBlock, waitForTx } from "../helpers/misc-utils";
import { getERC20TokenBalance, getLoanData } from "./helpers/utils/helpers";
import { getDebtToken } from "../helpers/contracts-getters";
import { MAX_UINT_AMOUNT } from "../helpers/constants";

const chai = require("chai");
const { expect } = chai;

makeSuite("PunkGateway: Batch borrow", (testEnv: TestEnv) => {
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

  it("Batch Borrow USDC", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, wethGateway, pool, dataProvider, usdc } = testEnv;

    const [depositor, borrower] = users;
    const depositUnit = "10000";

    // Deposit USDC
    await mintERC20(testEnv, depositor, "USDC", depositUnit.toString());
    await approveERC20(testEnv, depositor, "USDC");
    await deposit(testEnv, depositor, "", "USDC", depositUnit.toString(), depositor.address, "success", "");

    const borrowSize1 = await convertToCurrencyDecimals(usdc.address, "1000");
    const borrowSize2 = await convertToCurrencyDecimals(usdc.address, "2000");
    const borrowSizeAll = borrowSize1.add(borrowSize2);

    // Mint punks
    const punkIndex1 = testEnv.punkIndexTracker++;
    const punkIndex2 = testEnv.punkIndexTracker++;

    const getDebtBalance = async (punkIndex: number) => {
      const loan = await getLoanData(pool, dataProvider, wrappedPunk.address, `${punkIndex}`, "0");
      return BN.from(loan.currentAmount.toFixed(0));
    };

    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex1));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex1, 0, punkGateway.address)
    );
    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex2));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex2, 0, punkGateway.address)
    );

    const usdcBalanceBefore = await getERC20TokenBalance(usdc.address, borrower.address);

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(usdc.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(borrower.signer).approveDelegation(punkGateway.address, MAX_UINT_AMOUNT));

    // Batch borrow usdc
    console.log("Batch borrow usdc");
    await waitForTx(
      await punkGateway
        .connect(borrower.signer)
        .batchBorrow(
          [usdc.address, usdc.address],
          [borrowSize1, borrowSize2],
          [punkIndex1, punkIndex2],
          borrower.address,
          "0"
        )
    );

    const usdcBalanceAfterBorrow = await getERC20TokenBalance(usdc.address, borrower.address);
    expect(usdcBalanceAfterBorrow).to.be.gte(usdcBalanceBefore.add(borrowSizeAll));

    const debt1AfterBorrow = await getDebtBalance(punkIndex1);
    expect(debt1AfterBorrow).to.be.gte(borrowSize1);

    const debt2AfterBorrow = await getDebtBalance(punkIndex2);
    expect(debt2AfterBorrow).to.be.gte(borrowSize2);

    await mintERC20(testEnv, borrower, "USDC", depositUnit.toString());
    await approveERC20PunkGateway(testEnv, borrower, "USDC");
    await waitForTx(await wrappedPunk.connect(borrower.signer).setApprovalForAll(punkGateway.address, true));

    // Batch repay usdc
    console.log("Batch repay usdc - partial");
    await waitForTx(
      await punkGateway
        .connect(borrower.signer)
        .batchRepay([punkIndex1, punkIndex2], [borrowSize1.div(2), borrowSize1.div(2)])
    );

    const loanData1AfterRepayPart = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex1);
    expect(loanData1AfterRepayPart.state).to.be.eq(ProtocolLoanState.Active);

    const loanData2AfterRepayPart = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex2);
    expect(loanData2AfterRepayPart.state).to.be.eq(ProtocolLoanState.Active);

    console.log("Batch repay usdc - full");
    await waitForTx(
      await punkGateway
        .connect(borrower.signer)
        .batchRepay([punkIndex1, punkIndex2], [MAX_UINT_AMOUNT, MAX_UINT_AMOUNT])
    );

    const loanData1AfterRepayFull = await dataProvider.getLoanDataByLoanId(loanData1AfterRepayPart.loanId);
    expect(loanData1AfterRepayFull.state).to.be.eq(ProtocolLoanState.Repaid);

    const loanData2AfterRepayFull = await dataProvider.getLoanDataByLoanId(loanData2AfterRepayPart.loanId);
    expect(loanData2AfterRepayFull.state).to.be.eq(ProtocolLoanState.Repaid);
  });

  it("Batch Borrow ETH", async () => {
    const { users, pool, cryptoPunksMarket, wrappedPunk, punkGateway, weth, bWETH, wethGateway, dataProvider } =
      testEnv;

    const [depositor, borrower] = users;
    const depositSize = parseEther("10");
    const borrowSize1 = parseEther("1");
    const borrowSize2 = parseEther("2");
    const borrowSizeAll = borrowSize1.add(borrowSize2);
    const gasCost = parseEther("0.2");

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    // mint punks
    const punkIndex1 = testEnv.punkIndexTracker++;
    const punkIndex2 = testEnv.punkIndexTracker++;

    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex1));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex1, 0, punkGateway.address)
    );

    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex2));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex2, 0, punkGateway.address)
    );

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(weth.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(borrower.signer).approveDelegation(wethGateway.address, MAX_UINT_AMOUNT));

    const userBalanceBeforeBorrow = await borrower.signer.getBalance();

    // Batch borrow eth
    console.log("Batch borrow eth");
    await waitForTx(
      await punkGateway
        .connect(borrower.signer)
        .batchBorrowETH([borrowSize1, borrowSize2], [punkIndex1, punkIndex2], borrower.address, "0")
    );

    // Check results
    const userBalanceAfterBorrow = await borrower.signer.getBalance();
    expect(userBalanceAfterBorrow).to.be.gte(userBalanceBeforeBorrow.add(borrowSizeAll).sub(gasCost));

    const loanData1AfterBorrow = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex1);
    expect(loanData1AfterBorrow.state).to.be.eq(ProtocolLoanState.Active);

    const loanData2AfterBorrow = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex1);
    expect(loanData2AfterBorrow.state).to.be.eq(ProtocolLoanState.Active);

    await advanceTimeAndBlock(100);

    await waitForTx(await wrappedPunk.connect(borrower.signer).setApprovalForAll(punkGateway.address, true));

    // Batch repay eth
    console.log("Batch repay eth - partial");
    const repaySize1Part = borrowSize1.div(2);
    const repaySize2Part = borrowSize2.div(2);
    await waitForTx(
      await punkGateway
        .connect(borrower.signer)
        .batchRepayETH([punkIndex1, punkIndex2], [borrowSize1.div(2), borrowSize1.div(2)], {
          value: repaySize1Part.add(repaySize2Part),
        })
    );

    const loanData1AfterRepayPart = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex1);
    expect(loanData1AfterRepayPart.state).to.be.eq(ProtocolLoanState.Active);

    const loanData2AfterRepayPart = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex2);
    expect(loanData2AfterRepayPart.state).to.be.eq(ProtocolLoanState.Active);

    console.log("Batch repay eth - full");
    const repaySize1Full = new BigNumber(loanData1AfterRepayPart.currentAmount.toString());
    const repaySize2Full = new BigNumber(loanData2AfterRepayPart.currentAmount.toString());
    await waitForTx(
      await punkGateway
        .connect(borrower.signer)
        .batchRepayETH([punkIndex1, punkIndex2], [MAX_UINT_AMOUNT, MAX_UINT_AMOUNT], {
          value: repaySize1Full.plus(repaySize2Full).multipliedBy(1.001).toFixed(0),
        })
    );

    const loanData1AfterRepayFull = await dataProvider.getLoanDataByLoanId(loanData1AfterRepayPart.loanId);
    expect(loanData1AfterRepayFull.state).to.be.eq(ProtocolLoanState.Repaid);

    const loanData2AfterRepayFull = await dataProvider.getLoanDataByLoanId(loanData2AfterRepayPart.loanId);
    expect(loanData2AfterRepayFull.state).to.be.eq(ProtocolLoanState.Repaid);
  });
});

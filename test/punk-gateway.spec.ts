import BigNumber from "bignumber.js";
import { BigNumber as BN } from "ethers";
import { parseEther } from "ethers/lib/utils";

import { getReservesConfigByPool } from "../helpers/configuration";
import { MAX_UINT_AMOUNT, oneEther, ONE_YEAR } from "../helpers/constants";
import { getDebtToken } from "../helpers/contracts-getters";
import { convertToCurrencyDecimals, convertToCurrencyUnits } from "../helpers/contracts-helpers";
import { advanceBlock, advanceTimeAndBlock, sleep, waitForTx } from "../helpers/misc-utils";
import { BendPools, iBendPoolAssets, IReserveParams, ProtocolLoanState } from "../helpers/types";
import { ERC721Factory } from "../types";
import {
  approveERC20,
  approveERC20PunkGateway,
  configuration as actionsConfiguration,
  deposit,
  mintERC20,
  setNftAssetPrice,
} from "./helpers/actions";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import {
  getERC20TokenBalance,
  getLoanData,
  getReserveAddressFromSymbol,
  getReserveData,
} from "./helpers/utils/helpers";

const chai = require("chai");
const { expect } = chai;

makeSuite("PunkGateway", (testEnv: TestEnv) => {
  const zero = BN.from(0);

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

  it("Owner can do emergency CryptoPunks recovery", async () => {
    const { users, cryptoPunksMarket, punkGateway, deployer } = testEnv;
    const user = users[0];

    const punkIndex = testEnv.punkIndexTracker++;
    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(punkIndex));

    await waitForTx(await cryptoPunksMarket.connect(user.signer).transferPunk(punkGateway.address, punkIndex));
    const tokenOwnerAfterBadTransfer = await cryptoPunksMarket.punkIndexToAddress(punkIndex);
    expect(tokenOwnerAfterBadTransfer).to.be.eq(punkGateway.address, "User should have lost the punk here.");

    await punkGateway
      .connect(deployer.signer)
      .emergencyPunksTransfer(cryptoPunksMarket.address, user.address, punkIndex);
    const tokenOwnerAfterRecovery = await cryptoPunksMarket.punkIndexToAddress(punkIndex);

    expect(tokenOwnerAfterRecovery).to.be.eq(user.address, "User should recover the punk due emergency transfer");
  });

  it("Borrow some USDC and repay it", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, wethGateway, pool, dataProvider, usdc } = testEnv;

    const [depositor, borrower] = users;
    const depositUnit = "10000";
    const depositSize = await convertToCurrencyDecimals(usdc.address, depositUnit);

    // Deposit USDC
    await mintERC20(testEnv, depositor, "USDC", depositUnit.toString());
    await approveERC20(testEnv, depositor, "USDC");
    await deposit(testEnv, depositor, "", "USDC", depositUnit.toString(), depositor.address, "success", "");

    const borrowSize1 = await convertToCurrencyDecimals(usdc.address, "1000");
    const borrowSize2 = await convertToCurrencyDecimals(usdc.address, "2000");
    const borrowSizeAll = borrowSize1.add(borrowSize2);
    const repaySize = borrowSizeAll.add(borrowSizeAll.mul(5).div(100));
    const punkIndex = testEnv.punkIndexTracker++;

    // Mint for interest
    await waitForTx(await usdc.connect(borrower.signer).mint(repaySize.sub(borrowSizeAll).toString()));
    await approveERC20PunkGateway(testEnv, borrower, "USDC");

    const getDebtBalance = async () => {
      const loan = await getLoanData(pool, dataProvider, wrappedPunk.address, `${punkIndex}`, "0");

      return BN.from(loan.currentAmount.toFixed(0));
    };
    const getPunkOwner = async () => {
      const owner = await cryptoPunksMarket.punkIndexToAddress(punkIndex);

      return owner;
    };
    const getWrappedPunkOwner = async () => {
      const owner = await wrappedPunk.ownerOf(punkIndex);

      return owner;
    };

    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    const usdcBalanceBefore = await getERC20TokenBalance(usdc.address, borrower.address);

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(usdc.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(borrower.signer).approveDelegation(punkGateway.address, MAX_UINT_AMOUNT));

    // borrow first usdc
    await waitForTx(
      await punkGateway.connect(borrower.signer).borrow(usdc.address, borrowSize1, punkIndex, borrower.address, "0")
    );

    await advanceTimeAndBlock(100);

    // borrow more usdc
    await waitForTx(
      await punkGateway.connect(borrower.signer).borrow(usdc.address, borrowSize2, punkIndex, borrower.address, "0")
    );

    const usdcBalanceAfterBorrow = await getERC20TokenBalance(usdc.address, borrower.address);
    const debtAfterBorrow = await getDebtBalance();
    const wrapperPunkOwner = await getWrappedPunkOwner();

    expect(usdcBalanceAfterBorrow).to.be.gte(usdcBalanceBefore.add(borrowSizeAll));
    expect(debtAfterBorrow).to.be.gte(borrowSizeAll);

    await advanceTimeAndBlock(100);

    // Repay partial
    await waitForTx(await punkGateway.connect(borrower.signer).repay(punkIndex, repaySize.div(2)));
    const usdcBalanceAfterPartialRepay = await getERC20TokenBalance(usdc.address, borrower.address);
    const debtAfterPartialRepay = await getDebtBalance();

    expect(usdcBalanceAfterPartialRepay).to.be.lt(usdcBalanceAfterBorrow);
    expect(debtAfterPartialRepay).to.be.lt(debtAfterBorrow);
    expect(await getPunkOwner()).to.be.eq(wrappedPunk.address);
    expect(await getWrappedPunkOwner(), "WrappedPunk should owned by loan after partial borrow").to.be.eq(
      wrapperPunkOwner
    );

    await advanceTimeAndBlock(100);

    // Repay full
    await waitForTx(await wrappedPunk.connect(borrower.signer).setApprovalForAll(punkGateway.address, true));
    await waitForTx(await punkGateway.connect(borrower.signer).repay(punkIndex, repaySize));
    const usdcBalanceAfterFullRepay = await getERC20TokenBalance(usdc.address, borrower.address);
    const debtAfterFullRepay = await getDebtBalance();

    expect(usdcBalanceAfterFullRepay).to.be.lt(usdcBalanceAfterPartialRepay);
    expect(debtAfterFullRepay).to.be.eq(zero);
    expect(await getPunkOwner()).to.be.eq(borrower.address);
  });

  it("Borrow all USDC and repay it", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, wethGateway, usdc, pool, dataProvider } = testEnv;

    const [depositor, user] = users;

    // advance block to make some interests
    const secondsToTravel = new BigNumber(365).multipliedBy(ONE_YEAR).div(365).toNumber();
    await advanceTimeAndBlock(secondsToTravel);

    const usdcReserveData = await getReserveData(dataProvider, usdc.address);
    const borrowSize = new BigNumber(usdcReserveData.availableLiquidity);
    const repaySize = borrowSize.plus(borrowSize.multipliedBy(5).dividedBy(100));
    const punkIndex = testEnv.punkIndexTracker++;

    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(usdc.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(user.signer).approveDelegation(punkGateway.address, MAX_UINT_AMOUNT));

    // borrow all usdc
    await waitForTx(
      await punkGateway.connect(user.signer).borrow(usdc.address, borrowSize.toFixed(0), punkIndex, user.address, "0")
    );

    // Check results
    const loanDataAfterBorrow = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex);
    expect(loanDataAfterBorrow.state).to.be.eq(ProtocolLoanState.Active);

    // Repay all usdc
    await waitForTx(await wrappedPunk.connect(user.signer).setApprovalForAll(punkGateway.address, true));
    await waitForTx(await punkGateway.connect(user.signer).repay(punkIndex, MAX_UINT_AMOUNT));

    // Check results
    const loanDataAfterRepayFull = await dataProvider.getLoanDataByLoanId(loanDataAfterBorrow.loanId);
    expect(loanDataAfterRepayFull.state).to.be.eq(ProtocolLoanState.Repaid);
  });

  it("Borrow some ETH and repay it", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, wethGateway, weth, pool, dataProvider, loan } = testEnv;

    const [depositor, user, anotherUser] = users;
    const depositSize = parseEther("5");

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    const borrowSize1 = parseEther("1");
    const borrowSize2 = parseEther("2");
    const borrowSizeAll = borrowSize1.add(borrowSize2);
    const repaySize = borrowSizeAll.add(borrowSizeAll.mul(5).div(100));
    const punkIndex = testEnv.punkIndexTracker++;

    const getDebtBalance = async () => {
      const loan = await getLoanData(pool, dataProvider, wrappedPunk.address, `${punkIndex}`, "0");

      return BN.from(loan.currentAmount.toFixed(0));
    };
    const getPunkOwner = async () => {
      const owner = await cryptoPunksMarket.punkIndexToAddress(punkIndex);

      return owner;
    };
    const getWrappedPunkOwner = async () => {
      const owner = await wrappedPunk.ownerOf(punkIndex);

      return owner;
    };

    await advanceTimeAndBlock(100);

    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    await advanceTimeAndBlock(100);

    const ethBalanceBefore = await user.signer.getBalance();

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(weth.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(user.signer).approveDelegation(wethGateway.address, MAX_UINT_AMOUNT));

    // borrow first eth
    await waitForTx(await punkGateway.connect(user.signer).borrowETH(borrowSize1, punkIndex, user.address, "0"));

    await advanceTimeAndBlock(100);

    // borrow more eth
    await waitForTx(await punkGateway.connect(user.signer).borrowETH(borrowSize2, punkIndex, user.address, "0"));

    // Check debt
    const loanDataAfterBorrow = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex);
    expect(loanDataAfterBorrow.state).to.be.eq(ProtocolLoanState.Active);

    const wrapperPunkOwner = await getWrappedPunkOwner();
    const debtAfterBorrow = await getDebtBalance();

    expect(await user.signer.getBalance(), "current eth balance shoud increase").to.be.gt(ethBalanceBefore);
    expect(debtAfterBorrow, "debt should gte borrowSize").to.be.gte(borrowSizeAll);

    await advanceTimeAndBlock(100);

    // Repay partial
    await waitForTx(
      await punkGateway.connect(user.signer).repayETH(punkIndex, repaySize.div(2), {
        value: repaySize.div(2),
      })
    );
    const loanDataAfterRepayPart = await dataProvider.getLoanDataByLoanId(loanDataAfterBorrow.loanId);
    const debtAfterPartialRepay = await getDebtBalance();

    expect(debtAfterPartialRepay).to.be.lt(debtAfterBorrow);
    expect(await getPunkOwner()).to.be.eq(wrappedPunk.address);
    expect(await getWrappedPunkOwner(), "WrappedPunk should owned by loan after partial borrow").to.be.eq(
      wrapperPunkOwner
    );
    expect(loanDataAfterRepayPart.state).to.be.eq(ProtocolLoanState.Active);

    await advanceTimeAndBlock(100);

    // Repay full
    await waitForTx(await wrappedPunk.connect(user.signer).setApprovalForAll(punkGateway.address, true));
    await waitForTx(
      await punkGateway.connect(user.signer).repayETH(punkIndex, MAX_UINT_AMOUNT, {
        value: repaySize,
      })
    );
    const debtAfterFullRepay = await getDebtBalance();
    const loanDataAfterRepayFull = await dataProvider.getLoanDataByLoanId(loanDataAfterBorrow.loanId);

    expect(debtAfterFullRepay).to.be.eq(zero);
    expect(await getPunkOwner()).to.be.eq(user.address);
    expect(loanDataAfterRepayFull.state).to.be.eq(ProtocolLoanState.Repaid);
  });

  it("Borrow all ETH and repay it", async () => {
    const { users, pool, cryptoPunksMarket, wrappedPunk, punkGateway, weth, bWETH, wethGateway, dataProvider } =
      testEnv;

    const [depositor, user] = users;
    const depositSize = parseEther("5");

    // advance block to make some interests
    const secondsToTravel = new BigNumber(365).multipliedBy(ONE_YEAR).div(365).toNumber();
    await advanceTimeAndBlock(secondsToTravel);

    const wethReserveData = await getReserveData(dataProvider, weth.address);
    const borrowSize = new BigNumber(wethReserveData.availableLiquidity);
    const repaySize = borrowSize.plus(borrowSize.multipliedBy(5).dividedBy(100));
    const punkIndex = testEnv.punkIndexTracker++;

    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    // Delegates borrowing power of WETH to WETHGateway
    const reserveData = await pool.getReserveData(weth.address);
    const debtToken = await getDebtToken(reserveData.debtTokenAddress);
    await waitForTx(await debtToken.connect(user.signer).approveDelegation(wethGateway.address, MAX_UINT_AMOUNT));

    // borrow all eth
    await waitForTx(
      await punkGateway.connect(user.signer).borrowETH(borrowSize.toFixed(0), punkIndex, user.address, "0")
    );

    // Check results
    const loanDataAfterBorrow = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex);
    expect(loanDataAfterBorrow.state).to.be.eq(ProtocolLoanState.Active);

    // Repay all eth
    await waitForTx(await wrappedPunk.connect(user.signer).setApprovalForAll(punkGateway.address, true));
    await waitForTx(
      await punkGateway.connect(user.signer).repayETH(punkIndex, MAX_UINT_AMOUNT, {
        value: repaySize.toFixed(0),
      })
    );

    // Check results
    const loanDataAfterRepayFull = await dataProvider.getLoanDataByLoanId(loanDataAfterBorrow.loanId);
    expect(loanDataAfterRepayFull.state).to.be.eq(ProtocolLoanState.Repaid);
  });
});

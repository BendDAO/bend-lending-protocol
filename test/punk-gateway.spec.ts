import BigNumber from "bignumber.js";
import { BigNumber as BN } from "ethers";
import { parseEther } from "ethers/lib/utils";

import { getReservesConfigByPool } from "../helpers/configuration";
import { MAX_UINT_AMOUNT, oneEther, ONE_DAY } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { getNowTimeInSeconds, increaseTime, waitForTx } from "../helpers/misc-utils";
import { BendPools, iBendPoolAssets, IReserveParams, ProtocolLoanState } from "../helpers/types";
import { ERC721Factory } from "../types";
import {
  approveERC20,
  approveERC20PunkGateway,
  approveERC721,
  configuration as actionsConfiguration,
  deposit,
  mintERC20,
  setApprovalForAll,
} from "./helpers/actions";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { getERC20TokenBalance, getLoanData, getReserveAddressFromSymbol } from "./helpers/utils/helpers";

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

  it("Borrow USDC and repay it", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, pool, dataProvider, loan } = testEnv;

    const [depositor, user, anotherUser] = users;
    const usdcAddress = await getReserveAddressFromSymbol("USDC");
    const depositSize = await convertToCurrencyDecimals(usdcAddress, "100");

    // Deposit USDC
    await mintERC20(testEnv, depositor, "USDC", depositSize.toString());
    await approveERC20(testEnv, depositor, "USDC");
    await deposit(testEnv, depositor, "", "USDC", depositSize.toString(), depositor.address, "success", "");

    const borrowSize = await convertToCurrencyDecimals(usdcAddress, "1");
    const repaySize = borrowSize.add(borrowSize.mul(5).div(100));
    const punkIndex = testEnv.punkIndexTracker++;

    // Mint for interest
    await mintERC20(testEnv, user, "USDC", repaySize.sub(borrowSize).toString());
    await approveERC20PunkGateway(testEnv, user, "USDC");

    const getDebtBalance = async () => {
      const loan = await getLoanData(pool, dataProvider, wrappedPunk.address, `${punkIndex}`, user.address);

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

    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(punkIndex));

    const usdcBalanceBefore = await getERC20TokenBalance(usdcAddress, user.address);

    // borrow usdc
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );
    await waitForTx(
      await punkGateway.connect(user.signer).borrow(usdcAddress, borrowSize, punkIndex, user.address, "0")
    );

    const usdcBalanceAfterBorrow = await getERC20TokenBalance(usdcAddress, user.address);
    const debtAfterBorrow = await getDebtBalance();
    const wrapperPunkOwner = await getWrappedPunkOwner();

    expect(usdcBalanceAfterBorrow).to.be.gte(usdcBalanceBefore.add(borrowSize));
    expect(debtAfterBorrow).to.be.gte(borrowSize);

    // Repay partial
    await waitForTx(await punkGateway.connect(user.signer).repay(punkIndex, repaySize.div(2)));
    const usdcBalanceAfterPartialRepay = await getERC20TokenBalance(usdcAddress, user.address);
    const debtAfterPartialRepay = await getDebtBalance();

    expect(usdcBalanceAfterPartialRepay).to.be.lt(usdcBalanceAfterBorrow);
    expect(debtAfterPartialRepay).to.be.lt(debtAfterBorrow);
    expect(await getPunkOwner()).to.be.eq(wrappedPunk.address);
    expect(await getWrappedPunkOwner(), "WrappedPunk should owned by loan after partial borrow").to.be.eq(
      wrapperPunkOwner
    );

    // Repay full
    await waitForTx(
      await ERC721Factory.connect(wrappedPunk.address, user.signer).setApprovalForAll(punkGateway.address, true)
    );
    await waitForTx(await punkGateway.connect(user.signer).repay(punkIndex, repaySize));
    const usdcBalanceAfterFullRepay = await getERC20TokenBalance(usdcAddress, user.address);
    const debtAfterFullRepay = await getDebtBalance();

    expect(usdcBalanceAfterFullRepay).to.be.lt(usdcBalanceAfterPartialRepay);
    expect(debtAfterFullRepay).to.be.eq(zero);
    expect(await getPunkOwner()).to.be.eq(user.address);
  });

  it("Borrow ETH and repay it", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, wethGateway, pool, dataProvider, loan } = testEnv;

    const [depositor, user, anotherUser] = users;
    const depositSize = parseEther("5");

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    const borrowSize = parseEther("1");
    const repaySize = borrowSize.add(borrowSize.mul(5).div(100));
    const punkIndex = testEnv.punkIndexTracker++;

    const getDebtBalance = async () => {
      const loan = await getLoanData(pool, dataProvider, wrappedPunk.address, `${punkIndex}`, user.address);

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

    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(punkIndex));

    const ethBalanceBefore = await user.signer.getBalance();
    // borrow eth
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );
    await waitForTx(await punkGateway.connect(user.signer).borrowETH(borrowSize, punkIndex, user.address, "0"));
    const loanDataAfterBorrow = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex);
    expect(loanDataAfterBorrow.state).to.be.eq(ProtocolLoanState.Active);

    const wrapperPunkOwner = await getWrappedPunkOwner();
    const debtAfterBorrow = await getDebtBalance();

    expect(await user.signer.getBalance(), "current eth balance shoud increase").to.be.gt(ethBalanceBefore);
    expect(debtAfterBorrow, "debt should gte borrowSize").to.be.gte(borrowSize);

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

    // Repay full
    await waitForTx(
      await ERC721Factory.connect(wrappedPunk.address, user.signer).setApprovalForAll(punkGateway.address, true)
    );
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

  it("Borrow ETH and liquidate it", async () => {
    const {
      users,
      cryptoPunksMarket,
      wrappedPunk,
      punkGateway,
      weth,
      wethGateway,
      pool,
      dataProvider,
      loan,
      reserveOracle,
      nftOracle,
    } = testEnv;

    const [depositor, user] = users;
    const liquidator = users[4];
    const depositSize = parseEther("500");

    // Deposit with native ETH
    await waitForTx(
      await wethGateway.connect(depositor.signer).depositETH(depositor.address, "0", { value: depositSize })
    );

    const punkIndex = testEnv.punkIndexTracker++;

    const getPunkOwner = async () => {
      const owner = await cryptoPunksMarket.punkIndexToAddress(punkIndex);

      return owner;
    };

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedPunk.address);

    // borrow eth, health factor above 1
    const poolLoanDataBefore = await pool.getNftLoanData(wrappedPunk.address, punkIndex);

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);
    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(poolLoanDataBefore.availableBorrowsETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(await punkGateway.connect(user.signer).borrowETH(amountBorrow, punkIndex, user.address, "0"));

    await waitForTx(
      await ERC721Factory.connect(wrappedPunk.address, liquidator.signer).setApprovalForAll(punkGateway.address, true)
    );

    const poolLoanDataAfterBorrow = await pool.getNftLoanData(wrappedPunk.address, punkIndex);
    expect(poolLoanDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const punkPrice = await nftOracle.getAssetPrice(wrappedPunk.address);
    const latestTime = await getNowTimeInSeconds();
    await waitForTx(
      await nftOracle.setAssetData(
        wrappedPunk.address,
        new BigNumber(punkPrice.toString()).multipliedBy(0.55).toFixed(0),
        latestTime,
        latestTime
      )
    );
    const poolLoanDataAfterLiquidate = await pool.getNftLoanData(wrappedPunk.address, punkIndex);
    expect(poolLoanDataAfterLiquidate.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Liquidate ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, punkIndex);
    const liquidateAmountSend = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway
        .connect(liquidator.signer)
        .auctionETH(punkIndex, liquidator.address, { value: liquidateAmountSend })
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_DAY).add(100).toNumber());

    await waitForTx(await punkGateway.connect(liquidator.signer).liquidateETH(punkIndex, liquidator.address));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(poolLoanDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const punkOwner = await getPunkOwner();
    expect(punkOwner).to.be.equal(liquidator.address, "Invalid punk owner after liquidation");
  });
});

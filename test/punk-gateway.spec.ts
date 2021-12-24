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
  let punkInitPrice: BN;

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

    punkInitPrice = await testEnv.nftOracle.getAssetPrice(testEnv.wrappedPunk.address);
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

  it("Borrow USDC and repay it", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, pool, dataProvider, usdc } = testEnv;

    const [depositor, borrower] = users;
    const usdcAddress = await getReserveAddressFromSymbol("USDC");
    const depositSize = await convertToCurrencyDecimals(usdcAddress, "200000");

    // Deposit USDC
    await mintERC20(testEnv, depositor, "USDC", depositSize.toString());
    await approveERC20(testEnv, depositor, "USDC");
    await deposit(testEnv, depositor, "", "USDC", depositSize.toString(), depositor.address, "success", "");

    const borrowSize1 = await convertToCurrencyDecimals(usdcAddress, "1000");
    const borrowSize2 = await convertToCurrencyDecimals(usdcAddress, "2000");
    const borrowSizeAll = borrowSize1.add(borrowSize2);
    const repaySize = borrowSizeAll.add(borrowSizeAll.mul(5).div(100));
    const punkIndex = testEnv.punkIndexTracker++;

    // Mint for interest
    await mintERC20(testEnv, borrower, "USDC", repaySize.sub(borrowSizeAll).toString());
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

    const usdcBalanceBefore = await getERC20TokenBalance(usdcAddress, borrower.address);

    // borrow first usdc
    await waitForTx(
      await punkGateway.connect(borrower.signer).borrow(usdcAddress, borrowSize1, punkIndex, borrower.address, "0")
    );

    // borrow more usdc
    await waitForTx(
      await punkGateway.connect(borrower.signer).borrow(usdcAddress, borrowSize2, punkIndex, borrower.address, "0")
    );

    const usdcBalanceAfterBorrow = await getERC20TokenBalance(usdcAddress, borrower.address);
    const debtAfterBorrow = await getDebtBalance();
    const wrapperPunkOwner = await getWrappedPunkOwner();

    expect(usdcBalanceAfterBorrow).to.be.gte(usdcBalanceBefore.add(borrowSizeAll));
    expect(debtAfterBorrow).to.be.gte(borrowSizeAll);

    // Repay partial
    await waitForTx(await punkGateway.connect(borrower.signer).repay(punkIndex, repaySize.div(2)));
    const usdcBalanceAfterPartialRepay = await getERC20TokenBalance(usdcAddress, borrower.address);
    const debtAfterPartialRepay = await getDebtBalance();

    expect(usdcBalanceAfterPartialRepay).to.be.lt(usdcBalanceAfterBorrow);
    expect(debtAfterPartialRepay).to.be.lt(debtAfterBorrow);
    expect(await getPunkOwner()).to.be.eq(wrappedPunk.address);
    expect(await getWrappedPunkOwner(), "WrappedPunk should owned by loan after partial borrow").to.be.eq(
      wrapperPunkOwner
    );

    // Repay full
    await waitForTx(
      await ERC721Factory.connect(wrappedPunk.address, borrower.signer).setApprovalForAll(punkGateway.address, true)
    );
    await waitForTx(await punkGateway.connect(borrower.signer).repay(punkIndex, repaySize));
    const usdcBalanceAfterFullRepay = await getERC20TokenBalance(usdcAddress, borrower.address);
    const debtAfterFullRepay = await getDebtBalance();

    expect(usdcBalanceAfterFullRepay).to.be.lt(usdcBalanceAfterPartialRepay);
    expect(debtAfterFullRepay).to.be.eq(zero);
    expect(await getPunkOwner()).to.be.eq(borrower.address);
  });

  it("Borrow USDC and liquidate it", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, usdc, pool, dataProvider, reserveOracle, nftOracle } =
      testEnv;

    const [depositor, borrower] = users;
    const liquidator = users[4];
    const depositSize = await convertToCurrencyDecimals(usdc.address, "200000");

    const punkIndex = testEnv.punkIndexTracker++;

    const getPunkOwner = async () => {
      const owner = await cryptoPunksMarket.punkIndexToAddress(punkIndex);

      return owner;
    };

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedPunk.address);

    // borrow usdc, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedPunk.address, usdc.address);

    const usdcPrice = await reserveOracle.getAssetPrice(usdc.address);
    const amountBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(
      await punkGateway.connect(borrower.signer).borrow(usdc.address, amountBorrow, punkIndex, borrower.address, "0")
    );

    await waitForTx(await wrappedPunk.connect(liquidator.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

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
    const nftDebtDataAfterLiquidate = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterLiquidate.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Liquidate USDC loan
    await mintERC20(testEnv, liquidator, "USDC", depositSize.toString());
    await approveERC20PunkGateway(testEnv, liquidator, "USDC");

    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, punkIndex);
    const liquidateAmount = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway.connect(liquidator.signer).auction(punkIndex, liquidateAmount, liquidator.address)
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_DAY).add(100).toNumber());

    await waitForTx(await punkGateway.connect(liquidator.signer).liquidate(punkIndex));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const punkOwner = await getPunkOwner();
    expect(punkOwner).to.be.equal(liquidator.address, "Invalid punk owner after liquidation");
  });

  it("Borrow USDC and redeem it", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, usdc, pool, dataProvider, reserveOracle, nftOracle } =
      testEnv;

    const [depositor, borrower] = users;
    const liquidator = users[4];
    const depositSize = await convertToCurrencyDecimals(usdc.address, "200000");

    const punkIndex = testEnv.punkIndexTracker++;

    const getPunkOwner = async () => {
      const owner = await cryptoPunksMarket.punkIndexToAddress(punkIndex);
      return owner;
    };

    // mint native punk
    await waitForTx(await cryptoPunksMarket.connect(borrower.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(borrower.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    const nftCfgData = await dataProvider.getNftConfigurationData(wrappedPunk.address);

    // borrow usdc, health factor above 1
    const nftColDataBefore = await pool.getNftCollateralData(wrappedPunk.address, usdc.address);

    const usdcPrice = await reserveOracle.getAssetPrice(usdc.address);
    const amountBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(
      await punkGateway.connect(borrower.signer).borrow(usdc.address, amountBorrow, punkIndex, borrower.address, "0")
    );

    await waitForTx(await wrappedPunk.connect(liquidator.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

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
    const nftDebtDataAfterLiquidate = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterLiquidate.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Auction loan
    //await mintERC20(testEnv, liquidator, "USDC", depositSize.toString());
    await approveERC20PunkGateway(testEnv, liquidator, "USDC");

    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, punkIndex);
    const liquidateAmount = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway.connect(liquidator.signer).auction(punkIndex, liquidateAmount, liquidator.address)
    );

    // Redeem loan
    await approveERC20PunkGateway(testEnv, borrower, "USDC");

    await increaseTime(nftCfgData.redeemDuration.mul(ONE_DAY).sub(3600).toNumber());

    await waitForTx(await punkGateway.connect(borrower.signer).redeem(punkIndex));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after redeem");

    const punkOwner = await getPunkOwner();
    expect(punkOwner).to.be.equal(borrower.address, "Invalid punk owner after redeem");
  });

  it("Borrow ETH and repay it", async () => {
    const { users, cryptoPunksMarket, wrappedPunk, punkGateway, wethGateway, pool, dataProvider, loan } = testEnv;

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

    await waitForTx(await cryptoPunksMarket.connect(user.signer).getPunk(punkIndex));
    await waitForTx(
      await cryptoPunksMarket.connect(user.signer).offerPunkForSaleToAddress(punkIndex, 0, punkGateway.address)
    );

    const ethBalanceBefore = await user.signer.getBalance();

    // borrow first eth
    await waitForTx(await punkGateway.connect(user.signer).borrowETH(borrowSize1, punkIndex, user.address, "0"));

    // borrow more eth
    await waitForTx(await punkGateway.connect(user.signer).borrowETH(borrowSize2, punkIndex, user.address, "0"));

    // Check debt
    const loanDataAfterBorrow = await dataProvider.getLoanDataByCollateral(wrappedPunk.address, punkIndex);
    expect(loanDataAfterBorrow.state).to.be.eq(ProtocolLoanState.Active);

    const wrapperPunkOwner = await getWrappedPunkOwner();
    const debtAfterBorrow = await getDebtBalance();

    expect(await user.signer.getBalance(), "current eth balance shoud increase").to.be.gt(ethBalanceBefore);
    expect(debtAfterBorrow, "debt should gte borrowSize").to.be.gte(borrowSizeAll);

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
    const nftColDataBefore = await pool.getNftCollateralData(wrappedPunk.address, weth.address);

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);
    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(await punkGateway.connect(user.signer).borrowETH(amountBorrow, punkIndex, user.address, "0"));

    await waitForTx(await wrappedPunk.connect(liquidator.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

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
    const nftDebtDataAfterLiquidate = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterLiquidate.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Liquidate ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, punkIndex);
    const liquidateAmountSend = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway
        .connect(liquidator.signer)
        .auctionETH(punkIndex, liquidator.address, { value: liquidateAmountSend })
    );

    await increaseTime(nftCfgData.auctionDuration.mul(ONE_DAY).add(100).toNumber());

    await waitForTx(await punkGateway.connect(liquidator.signer).liquidateETH(punkIndex));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after liquidation");

    const punkOwner = await getPunkOwner();
    expect(punkOwner).to.be.equal(liquidator.address, "Invalid punk owner after liquidation");
  });

  it("Borrow ETH and redeem it", async () => {
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
    const nftColDataBefore = await pool.getNftCollateralData(wrappedPunk.address, weth.address);

    const wethPrice = await reserveOracle.getAssetPrice(weth.address);
    const amountBorrow = await convertToCurrencyDecimals(
      weth.address,
      new BigNumber(nftColDataBefore.availableBorrowsInETH.toString())
        .div(wethPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await waitForTx(await punkGateway.connect(user.signer).borrowETH(amountBorrow, punkIndex, user.address, "0"));

    await waitForTx(await wrappedPunk.connect(liquidator.signer).setApprovalForAll(punkGateway.address, true));

    const nftDebtDataAfterBorrow = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterBorrow.healthFactor.toString()).to.be.bignumber.gt(oneEther.toFixed(0));

    // Drop the health factor below 1
    const punkPrice = await nftOracle.getAssetPrice(wrappedPunk.address);
    const latestTime = await getNowTimeInSeconds();
    await waitForTx(
      await nftOracle.setAssetData(
        wrappedPunk.address,
        new BigNumber(punkPrice.toString()).multipliedBy(0.5).toFixed(0),
        latestTime,
        latestTime
      )
    );
    const nftDebtDataAfterLiquidate = await pool.getNftDebtData(wrappedPunk.address, punkIndex);
    expect(nftDebtDataAfterLiquidate.healthFactor.toString()).to.be.bignumber.lt(oneEther.toFixed(0));

    // Auction ETH loan with native ETH
    const { liquidatePrice } = await pool.getNftLiquidatePrice(wrappedPunk.address, punkIndex);
    const liquidateAmountSend = liquidatePrice.add(liquidatePrice.mul(5).div(100));
    await waitForTx(
      await punkGateway
        .connect(liquidator.signer)
        .auctionETH(punkIndex, liquidator.address, { value: liquidateAmountSend })
    );

    // Redeem ETH loan with native ETH
    await increaseTime(nftCfgData.redeemDuration.mul(ONE_DAY).sub(3600).toNumber());

    const auctionData = await pool.getNftAuctionData(wrappedPunk.address, punkIndex);
    const redeemAmountSend = auctionData.bidBorrowAmount.add(auctionData.bidFine);
    await waitForTx(await punkGateway.connect(user.signer).redeemETH(punkIndex, { value: redeemAmountSend }));

    const loanDataAfter = await dataProvider.getLoanDataByLoanId(nftDebtDataAfterBorrow.loanId);
    expect(loanDataAfter.state).to.be.equal(ProtocolLoanState.Defaulted, "Invalid loan state after redeem");

    const punkOwner = await getPunkOwner();
    expect(punkOwner).to.be.equal(user.address, "Invalid punk owner after redeem");
  });
});

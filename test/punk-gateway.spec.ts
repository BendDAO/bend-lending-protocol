import BigNumber from "bignumber.js";
import { expect } from "chai";
import { BigNumber as BN } from "ethers";
import { parseEther } from "ethers/lib/utils";

import { getReservesConfigByPool } from "../helpers/configuration";
import { MAX_UINT_AMOUNT } from "../helpers/constants";
import { convertToCurrencyDecimals } from "../helpers/contracts-helpers";
import { waitForTx } from "../helpers/misc-utils";
import { BendPools, iBendPoolAssets, IReserveParams } from "../helpers/types";
import { ERC721UpgradeableFactory } from "../types";
import {
  approveERC20,
  approveERC20PunkGateway,
  configuration as actionsConfiguration,
  deposit,
  mintERC20,
} from "./helpers/actions";
import { makeSuite, TestEnv } from "./helpers/make-suite";
import { configuration as calculationsConfiguration } from "./helpers/utils/calculations";
import { getERC20TokenBalance, getLoanData, getReserveAddressFromSymbol } from "./helpers/utils/helpers";

makeSuite("PunkGateway", (testEnv: TestEnv) => {
  let cachedTokenId;

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
      await punkGateway.connect(user.signer).borrow(pool.address, usdcAddress, borrowSize, punkIndex, user.address, "0")
    );

    const usdcBalanceAfterBorrow = await getERC20TokenBalance(usdcAddress, user.address);
    const debtAfterBorrow = await getDebtBalance();
    const wrapperPunkOwner = await getWrappedPunkOwner();

    expect(usdcBalanceAfterBorrow).to.be.gte(usdcBalanceBefore.add(borrowSize));
    expect(debtAfterBorrow).to.be.gte(borrowSize);

    // Repay partial
    await waitForTx(
      await punkGateway
        .connect(user.signer)
        .repay(pool.address, loan.address, punkIndex, repaySize.div(2), user.address)
    );
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
      await ERC721UpgradeableFactory.connect(wrappedPunk.address, user.signer).setApprovalForAll(
        punkGateway.address,
        true
      )
    );
    await waitForTx(
      await punkGateway.connect(user.signer).repay(pool.address, loan.address, punkIndex, repaySize, user.address)
    );
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
      await wethGateway
        .connect(depositor.signer)
        .depositETH(pool.address, depositor.address, "0", { value: depositSize })
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
    await waitForTx(
      await punkGateway
        .connect(user.signer)
        .borrowETH(wethGateway.address, pool.address, borrowSize, punkIndex, user.address, "0")
    );

    const wrapperPunkOwner = await getWrappedPunkOwner();
    const debtAfterBorrow = await getDebtBalance();

    expect(await user.signer.getBalance(), "current eth balance shoud increase").to.be.gt(ethBalanceBefore);
    expect(debtAfterBorrow, "debt should gte borrowSize").to.be.gte(borrowSize);

    // Repay partial
    await waitForTx(
      await punkGateway
        .connect(user.signer)
        .repayETH(wethGateway.address, pool.address, loan.address, punkIndex, repaySize.div(2), user.address, {
          value: repaySize.div(2),
        })
    );
    const debtAfterPartialRepay = await getDebtBalance();

    expect(debtAfterPartialRepay).to.be.lt(debtAfterBorrow);
    expect(await getPunkOwner()).to.be.eq(wrappedPunk.address);
    expect(await getWrappedPunkOwner(), "WrappedPunk should owned by loan after partial borrow").to.be.eq(
      wrapperPunkOwner
    );

    // Repay full
    await waitForTx(
      await ERC721UpgradeableFactory.connect(wrappedPunk.address, user.signer).setApprovalForAll(
        punkGateway.address,
        true
      )
    );
    await waitForTx(
      await punkGateway
        .connect(user.signer)
        .repayETH(wethGateway.address, pool.address, loan.address, punkIndex, MAX_UINT_AMOUNT, user.address, {
          value: repaySize,
        })
    );
    const debtAfterFullRepay = await getDebtBalance();

    expect(debtAfterFullRepay).to.be.eq(zero);
    expect(await getPunkOwner()).to.be.eq(user.address);
  });
});

import BigNumber from "bignumber.js";

import {
  calcExpectedReserveDataAfterDeposit,
  calcExpectedReserveDataAfterWithdraw,
  calcExpectedReserveDataAfterBorrow,
  calcExpectedReserveDataAfterRepay,
  calcExpectedReserveDataAfterAuction,
  calcExpectedReserveDataAfterRedeem,
  calcExpectedReserveDataAfterLiquidate,
  calcExpectedUserDataAfterDeposit,
  calcExpectedUserDataAfterWithdraw,
  calcExpectedUserDataAfterBorrow,
  calcExpectedUserDataAfterRepay,
  calcExpectedUserDataAfterAuction,
  calcExpectedUserDataAfterRedeem,
  calcExpectedUserDataAfterLiquidate,
  calcExpectedLoanDataAfterBorrow,
  calcExpectedLoanDataAfterRepay,
  calcExpectedLoanDataAfterAuction,
  calcExpectedLoanDataAfterRedeem,
  calcExpectedLoanDataAfterLiquidate,
} from "./utils/calculations";
import {
  getReserveAddressFromSymbol,
  getNftAddressFromSymbol,
  getReserveData,
  getUserData,
  getLoanData,
} from "./utils/helpers";

import { convertToCurrencyDecimals, getEthersSignerByAddress } from "../../helpers/contracts-helpers";
import {
  getBToken,
  getMintableERC20,
  getMintableERC721,
  getLendPoolLoanProxy,
  getIErc20Detailed,
  getDebtToken,
} from "../../helpers/contracts-getters";
import { MAX_UINT_AMOUNT, oneEther, ONE_DAY, ONE_HOUR, ONE_YEAR } from "../../helpers/constants";
import { SignerWithAddress, TestEnv } from "./make-suite";
import {
  advanceTimeAndBlock,
  DRE,
  getNowTimeInMilliSeconds,
  getNowTimeInSeconds,
  increaseTime,
  timeLatest,
  waitForTx,
} from "../../helpers/misc-utils";

import chai from "chai";
import { ReserveData, UserReserveData, LoanData } from "./utils/interfaces";
import { ContractReceipt } from "ethers";
import { BToken } from "../../types/BToken";
import { tEthereumAddress } from "../../helpers/types";

const { expect } = chai;

const almostEqualOrEqual = function (
  this: any,
  expected: ReserveData | UserReserveData,
  actual: ReserveData | UserReserveData
) {
  const keys = Object.keys(actual);

  keys.forEach((key) => {
    if (key === "lastUpdateTimestamp" || key === "symbol" || key === "bTokenAddress" || key === "decimals") {
      // skipping consistency check on accessory data
      return;
    }

    this.assert(actual[key] != undefined, `Property ${key} is undefined in the actual data`);
    expect(expected[key] != undefined, `Property ${key} is undefined in the expected data`);

    if (expected[key] == null || actual[key] == null) {
      console.log("Found a undefined value for Key ", key, " value ", expected[key], actual[key]);
    }

    if (actual[key] instanceof BigNumber) {
      const actualValue = (<BigNumber>actual[key]).decimalPlaces(0, BigNumber.ROUND_DOWN);
      const expectedValue = (<BigNumber>expected[key]).decimalPlaces(0, BigNumber.ROUND_DOWN);

      this.assert(
        actualValue.eq(expectedValue) ||
          actualValue.plus(1).eq(expectedValue) ||
          actualValue.eq(expectedValue.plus(1)) ||
          actualValue.plus(2).eq(expectedValue) ||
          actualValue.eq(expectedValue.plus(2)) ||
          actualValue.plus(3).eq(expectedValue) ||
          actualValue.eq(expectedValue.plus(3)),
        `expected #{act} to be almost equal or equal #{exp} for property ${key}`,
        `expected #{act} to be almost equal or equal #{exp} for property ${key}`,
        expectedValue.toFixed(0),
        actualValue.toFixed(0)
      );
    } else {
      this.assert(
        actual[key] !== null && expected[key] !== null && actual[key].toString() === expected[key].toString(),
        `expected #{act} to be equal #{exp} for property ${key}`,
        `expected #{act} to be equal #{exp} for property ${key}`,
        expected[key],
        actual[key]
      );
    }
  });
};

chai.use(function (chai: any, utils: any) {
  chai.Assertion.overwriteMethod("almostEqualOrEqual", function (original: any) {
    return function (this: any, expected: ReserveData | UserReserveData) {
      const actual = (expected as ReserveData) ? <ReserveData>this._obj : <UserReserveData>this._obj;

      almostEqualOrEqual.apply(this, [expected, actual]);
    };
  });
});

interface ActionsConfig {
  skipIntegrityCheck: boolean;
}

export const configuration: ActionsConfig = <ActionsConfig>{};

export const mintERC20 = async (testEnv: TestEnv, user: SignerWithAddress, reserveSymbol: string, amount: string) => {
  const reserve = await getReserveAddressFromSymbol(reserveSymbol);

  const token = await getMintableERC20(reserve);

  await waitForTx(await token.connect(user.signer).mint(await convertToCurrencyDecimals(reserve, amount)));
};

export const mintERC721 = async (testEnv: TestEnv, user: SignerWithAddress, nftSymbol: string, tokenId: string) => {
  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const token = await getMintableERC721(nftAsset);

  await waitForTx(await token.connect(user.signer).mint(tokenId));
};

export const approveERC20 = async (testEnv: TestEnv, user: SignerWithAddress, reserveSymbol: string) => {
  const { pool } = testEnv;
  const reserve = await getReserveAddressFromSymbol(reserveSymbol);

  const token = await getMintableERC20(reserve);

  await waitForTx(await token.connect(user.signer).approve(pool.address, "100000000000000000000000000000"));
};

export const approveERC20PunkGateway = async (testEnv: TestEnv, user: SignerWithAddress, reserveSymbol: string) => {
  const { punkGateway } = testEnv;
  const reserve = await getReserveAddressFromSymbol(reserveSymbol);

  const token = await getMintableERC20(reserve);

  await waitForTx(await token.connect(user.signer).approve(punkGateway.address, MAX_UINT_AMOUNT));
};

export const approveERC721 = async (testEnv: TestEnv, user: SignerWithAddress, nftSymbol: string, tokenId: string) => {
  const { pool } = testEnv;
  const reserve = await getNftAddressFromSymbol(nftSymbol);

  const token = await getMintableERC721(reserve);

  await waitForTx(await token.connect(user.signer).approve(pool.address, tokenId));
};

export const setApprovalForAll = async (testEnv: TestEnv, user: SignerWithAddress, nftSymbol: string) => {
  const { pool } = testEnv;
  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const token = await getMintableERC721(nftAsset);

  await waitForTx(await token.connect(user.signer).setApprovalForAll(pool.address, true));
};

export const setApprovalForAllWETHGateway = async (testEnv: TestEnv, user: SignerWithAddress, nftSymbol: string) => {
  const { wethGateway } = testEnv;
  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const token = await getMintableERC721(nftAsset);

  await waitForTx(await token.connect(user.signer).setApprovalForAll(wethGateway.address, true));
};

export const setApprovalForAllExt = async (
  testEnv: TestEnv,
  user: SignerWithAddress,
  nftSymbol: string,
  operator: string
) => {
  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const token = await getMintableERC721(nftAsset);

  await waitForTx(await token.connect(user.signer).setApprovalForAll(operator, true));
};

/* Param:
 * debtAmount: without decimals
 * healthPercent: 0.5 -> 50% -> 50
 */
export const setNftAssetPriceForDebt = async (
  testEnv: TestEnv,
  nftSymbol: string,
  reserveSymbol: string,
  debtAmount: string,
  healthPercent: string
): Promise<{ oldNftPrice: string; newNftPrice: string }> => {
  const { nftOracle, reserveOracle, dataProvider } = testEnv;

  const priceAdmin = await getEthersSignerByAddress(await nftOracle.priceFeedAdmin());

  const reserve = await getReserveAddressFromSymbol(reserveSymbol);
  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const reserveToken = await getIErc20Detailed(reserve);
  const reservePrice = await reserveOracle.getAssetPrice(reserve);

  const oldNftPrice = await nftOracle.getAssetPrice(nftAsset);

  const debtAmountDecimals = await convertToCurrencyDecimals(reserve, debtAmount);

  const oneReserve = new BigNumber(Math.pow(10, await reserveToken.decimals()));
  const ethAmountDecimals = new BigNumber(debtAmountDecimals.toString())
    .multipliedBy(new BigNumber(reservePrice.toString()))
    .dividedBy(new BigNumber(oneReserve))
    .toFixed(0);

  const { liquidationThreshold } = await dataProvider.getNftConfigurationData(nftAsset);

  // (Price * LH / Debt = HF) => (Price * LH = Debt * HF) => (Price = Debt * HF / LH)
  // LH is 2 decimals
  const nftPrice = new BigNumber(ethAmountDecimals.toString())
    .percentMul(new BigNumber(healthPercent).multipliedBy(100))
    .percentDiv(new BigNumber(liquidationThreshold.toString()));
  if (nftPrice.lte(0)) {
    throw new Error("invalid zero nftPrice");
  }

  await advanceTimeAndBlock(100);
  await waitForTx(await nftOracle.connect(priceAdmin).setAssetData(nftAsset, nftPrice.toFixed(0)));
  await advanceTimeAndBlock(200);
  await waitForTx(await nftOracle.connect(priceAdmin).setAssetData(nftAsset, nftPrice.toFixed(0)));

  return { oldNftPrice: oldNftPrice.toString(), newNftPrice: nftPrice.toFixed(0) };
};

export const setNftAssetPrice = async (testEnv: TestEnv, nftSymbol: string, price: string): Promise<string> => {
  const { nftOracle, dataProvider } = testEnv;

  const priceAdmin = await getEthersSignerByAddress(await nftOracle.priceFeedAdmin());

  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const oldNftPrice = await nftOracle.getAssetPrice(nftAsset);

  const priceBN = new BigNumber(price).plus(1);
  await advanceTimeAndBlock(100);
  await waitForTx(await nftOracle.connect(priceAdmin).setAssetData(nftAsset, priceBN.toFixed(0)));
  await advanceTimeAndBlock(100);
  await waitForTx(await nftOracle.connect(priceAdmin).setAssetData(nftAsset, priceBN.toFixed(0)));
  return oldNftPrice.toString();
};

export const increaseRedeemDuration = async (testEnv: TestEnv, nftSymbol: string, isEnd: Boolean) => {
  const { dataProvider } = testEnv;

  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const nftCfgData = await dataProvider.getNftConfigurationData(nftAsset);
  if (isEnd) {
    await increaseTime(nftCfgData.redeemDuration.mul(ONE_DAY).add(ONE_HOUR).toNumber());
  } else {
    await increaseTime(nftCfgData.redeemDuration.mul(ONE_DAY).sub(ONE_HOUR).toNumber());
  }
};

export const increaseAuctionDuration = async (testEnv: TestEnv, nftSymbol: string, isEnd: Boolean) => {
  const { dataProvider } = testEnv;

  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const nftCfgData = await dataProvider.getNftConfigurationData(nftAsset);
  if (isEnd) {
    await increaseTime(nftCfgData.auctionDuration.mul(ONE_DAY).add(ONE_HOUR).toNumber());
  } else {
    await increaseTime(nftCfgData.auctionDuration.mul(ONE_DAY).sub(ONE_HOUR).toNumber());
  }
};

export const deposit = async (
  testEnv: TestEnv,
  sender: SignerWithAddress,
  sendValue: string,
  reserveSymbol: string,
  amount: string,
  onBehalfOf: tEthereumAddress,
  expectedResult: string,
  revertMessage?: string
) => {
  const { pool } = testEnv;

  const reserve = await getReserveAddressFromSymbol(reserveSymbol);

  const amountToDeposit = await convertToCurrencyDecimals(reserve, amount);

  const txOptions: any = {};

  const { reserveData: reserveDataBefore, userData: userDataBefore } = await getContractsData(
    reserve,
    onBehalfOf,
    testEnv,
    sender.address
  );

  if (sendValue) {
    txOptions.value = await convertToCurrencyDecimals(reserve, sendValue);
  }

  if (expectedResult === "success") {
    const txResult = await waitForTx(
      await pool.connect(sender.signer).deposit(reserve, amountToDeposit, onBehalfOf, "0", txOptions)
    );

    const {
      reserveData: reserveDataAfter,
      userData: userDataAfter,
      timestamp,
    } = await getContractsData(reserve, onBehalfOf, testEnv, sender.address);

    const { txCost, txTimestamp } = await getTxCostAndTimestamp(txResult);

    const expectedReserveData = calcExpectedReserveDataAfterDeposit(
      amountToDeposit.toString(),
      reserveDataBefore,
      txTimestamp
    );

    const expectedUserReserveData = calcExpectedUserDataAfterDeposit(
      amountToDeposit.toString(),
      reserveDataBefore,
      expectedReserveData,
      userDataBefore,
      txTimestamp,
      timestamp,
      txCost
    );

    expectEqual(reserveDataAfter, expectedReserveData);
    expectEqual(userDataAfter, expectedUserReserveData);
  } else if (expectedResult === "revert") {
    await expect(
      pool.connect(sender.signer).deposit(reserve, amountToDeposit, onBehalfOf, "0", txOptions),
      revertMessage
    ).to.be.reverted;
  }
};

export const withdraw = async (
  testEnv: TestEnv,
  user: SignerWithAddress,
  reserveSymbol: string,
  amount: string,
  expectedResult: string,
  revertMessage?: string
) => {
  const { pool } = testEnv;

  const {
    bTokenInstance,
    reserve,
    userData: userDataBefore,
    reserveData: reserveDataBefore,
  } = await getDataBeforeAction(reserveSymbol, user.address, testEnv);

  let amountToWithdraw = "0";

  if (amount !== "-1") {
    amountToWithdraw = (await convertToCurrencyDecimals(reserve, amount)).toString();
  } else {
    amountToWithdraw = MAX_UINT_AMOUNT;
  }

  if (expectedResult === "success") {
    const txResult = await waitForTx(await pool.connect(user.signer).withdraw(reserve, amountToWithdraw, user.address));

    const {
      reserveData: reserveDataAfter,
      userData: userDataAfter,
      timestamp,
    } = await getContractsData(reserve, user.address, testEnv);

    const { txCost, txTimestamp } = await getTxCostAndTimestamp(txResult);

    const expectedReserveData = calcExpectedReserveDataAfterWithdraw(
      amountToWithdraw,
      reserveDataBefore,
      userDataBefore,
      txTimestamp
    );

    const expectedUserData = calcExpectedUserDataAfterWithdraw(
      amountToWithdraw,
      reserveDataBefore,
      expectedReserveData,
      userDataBefore,
      txTimestamp,
      timestamp,
      txCost
    );

    expectEqual(reserveDataAfter, expectedReserveData);
    expectEqual(userDataAfter, expectedUserData);
  } else if (expectedResult === "revert") {
    await expect(pool.connect(user.signer).withdraw(reserve, amountToWithdraw, user.address), revertMessage).to.be
      .reverted;
  }
};

export const delegateBorrowAllowance = async (
  testEnv: TestEnv,
  user: SignerWithAddress,
  reserve: string,
  amount: string,
  receiver: tEthereumAddress,
  expectedResult: string,
  revertMessage?: string
) => {
  const { pool } = testEnv;

  const reserveAddress: tEthereumAddress = await getReserveAddressFromSymbol(reserve);

  const amountToDelegate: string = await (await convertToCurrencyDecimals(reserveAddress, amount)).toString();

  const reserveData = await pool.getReserveData(reserveAddress);

  const debtToken = await getDebtToken(reserveData.debtTokenAddress);

  const delegateAllowancePromise = debtToken.connect(user.signer).approveDelegation(receiver, amountToDelegate);

  if (expectedResult === "revert" && revertMessage) {
    await expect(delegateAllowancePromise, revertMessage).to.be.revertedWith(revertMessage);
    return;
  } else {
    await waitForTx(await delegateAllowancePromise);
    const allowance = await debtToken.borrowAllowance(user.address, receiver);
    expect(allowance.toString()).to.be.equal(amountToDelegate, "borrowAllowance is set incorrectly");
  }
};

export const borrow = async (
  testEnv: TestEnv,
  user: SignerWithAddress,
  reserveSymbol: string,
  amount: string,
  nftSymbol: string,
  nftTokenId: string,
  onBehalfOf: tEthereumAddress,
  timeTravel: string,
  expectedResult: string,
  revertMessage?: string
) => {
  const { pool } = testEnv;

  const reserve = await getReserveAddressFromSymbol(reserveSymbol);

  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const {
    reserveData: reserveDataBefore,
    userData: userDataBefore,
    loanData: loanDataBefore,
  } = await getContractsDataWithLoan(reserve, onBehalfOf, nftAsset, nftTokenId, "0", testEnv, user.address);

  const amountToBorrow = await convertToCurrencyDecimals(reserve, amount);

  if (expectedResult === "success") {
    const txResult = await waitForTx(
      await pool.connect(user.signer).borrow(reserve, amountToBorrow, nftAsset, nftTokenId, onBehalfOf, "0")
    );

    const { txCost, txTimestamp } = await getTxCostAndTimestamp(txResult);

    if (timeTravel) {
      const secondsToTravel = new BigNumber(timeTravel).multipliedBy(ONE_YEAR).div(365).toNumber();

      await advanceTimeAndBlock(secondsToTravel);
    }

    const {
      reserveData: reserveDataAfter,
      userData: userDataAfter,
      loanData: loanDataAfter,
      timestamp,
    } = await getContractsDataWithLoan(reserve, onBehalfOf, nftAsset, nftTokenId, "0", testEnv, user.address);

    const expectedReserveData = calcExpectedReserveDataAfterBorrow(
      amountToBorrow.toString(),
      reserveDataBefore,
      userDataBefore,
      txTimestamp,
      timestamp
    );

    const expectedUserData = calcExpectedUserDataAfterBorrow(
      amountToBorrow.toString(),
      reserveDataBefore,
      expectedReserveData,
      userDataBefore,
      txTimestamp,
      timestamp
    );

    const expectedLoanData = calcExpectedLoanDataAfterBorrow(
      amountToBorrow.toString(),
      loanDataBefore,
      loanDataAfter,
      expectedReserveData,
      txTimestamp,
      timestamp
    );
    //console.log("borrow", "actual", reserveDataAfter, "expected", expectedReserveData);
    //console.log("borrow", "actual", loanDataAfter, "expected", expectedLoanData);

    expectEqual(reserveDataAfter, expectedReserveData);
    expectEqual(userDataAfter, expectedUserData);
    expectEqual(loanDataAfter, expectedLoanData);
  } else if (expectedResult === "revert") {
    await expect(
      pool.connect(user.signer).borrow(reserve, amountToBorrow, nftAsset, nftTokenId, onBehalfOf, "0"),
      revertMessage
    ).to.be.reverted;
  }
};

export const repay = async (
  testEnv: TestEnv,
  user: SignerWithAddress,
  sendValue: string,
  nftSymbol: string,
  nftTokenId: string,
  amount: string,
  onBehalfOf: SignerWithAddress,
  expectedResult: string,
  revertMessage?: string
) => {
  const { pool, dataProvider } = testEnv;

  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const { reserveAsset } = await getLoanData(pool, dataProvider, nftAsset, nftTokenId, "0");

  const {
    reserveData: reserveDataBefore,
    userData: userDataBefore,
    loanData: loanDataBefore,
  } = await getContractsDataWithLoan(reserveAsset, onBehalfOf.address, nftAsset, nftTokenId, "0", testEnv);

  let amountToRepay = "0";

  if (amount !== "-1") {
    amountToRepay = (await convertToCurrencyDecimals(reserveAsset, amount)).toString();
  } else {
    amountToRepay = MAX_UINT_AMOUNT;
  }
  amountToRepay = "0x" + new BigNumber(amountToRepay).toString(16);

  const txOptions: any = {};

  if (sendValue) {
    const valueToSend = await convertToCurrencyDecimals(reserveAsset, sendValue);
    txOptions.value = "0x" + new BigNumber(valueToSend.toString()).toString(16);
  }

  if (expectedResult === "success") {
    const txResult = await waitForTx(
      await pool.connect(user.signer).repay(nftAsset, nftTokenId, amountToRepay, txOptions)
    );

    const { txCost, txTimestamp } = await getTxCostAndTimestamp(txResult);

    const {
      reserveData: reserveDataAfter,
      userData: userDataAfter,
      loanData: loanDataAfter,
      timestamp,
    } = await getContractsDataWithLoan(
      reserveAsset,
      onBehalfOf.address,
      nftAsset,
      nftTokenId,
      loanDataBefore.loanId.toString(),
      testEnv
    );

    const expectedReserveData = calcExpectedReserveDataAfterRepay(
      amountToRepay,
      reserveDataBefore,
      userDataBefore,
      txTimestamp,
      timestamp
    );

    const expectedUserData = calcExpectedUserDataAfterRepay(
      amountToRepay,
      reserveDataBefore,
      expectedReserveData,
      userDataBefore,
      user.address,
      onBehalfOf.address,
      txTimestamp,
      timestamp
    );

    const expectedLoanData = calcExpectedLoanDataAfterRepay(
      amountToRepay,
      reserveDataBefore,
      expectedReserveData,
      loanDataBefore,
      loanDataAfter,
      user.address,
      onBehalfOf.address,
      txTimestamp,
      timestamp
    );
    //console.log("repay", "actual", loanDataAfter, "expected", expectedLoanData);

    expectEqual(reserveDataAfter, expectedReserveData);
    expectEqual(userDataAfter, expectedUserData);
    expectEqual(loanDataAfter, expectedLoanData);
  } else if (expectedResult === "revert") {
    await expect(pool.connect(user.signer).repay(nftAsset, nftTokenId, amountToRepay, txOptions), revertMessage).to.be
      .reverted;
  }
};

export const auction = async (
  testEnv: TestEnv,
  user: SignerWithAddress,
  nftSymbol: string,
  nftTokenId: string,
  price: string,
  onBehalfOf: SignerWithAddress,
  isFirstTime: Boolean,
  expectedResult: string,
  revertMessage?: string
) => {
  const { pool, dataProvider } = testEnv;

  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const { reserveAsset, borrower } = await getLoanData(pool, dataProvider, nftAsset, nftTokenId, "0");

  const {
    reserveData: reserveDataBefore,
    userData: userDataBefore,
    loanData: loanDataBefore,
  } = await getContractsDataWithLoan(reserveAsset, borrower, nftAsset, nftTokenId, "0", testEnv, user.address);

  let amountToAuction = (await convertToCurrencyDecimals(reserveAsset, price)).toString();

  amountToAuction = "0x" + new BigNumber(amountToAuction).toString(16);

  if (isFirstTime && expectedResult === "success") {
    const txResult = await waitForTx(
      await pool.connect(user.signer).auction(nftAsset, nftTokenId, amountToAuction, onBehalfOf.address)
    );

    const { txCost, txTimestamp } = await getTxCostAndTimestamp(txResult);
  } else if (expectedResult === "success") {
    const txResult = await waitForTx(
      await pool.connect(user.signer).auction(nftAsset, nftTokenId, amountToAuction, onBehalfOf.address)
    );

    const { txCost, txTimestamp } = await getTxCostAndTimestamp(txResult);

    const {
      reserveData: reserveDataAfter,
      userData: userDataAfter,
      loanData: loanDataAfter,
      timestamp,
    } = await getContractsDataWithLoan(
      reserveAsset,
      borrower,
      nftAsset,
      nftTokenId,
      loanDataBefore.loanId.toString(),
      testEnv,
      user.address
    );

    const expectedReserveData = calcExpectedReserveDataAfterAuction(
      amountToAuction,
      reserveDataBefore,
      userDataBefore,
      loanDataBefore,
      txTimestamp,
      timestamp
    );

    const expectedUserData = calcExpectedUserDataAfterAuction(
      reserveDataBefore,
      expectedReserveData,
      userDataBefore,
      loanDataBefore,
      user.address,
      onBehalfOf.address,
      amountToAuction,
      txTimestamp,
      timestamp
    );

    const expectedLoanData = calcExpectedLoanDataAfterAuction(
      amountToAuction,
      reserveDataBefore,
      expectedReserveData,
      loanDataBefore,
      loanDataAfter,
      user.address,
      onBehalfOf.address,
      txTimestamp,
      timestamp
    );

    expectEqual(reserveDataAfter, expectedReserveData);
    expectEqual(userDataAfter, expectedUserData);
    expectEqual(loanDataAfter, expectedLoanData);
  } else if (expectedResult === "revert") {
    await expect(
      pool.connect(user.signer).auction(nftAsset, nftTokenId, amountToAuction, onBehalfOf.address),
      revertMessage
    ).to.be.reverted;
  }
};

export const redeem = async (
  testEnv: TestEnv,
  user: SignerWithAddress,
  nftSymbol: string,
  nftTokenId: string,
  amount: string,
  expectedResult: string,
  revertMessage?: string
) => {
  const { pool, dataProvider } = testEnv;

  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const { reserveAsset, borrower } = await getLoanData(pool, dataProvider, nftAsset, nftTokenId, "0");

  const {
    reserveData: reserveDataBefore,
    userData: userDataBefore,
    loanData: loanDataBefore,
  } = await getContractsDataWithLoan(reserveAsset, borrower, nftAsset, nftTokenId, "0", testEnv, user.address);

  let amountToRedeem = "0";

  if (amount !== "-1") {
    amountToRedeem = (await convertToCurrencyDecimals(reserveAsset, amount)).toString();
  } else {
    amountToRedeem = loanDataBefore.currentAmount.multipliedBy(0.51).toFixed(0); //50% Debt
  }
  amountToRedeem = "0x" + new BigNumber(amountToRedeem).toString(16);

  let bidFineAmount = loanDataBefore.bidBorrowAmount.multipliedBy(1.1).toFixed(0);

  if (expectedResult === "success") {
    const txResult = await waitForTx(
      await pool.connect(user.signer).redeem(nftAsset, nftTokenId, amountToRedeem, bidFineAmount)
    );

    const { txCost, txTimestamp } = await getTxCostAndTimestamp(txResult);

    const {
      reserveData: reserveDataAfter,
      userData: userDataAfter,
      loanData: loanDataAfter,
      timestamp,
    } = await getContractsDataWithLoan(
      reserveAsset,
      borrower,
      nftAsset,
      nftTokenId,
      loanDataBefore.loanId.toString(),
      testEnv,
      user.address
    );

    const expectedReserveData = calcExpectedReserveDataAfterRedeem(
      amountToRedeem,
      reserveDataBefore,
      userDataBefore,
      loanDataBefore,
      txTimestamp,
      timestamp
    );

    const expectedUserData = calcExpectedUserDataAfterRedeem(
      reserveDataBefore,
      expectedReserveData,
      userDataBefore,
      loanDataBefore,
      user.address,
      amountToRedeem,
      txTimestamp,
      timestamp
    );

    const expectedLoanData = calcExpectedLoanDataAfterRedeem(
      amountToRedeem,
      reserveDataBefore,
      expectedReserveData,
      loanDataBefore,
      loanDataAfter,
      user.address,
      txTimestamp,
      timestamp
    );

    expectEqual(reserveDataAfter, expectedReserveData);
    expectEqual(userDataAfter, expectedUserData);
    expectEqual(loanDataAfter, expectedLoanData);
  } else if (expectedResult === "revert") {
    await expect(pool.connect(user.signer).redeem(nftAsset, nftTokenId, amountToRedeem, bidFineAmount), revertMessage)
      .to.be.reverted;
  }
};

export const liquidate = async (
  testEnv: TestEnv,
  user: SignerWithAddress,
  nftSymbol: string,
  nftTokenId: string,
  amount: string,
  expectedResult: string,
  revertMessage?: string
) => {
  const { pool, dataProvider } = testEnv;

  const nftAsset = await getNftAddressFromSymbol(nftSymbol);

  const { reserveAsset, borrower } = await getLoanData(pool, dataProvider, nftAsset, nftTokenId, "0");

  const {
    reserveData: reserveDataBefore,
    userData: userDataBefore,
    loanData: loanDataBefore,
  } = await getContractsDataWithLoan(reserveAsset, borrower, nftAsset, nftTokenId, "0", testEnv, user.address);

  if (expectedResult === "success") {
    const txResult = await waitForTx(await pool.connect(user.signer).liquidate(nftAsset, nftTokenId, amount));

    const { txCost, txTimestamp } = await getTxCostAndTimestamp(txResult);

    const {
      reserveData: reserveDataAfter,
      userData: userDataAfter,
      loanData: loanDataAfter,
      timestamp,
    } = await getContractsDataWithLoan(
      reserveAsset,
      borrower,
      nftAsset,
      nftTokenId,
      loanDataBefore.loanId.toString(),
      testEnv,
      user.address
    );

    const expectedReserveData = calcExpectedReserveDataAfterLiquidate(
      reserveDataBefore,
      userDataBefore,
      loanDataBefore,
      txTimestamp,
      timestamp
    );

    const expectedUserData = calcExpectedUserDataAfterLiquidate(
      reserveDataBefore,
      expectedReserveData,
      userDataBefore,
      loanDataBefore,
      user.address,
      txTimestamp,
      timestamp
    );

    const expectedLoanData = calcExpectedLoanDataAfterLiquidate(
      reserveDataBefore,
      expectedReserveData,
      loanDataBefore,
      loanDataAfter,
      user.address,
      txTimestamp,
      timestamp
    );

    expectEqual(reserveDataAfter, expectedReserveData);
    expectEqual(userDataAfter, expectedUserData);
    expectEqual(loanDataAfter, expectedLoanData);
  } else if (expectedResult === "revert") {
    await expect(pool.connect(user.signer).liquidate(nftAsset, nftTokenId, amount), revertMessage).to.be.reverted;
  }
};

const expectEqual = (
  actual: UserReserveData | ReserveData | LoanData,
  expected: UserReserveData | ReserveData | LoanData
) => {
  //console.log("expectEqual", actual, expected);
  if (!configuration.skipIntegrityCheck) {
    // @ts-ignore
    expect(actual).to.be.almostEqualOrEqual(expected);
  }
};

interface ActionData {
  reserve: string;
  reserveData: ReserveData;
  userData: UserReserveData;
  bTokenInstance: BToken;
}

const getDataBeforeAction = async (
  reserveSymbol: string,
  user: tEthereumAddress,
  testEnv: TestEnv
): Promise<ActionData> => {
  const reserve = await getReserveAddressFromSymbol(reserveSymbol);

  const { reserveData, userData } = await getContractsData(reserve, user, testEnv);
  const bTokenInstance = await getBToken(reserveData.bTokenAddress);
  return {
    reserve,
    reserveData,
    userData,
    bTokenInstance,
  };
};

export const getTxCostAndTimestamp = async (tx: ContractReceipt) => {
  if (!tx.blockNumber || !tx.transactionHash || !tx.cumulativeGasUsed) {
    throw new Error("No tx blocknumber");
  }
  const txTimestamp = new BigNumber((await DRE.ethers.provider.getBlock(tx.blockNumber)).timestamp);

  const txInfo = await DRE.ethers.provider.getTransaction(tx.transactionHash);

  let gasPrice = "1";
  if (txInfo.gasPrice != undefined) {
    gasPrice = txInfo.gasPrice.toString();
  }
  const txCost = new BigNumber(tx.cumulativeGasUsed.toString()).multipliedBy(gasPrice);

  return { txCost, txTimestamp };
};

export const getContractsData = async (reserve: string, user: string, testEnv: TestEnv, sender?: string) => {
  const { pool, dataProvider } = testEnv;

  const [userData, reserveData, timestamp] = await Promise.all([
    getUserData(pool, dataProvider, reserve, user, sender || user),
    getReserveData(dataProvider, reserve),
    timeLatest(),
  ]);

  return {
    reserveData,
    userData,
    timestamp: new BigNumber(timestamp),
  };
};

export const getContractsDataWithLoan = async (
  reserve: string,
  user: string,
  nftAsset: string,
  nftTokenId: string,
  loanId: string,
  testEnv: TestEnv,
  sender?: string
) => {
  const { pool, dataProvider } = testEnv;

  const [userData, reserveData, loanData, timestamp] = await Promise.all([
    getUserData(pool, dataProvider, reserve, user, sender || user),
    getReserveData(dataProvider, reserve),
    getLoanData(pool, dataProvider, nftAsset, nftTokenId, loanId),
    timeLatest(),
  ]);

  return {
    reserveData,
    userData,
    loanData,
    timestamp: new BigNumber(timestamp),
  };
};

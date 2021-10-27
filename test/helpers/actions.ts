import BigNumber from "bignumber.js";

import {
  calcExpectedReserveDataAfterBorrow,
  calcExpectedReserveDataAfterDeposit,
  calcExpectedReserveDataAfterRepay,
  calcExpectedReserveDataAfterWithdraw,
  calcExpectedUserDataAfterBorrow,
  calcExpectedUserDataAfterDeposit,
  calcExpectedUserDataAfterRepay,
  calcExpectedUserDataAfterWithdraw,
} from "./utils/calculations";
import {
  getReserveAddressFromSymbol,
  getNftAddressFromSymbol,
  getReserveData,
  getUserData,
  getLoanData,
} from "./utils/helpers";

import { convertToCurrencyDecimals } from "../../helpers/contracts-helpers";
import { getBToken, getMintableERC20, getMintableERC721, getLendPoolLoanProxy } from "../../helpers/contracts-getters";
import { MAX_UINT_AMOUNT, ONE_YEAR } from "../../helpers/constants";
import { SignerWithAddress, TestEnv } from "./make-suite";
import { advanceTimeAndBlock, DRE, timeLatest, waitForTx } from "../../helpers/misc-utils";

import chai from "chai";
import { ReserveData, UserReserveData } from "./utils/interfaces";
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

  const { reserveData: reserveDataBefore, userData: userDataBefore } = await getContractsData(
    reserve,
    onBehalfOf,
    testEnv,
    user.address
  );

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
      timestamp,
    } = await getContractsData(reserve, onBehalfOf, testEnv, user.address);

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
    //console.log("actual", reserveDataAfter, "expected", expectedReserveData);

    expectEqual(reserveDataAfter, expectedReserveData);
    expectEqual(userDataAfter, expectedUserData);
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

  const { reserveAsset } = await getLoanData(pool, dataProvider, nftAsset, nftTokenId, onBehalfOf.address);

  const { reserveData: reserveDataBefore, userData: userDataBefore } = await getContractsData(
    reserveAsset,
    onBehalfOf.address,
    testEnv
  );

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
      timestamp,
    } = await getContractsData(reserveAsset, onBehalfOf.address, testEnv);

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

    expectEqual(reserveDataAfter, expectedReserveData);
    expectEqual(userDataAfter, expectedUserData);
  } else if (expectedResult === "revert") {
    await expect(pool.connect(user.signer).repay(nftAsset, nftTokenId, amountToRepay, txOptions), revertMessage).to.be
      .reverted;
  }
};

const expectEqual = (actual: UserReserveData | ReserveData, expected: UserReserveData | ReserveData) => {
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
  const txCost = new BigNumber(tx.cumulativeGasUsed.toString()).multipliedBy(txInfo.gasPrice.toString());

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

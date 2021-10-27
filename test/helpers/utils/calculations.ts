import BigNumber from "bignumber.js";
import { ONE_YEAR, RAY, MAX_UINT_AMOUNT, PERCENTAGE_FACTOR } from "../../../helpers/constants";
import { IReserveParams, iBendPoolAssets, tEthereumAddress } from "../../../helpers/types";
import "./math";
import { ReserveData, UserReserveData, LoanData } from "./interfaces";
import { expect } from "chai";

export const strToBN = (amount: string): BigNumber => new BigNumber(amount);

interface Configuration {
  reservesParams: iBendPoolAssets<IReserveParams>;
}

export const configuration: Configuration = <Configuration>{};

export const calcExpectedUserDataAfterDeposit = (
  amountDeposited: string,
  reserveDataBeforeAction: ReserveData,
  reserveDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber,
  txCost: BigNumber
): UserReserveData => {
  const expectedUserData = <UserReserveData>{};

  expectedUserData.currentVariableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  expectedUserData.scaledVariableDebt = userDataBeforeAction.scaledVariableDebt;
  expectedUserData.variableBorrowIndex = userDataBeforeAction.variableBorrowIndex;

  expectedUserData.liquidityRate = reserveDataAfterAction.liquidityRate;

  expectedUserData.scaledBTokenBalance = calcExpectedScaledBTokenBalance(
    userDataBeforeAction,
    reserveDataAfterAction.liquidityIndex,
    new BigNumber(amountDeposited),
    new BigNumber(0)
  );
  expectedUserData.currentBTokenBalance = calcExpectedBTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  ).plus(amountDeposited);

  expectedUserData.variableBorrowIndex = userDataBeforeAction.variableBorrowIndex;
  expectedUserData.walletBalance = userDataBeforeAction.walletBalance.minus(amountDeposited);

  expectedUserData.currentVariableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  return expectedUserData;
};

export const calcExpectedUserDataAfterWithdraw = (
  amountWithdrawn: string,
  reserveDataBeforeAction: ReserveData,
  reserveDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber,
  txCost: BigNumber
): UserReserveData => {
  const expectedUserData = <UserReserveData>{};

  const bTokenBalance = calcExpectedBTokenBalance(reserveDataBeforeAction, userDataBeforeAction, txTimestamp);

  if (amountWithdrawn == MAX_UINT_AMOUNT) {
    amountWithdrawn = bTokenBalance.toFixed(0);
  }

  expectedUserData.scaledBTokenBalance = calcExpectedScaledBTokenBalance(
    userDataBeforeAction,
    reserveDataAfterAction.liquidityIndex,
    new BigNumber(0),
    new BigNumber(amountWithdrawn)
  );

  expectedUserData.currentBTokenBalance = bTokenBalance.minus(amountWithdrawn);

  expectedUserData.scaledVariableDebt = userDataBeforeAction.scaledVariableDebt;

  expectedUserData.currentVariableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  expectedUserData.variableBorrowIndex = userDataBeforeAction.variableBorrowIndex;

  expectedUserData.liquidityRate = reserveDataAfterAction.liquidityRate;

  expectedUserData.walletBalance = userDataBeforeAction.walletBalance.plus(amountWithdrawn);

  return expectedUserData;
};

export const calcExpectedReserveDataAfterDeposit = (
  amountDeposited: string,
  reserveDataBeforeAction: ReserveData,
  txTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData: ReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  expectedReserveData.totalLiquidity = new BigNumber(reserveDataBeforeAction.totalLiquidity).plus(amountDeposited);
  expectedReserveData.availableLiquidity = new BigNumber(reserveDataBeforeAction.availableLiquidity).plus(
    amountDeposited
  );

  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(reserveDataBeforeAction, txTimestamp);
  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(reserveDataBeforeAction, txTimestamp);

  expectedReserveData.totalVariableDebt = calcExpectedTotalVariableDebt(
    reserveDataBeforeAction,
    expectedReserveData.variableBorrowIndex
  );

  expectedReserveData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt;

  expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
    expectedReserveData.totalVariableDebt,
    expectedReserveData.totalLiquidity
  );
  const rates = calcExpectedInterestRates(
    reserveDataBeforeAction.symbol,
    expectedReserveData.utilizationRate,
    expectedReserveData.totalVariableDebt
  );
  expectedReserveData.liquidityRate = rates[0];
  expectedReserveData.variableBorrowRate = rates[1];

  return expectedReserveData;
};

export const calcExpectedReserveDataAfterWithdraw = (
  amountWithdrawn: string,
  reserveDataBeforeAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData: ReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  if (amountWithdrawn == MAX_UINT_AMOUNT) {
    amountWithdrawn = calcExpectedBTokenBalance(reserveDataBeforeAction, userDataBeforeAction, txTimestamp).toFixed();
  }

  expectedReserveData.availableLiquidity = new BigNumber(reserveDataBeforeAction.availableLiquidity).minus(
    amountWithdrawn
  );

  expectedReserveData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt;

  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(reserveDataBeforeAction, txTimestamp);
  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(reserveDataBeforeAction, txTimestamp);

  expectedReserveData.totalVariableDebt = expectedReserveData.scaledVariableDebt.rayMul(
    expectedReserveData.variableBorrowIndex
  );

  expectedReserveData.totalLiquidity = new BigNumber(reserveDataBeforeAction.availableLiquidity)
    .minus(amountWithdrawn)
    .plus(expectedReserveData.totalVariableDebt);

  expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
    expectedReserveData.totalVariableDebt,
    expectedReserveData.totalLiquidity
  );
  const rates = calcExpectedInterestRates(
    reserveDataBeforeAction.symbol,
    expectedReserveData.utilizationRate,
    expectedReserveData.totalVariableDebt
  );
  expectedReserveData.liquidityRate = rates[0];
  expectedReserveData.variableBorrowRate = rates[1];

  return expectedReserveData;
};

export const calcExpectedReserveDataAfterBorrow = (
  amountBorrowed: string,
  reserveDataBeforeAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  const amountBorrowedBN = new BigNumber(amountBorrowed);

  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(reserveDataBeforeAction, txTimestamp);

  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(reserveDataBeforeAction, txTimestamp);

  expectedReserveData.availableLiquidity = reserveDataBeforeAction.availableLiquidity.minus(amountBorrowedBN);

  expectedReserveData.lastUpdateTimestamp = txTimestamp;

  {
    expectedReserveData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt.plus(
      amountBorrowedBN.rayDiv(expectedReserveData.variableBorrowIndex)
    );

    const totalVariableDebtAfterTx = expectedReserveData.scaledVariableDebt.rayMul(
      expectedReserveData.variableBorrowIndex
    );

    const utilizationRateAfterTx = calcExpectedUtilizationRate(
      totalVariableDebtAfterTx,
      expectedReserveData.availableLiquidity.plus(totalVariableDebtAfterTx)
    );

    const rates = calcExpectedInterestRates(
      reserveDataBeforeAction.symbol,
      utilizationRateAfterTx,
      totalVariableDebtAfterTx
    );

    expectedReserveData.liquidityRate = rates[0];

    expectedReserveData.variableBorrowRate = rates[1];

    expectedReserveData.totalVariableDebt = expectedReserveData.scaledVariableDebt.rayMul(
      calcExpectedReserveNormalizedDebt(
        expectedReserveData.variableBorrowRate,
        expectedReserveData.variableBorrowIndex,
        txTimestamp,
        currentTimestamp
      )
    );

    expectedReserveData.totalLiquidity = expectedReserveData.availableLiquidity.plus(
      expectedReserveData.totalVariableDebt
    );

    expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
      expectedReserveData.totalVariableDebt,
      expectedReserveData.totalLiquidity
    );
  }

  return expectedReserveData;
};

export const calcExpectedReserveDataAfterRepay = (
  amountRepaid: string,
  reserveDataBeforeAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber
): ReserveData => {
  const expectedReserveData: ReserveData = <ReserveData>{};

  expectedReserveData.address = reserveDataBeforeAction.address;

  let amountRepaidBN = new BigNumber(amountRepaid);

  const userVariableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );

  //if amount repaid == MAX_UINT_AMOUNT, user is repaying everything
  if (amountRepaidBN.abs().eq(MAX_UINT_AMOUNT)) {
    amountRepaidBN = userVariableDebt;
  }

  expectedReserveData.liquidityIndex = calcExpectedLiquidityIndex(reserveDataBeforeAction, txTimestamp);
  expectedReserveData.variableBorrowIndex = calcExpectedVariableBorrowIndex(reserveDataBeforeAction, txTimestamp);

  {
    expectedReserveData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt.minus(
      amountRepaidBN.rayDiv(expectedReserveData.variableBorrowIndex)
    );

    expectedReserveData.totalVariableDebt = expectedReserveData.scaledVariableDebt.rayMul(
      expectedReserveData.variableBorrowIndex
    );
  }

  expectedReserveData.availableLiquidity = reserveDataBeforeAction.availableLiquidity.plus(amountRepaidBN);

  expectedReserveData.totalLiquidity = expectedReserveData.availableLiquidity.plus(
    expectedReserveData.totalVariableDebt
  );

  expectedReserveData.utilizationRate = calcExpectedUtilizationRate(
    expectedReserveData.totalVariableDebt,
    expectedReserveData.totalLiquidity
  );

  const rates = calcExpectedInterestRates(
    reserveDataBeforeAction.symbol,
    expectedReserveData.utilizationRate,
    expectedReserveData.totalVariableDebt
  );
  expectedReserveData.liquidityRate = rates[0];

  expectedReserveData.variableBorrowRate = rates[1];

  expectedReserveData.lastUpdateTimestamp = txTimestamp;

  return expectedReserveData;
};

export const calcExpectedUserDataAfterBorrow = (
  amountBorrowed: string,
  reserveDataBeforeAction: ReserveData,
  expectedDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber
): UserReserveData => {
  const expectedUserData = <UserReserveData>{};

  const amountBorrowedBN = new BigNumber(amountBorrowed);

  {
    expectedUserData.scaledVariableDebt = reserveDataBeforeAction.scaledVariableDebt.plus(
      amountBorrowedBN.rayDiv(expectedDataAfterAction.variableBorrowIndex)
    );
  }

  expectedUserData.currentVariableDebt = calcExpectedVariableDebtTokenBalance(
    expectedDataAfterAction,
    expectedUserData,
    currentTimestamp
  );

  expectedUserData.liquidityRate = expectedDataAfterAction.liquidityRate;

  expectedUserData.currentBTokenBalance = calcExpectedBTokenBalance(
    expectedDataAfterAction,
    userDataBeforeAction,
    currentTimestamp
  );

  expectedUserData.scaledBTokenBalance = userDataBeforeAction.scaledBTokenBalance;

  expectedUserData.walletBalance = userDataBeforeAction.walletBalance.plus(amountBorrowed);

  return expectedUserData;
};

export const calcExpectedUserDataAfterRepay = (
  totalRepaid: string,
  reserveDataBeforeAction: ReserveData,
  expectedDataAfterAction: ReserveData,
  userDataBeforeAction: UserReserveData,
  user: string,
  onBehalfOf: string,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber
): UserReserveData => {
  const expectedUserData = <UserReserveData>{};

  const variableDebt = calcExpectedVariableDebtTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    currentTimestamp
  );

  let totalRepaidBN = new BigNumber(totalRepaid);
  if (totalRepaidBN.abs().eq(MAX_UINT_AMOUNT)) {
    totalRepaidBN = variableDebt;
  }

  {
    expectedUserData.scaledVariableDebt = userDataBeforeAction.scaledVariableDebt.minus(
      totalRepaidBN.rayDiv(expectedDataAfterAction.variableBorrowIndex)
    );
    expectedUserData.currentVariableDebt = expectedUserData.scaledVariableDebt.rayMul(
      expectedDataAfterAction.variableBorrowIndex
    );
  }

  expectedUserData.liquidityRate = expectedDataAfterAction.liquidityRate;

  expectedUserData.currentBTokenBalance = calcExpectedBTokenBalance(
    reserveDataBeforeAction,
    userDataBeforeAction,
    txTimestamp
  );
  expectedUserData.scaledBTokenBalance = userDataBeforeAction.scaledBTokenBalance;

  if (user === onBehalfOf) {
    expectedUserData.walletBalance = userDataBeforeAction.walletBalance.minus(totalRepaidBN);
  } else {
    //wallet balance didn't change
    expectedUserData.walletBalance = userDataBeforeAction.walletBalance;
  }

  return expectedUserData;
};

export const calcExpectedLoanDataAfterBorrow = (
  amountBorrowed: string,
  loanDataBeforeAction: LoanData,
  loanDataAfterAction: LoanData,
  expectedDataAfterAction: ReserveData,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber
): LoanData => {
  const expectedLoanData = <LoanData>{};

  const amountBorrowedBN = new BigNumber(amountBorrowed);

  expectedLoanData.state = new BigNumber(loanDataAfterAction.state);
  expectedLoanData.borrower = loanDataAfterAction.borrower.toString();
  expectedLoanData.nftAsset = loanDataAfterAction.nftAsset.toString();
  expectedLoanData.nftTokenId = new BigNumber(loanDataAfterAction.nftTokenId);
  expectedLoanData.reserveAsset = loanDataAfterAction.reserveAsset;

  {
    expectedLoanData.scaledAmount = loanDataBeforeAction.scaledAmount.plus(
      amountBorrowedBN.rayDiv(expectedDataAfterAction.variableBorrowIndex)
    );
  }

  expectedLoanData.currentAmount = calcExpectedLoanBorrowBalance(
    expectedDataAfterAction,
    expectedLoanData,
    currentTimestamp
  );

  return expectedLoanData;
};

export const calcExpectedLoanDataAfterRepay = (
  totalRepaid: string,
  reserveDataBeforeAction: ReserveData,
  expectedDataAfterAction: ReserveData,
  loanDataBeforeAction: LoanData,
  loanDataAfterAction: LoanData,
  user: string,
  onBehalfOf: string,
  txTimestamp: BigNumber,
  currentTimestamp: BigNumber
): LoanData => {
  const expectedLoanData = <LoanData>{};

  expectedLoanData.state = new BigNumber(loanDataAfterAction.state);
  expectedLoanData.borrower = loanDataAfterAction.borrower.toString();
  expectedLoanData.nftAsset = loanDataAfterAction.nftAsset.toString();
  expectedLoanData.nftTokenId = new BigNumber(loanDataAfterAction.nftTokenId);
  expectedLoanData.reserveAsset = loanDataAfterAction.reserveAsset;

  const borrowAmount = calcExpectedLoanBorrowBalance(reserveDataBeforeAction, loanDataBeforeAction, currentTimestamp);

  let totalRepaidBN = new BigNumber(totalRepaid);
  if (totalRepaidBN.abs().eq(MAX_UINT_AMOUNT)) {
    totalRepaidBN = borrowAmount;
  }

  {
    expectedLoanData.scaledAmount = loanDataBeforeAction.scaledAmount.minus(
      totalRepaidBN.rayDiv(expectedDataAfterAction.variableBorrowIndex)
    );
    expectedLoanData.currentAmount = expectedLoanData.scaledAmount.rayMul(expectedDataAfterAction.variableBorrowIndex);
  }

  return expectedLoanData;
};

const calcExpectedScaledBTokenBalance = (
  userDataBeforeAction: UserReserveData,
  index: BigNumber,
  amountAdded: BigNumber,
  amountTaken: BigNumber
) => {
  return userDataBeforeAction.scaledBTokenBalance.plus(amountAdded.rayDiv(index)).minus(amountTaken.rayDiv(index));
};

export const calcExpectedBTokenBalance = (
  reserveData: ReserveData,
  userData: UserReserveData,
  currentTimestamp: BigNumber
) => {
  const index = calcExpectedReserveNormalizedIncome(reserveData, currentTimestamp);

  const { scaledBTokenBalance: scaledBalanceBeforeAction } = userData;

  return scaledBalanceBeforeAction.rayMul(index);
};

export const calcExpectedVariableDebtTokenBalance = (
  reserveData: ReserveData,
  userData: UserReserveData,
  currentTimestamp: BigNumber
) => {
  const normalizedDebt = calcExpectedReserveNormalizedDebt(
    reserveData.variableBorrowRate,
    reserveData.variableBorrowIndex,
    reserveData.lastUpdateTimestamp,
    currentTimestamp
  );

  const { scaledVariableDebt } = userData;

  return scaledVariableDebt.rayMul(normalizedDebt);
};

export const calcExpectedLoanBorrowBalance = (
  reserveData: ReserveData,
  loanData: LoanData,
  currentTimestamp: BigNumber
) => {
  const normalizedDebt = calcExpectedReserveNormalizedDebt(
    reserveData.variableBorrowRate,
    reserveData.variableBorrowIndex,
    reserveData.lastUpdateTimestamp,
    currentTimestamp
  );

  const { scaledAmount } = loanData;

  return scaledAmount.rayMul(normalizedDebt);
};

const calcLinearInterest = (rate: BigNumber, currentTimestamp: BigNumber, lastUpdateTimestamp: BigNumber) => {
  const timeDifference = currentTimestamp.minus(lastUpdateTimestamp);

  const cumulatedInterest = rate.multipliedBy(timeDifference).dividedBy(new BigNumber(ONE_YEAR)).plus(RAY);

  return cumulatedInterest;
};

const calcCompoundedInterest = (rate: BigNumber, currentTimestamp: BigNumber, lastUpdateTimestamp: BigNumber) => {
  const timeDifference = currentTimestamp.minus(lastUpdateTimestamp);

  if (timeDifference.eq(0)) {
    return new BigNumber(RAY);
  }

  const expMinusOne = timeDifference.minus(1);
  const expMinusTwo = timeDifference.gt(2) ? timeDifference.minus(2) : 0;

  const ratePerSecond = rate.div(ONE_YEAR);

  const basePowerTwo = ratePerSecond.rayMul(ratePerSecond);
  const basePowerThree = basePowerTwo.rayMul(ratePerSecond);

  const secondTerm = timeDifference.times(expMinusOne).times(basePowerTwo).div(2);
  const thirdTerm = timeDifference.times(expMinusOne).times(expMinusTwo).times(basePowerThree).div(6);

  return new BigNumber(RAY).plus(ratePerSecond.times(timeDifference)).plus(secondTerm).plus(thirdTerm);
};

export const calcExpectedInterestRates = (
  reserveSymbol: string,
  utilizationRate: BigNumber,
  totalVariableDebt: BigNumber
): BigNumber[] => {
  const { reservesParams } = configuration;

  const reserveIndex = Object.keys(reservesParams).findIndex((value) => value === reserveSymbol);
  const [, reserveConfiguration] = (Object.entries(reservesParams) as [string, IReserveParams][])[reserveIndex];

  let variableBorrowRate: BigNumber = new BigNumber(reserveConfiguration.strategy.baseVariableBorrowRate);

  const optimalRate = new BigNumber(reserveConfiguration.strategy.optimalUtilizationRate);
  const excessRate = new BigNumber(RAY).minus(optimalRate);
  if (utilizationRate.gt(optimalRate)) {
    const excessUtilizationRateRatio = utilizationRate
      .minus(reserveConfiguration.strategy.optimalUtilizationRate)
      .rayDiv(excessRate);

    variableBorrowRate = variableBorrowRate
      .plus(reserveConfiguration.strategy.variableRateSlope1)
      .plus(new BigNumber(reserveConfiguration.strategy.variableRateSlope2).rayMul(excessUtilizationRateRatio));
  } else {
    variableBorrowRate = variableBorrowRate.plus(
      utilizationRate.rayDiv(optimalRate).rayMul(new BigNumber(reserveConfiguration.strategy.variableRateSlope1))
    );
  }

  const expectedOverallRate = calcExpectedOverallBorrowRate(totalVariableDebt, variableBorrowRate);
  const liquidityRate = expectedOverallRate
    .rayMul(utilizationRate)
    .percentMul(new BigNumber(PERCENTAGE_FACTOR).minus(reserveConfiguration.reserveFactor));

  return [liquidityRate, variableBorrowRate];
};

export const calcExpectedOverallBorrowRate = (
  totalVariableDebt: BigNumber,
  currentVariableBorrowRate: BigNumber
): BigNumber => {
  const totalBorrows = totalVariableDebt;

  if (totalBorrows.eq(0)) return strToBN("0");

  const weightedVariableRate = totalVariableDebt.wadToRay().rayMul(currentVariableBorrowRate);

  const overallBorrowRate = weightedVariableRate.rayDiv(totalBorrows.wadToRay());

  return overallBorrowRate;
};

export const calcExpectedUtilizationRate = (totalVariableDebt: BigNumber, totalLiquidity: BigNumber): BigNumber => {
  if (totalVariableDebt.eq("0")) {
    return strToBN("0");
  }

  const utilization = totalVariableDebt.rayDiv(totalLiquidity);

  return utilization;
};

const calcExpectedReserveNormalizedIncome = (reserveData: ReserveData, currentTimestamp: BigNumber) => {
  const { liquidityRate, liquidityIndex, lastUpdateTimestamp } = reserveData;

  //if utilization rate is 0, nothing to compound
  if (liquidityRate.eq("0")) {
    return liquidityIndex;
  }

  const cumulatedInterest = calcLinearInterest(liquidityRate, currentTimestamp, lastUpdateTimestamp);

  const income = cumulatedInterest.rayMul(liquidityIndex);

  return income;
};

const calcExpectedReserveNormalizedDebt = (
  variableBorrowRate: BigNumber,
  variableBorrowIndex: BigNumber,
  lastUpdateTimestamp: BigNumber,
  currentTimestamp: BigNumber
) => {
  //if utilization rate is 0, nothing to compound
  if (variableBorrowRate.eq("0")) {
    return variableBorrowIndex;
  }

  const cumulatedInterest = calcCompoundedInterest(variableBorrowRate, currentTimestamp, lastUpdateTimestamp);

  const debt = cumulatedInterest.rayMul(variableBorrowIndex);

  return debt;
};

const calcExpectedLiquidityIndex = (reserveData: ReserveData, timestamp: BigNumber) => {
  //if utilization rate is 0, nothing to compound
  if (reserveData.utilizationRate.eq("0")) {
    return reserveData.liquidityIndex;
  }

  const cumulatedInterest = calcLinearInterest(reserveData.liquidityRate, timestamp, reserveData.lastUpdateTimestamp);

  return cumulatedInterest.rayMul(reserveData.liquidityIndex);
};

const calcExpectedVariableBorrowIndex = (reserveData: ReserveData, timestamp: BigNumber) => {
  //if totalVariableDebt is 0, nothing to compound
  if (reserveData.totalVariableDebt.eq("0")) {
    return reserveData.variableBorrowIndex;
  }

  const cumulatedInterest = calcCompoundedInterest(
    reserveData.variableBorrowRate,
    timestamp,
    reserveData.lastUpdateTimestamp
  );

  return cumulatedInterest.rayMul(reserveData.variableBorrowIndex);
};

const calcExpectedTotalVariableDebt = (reserveData: ReserveData, expectedVariableDebtIndex: BigNumber) => {
  return reserveData.scaledVariableDebt.rayMul(expectedVariableDebtIndex);
};

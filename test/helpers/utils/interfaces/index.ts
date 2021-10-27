import BigNumber from 'bignumber.js';

export interface UserReserveData {
  scaledBTokenBalance: BigNumber;
  currentBTokenBalance: BigNumber;
  currentVariableDebt: BigNumber;
  scaledVariableDebt: BigNumber;
  liquidityRate: BigNumber;
  walletBalance: BigNumber;
  [key: string]: BigNumber | string | Boolean;
}

export interface ReserveData {
  address: string;
  symbol: string;
  decimals: BigNumber;
  totalLiquidity: BigNumber;
  availableLiquidity: BigNumber;
  totalVariableDebt: BigNumber;
  scaledVariableDebt: BigNumber;
  variableBorrowRate: BigNumber;
  utilizationRate: BigNumber;
  liquidityIndex: BigNumber;
  variableBorrowIndex: BigNumber;
  bTokenAddress: string;
  lastUpdateTimestamp: BigNumber;
  liquidityRate: BigNumber;
  [key: string]: BigNumber | string;
}

export interface LoanData {
  state: BigNumber;
  borrower: string;
  nftAsset: string;
  nftTokenId: BigNumber;
  reserveAsset: string;
  scaledAmount: BigNumber;
  currentAmount: BigNumber;
  [key: string]: BigNumber | string | Boolean;
}

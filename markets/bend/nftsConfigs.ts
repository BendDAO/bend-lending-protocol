import { eContractid, INftParams, SymbolMap } from '../../helpers/types';

export const strategyWPUNKS: INftParams = {
  baseLTVAsCollateral: '5000', // 50%
  liquidationThreshold: '7000', // 70%
  liquidationBonus: '500', // 5%
  redeemDuration: "1", // 1 day
  auctionDuration: "1", // 1 day
  redeemFine: "100", // 1%
  bNftImpl: eContractid.BNFT,
};

export const strategyBAYC: INftParams = {
  baseLTVAsCollateral: '4000', // 40%
  liquidationThreshold: '6500', // 65%
  liquidationBonus: '500', // 5%
  redeemDuration: "1", // 1 day,
  auctionDuration: "1", // 1 day
  redeemFine: "100", // 1%
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassA: INftParams = {
  baseLTVAsCollateral: '5000', // 50%
  liquidationThreshold: '7000', // 70%
  liquidationBonus: '500', // 5%
  redeemDuration: "1", // 1 day
  auctionDuration: "1", // 1 day
  redeemFine: "100", // 1%
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassB: INftParams = {
  baseLTVAsCollateral: '4000', // 40%
  liquidationThreshold: '6500', // 65%
  liquidationBonus: '500', // 5%
  redeemDuration: "1", // 1 day
  auctionDuration: "1", // 1 day
  redeemFine: "100", // 1%
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassC: INftParams = {
  baseLTVAsCollateral: '2000', // 20%
  liquidationThreshold: '4500', // 35%
  liquidationBonus: '1000', // 10%
  redeemDuration: "86400", // 1 day, 3600 * 24
  auctionDuration: "86400", // 1 day, 3600 * 24
  redeemFine: "100", // 1%
  bNftImpl: eContractid.BNFT,
};

export const strategyNftParams: SymbolMap<INftParams> = {
  "ClassA": strategyNftClassA,
  "ClassB": strategyNftClassB,
  "ClassC": strategyNftClassC,
};

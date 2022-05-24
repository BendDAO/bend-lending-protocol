import { eContractid, INftParams, SymbolMap } from '../../helpers/types';

export const strategyNftClassA: INftParams = {
  baseLTVAsCollateral: '5000', // 50%
  liquidationThreshold: '9000', // 90%
  liquidationBonus: '500', // 5%
  redeemDuration: "2", // 2 days
  auctionDuration: "2", // 2 days
  redeemFine: "500", // 5%
  redeemThreshold: "5000", // 50%
  minBidFine: "2000", // 0.2 ETH
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassB: INftParams = {
  baseLTVAsCollateral: '4000', // 40%
  liquidationThreshold: '9000', // 90%
  liquidationBonus: '500', // 5%
  redeemDuration: "2", // 2 days
  auctionDuration: "2", // 2 days
  redeemFine: "500", // 5%
  redeemThreshold: "5000", // 50%
  minBidFine: "2000", // 0.2 ETH
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassC: INftParams = {
  baseLTVAsCollateral: '3000', // 30%
  liquidationThreshold: '9000', // 90%
  liquidationBonus: '500', // 5%
  redeemDuration: "2", // 2 day
  auctionDuration: "2", // 2 day
  redeemFine: "500", // 5%
  redeemThreshold: "5000", // 50%
  minBidFine: "2000", // 0.2 ETH
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassD: INftParams = {
  baseLTVAsCollateral: '2000', // 20%
  liquidationThreshold: '9000', // 90%
  liquidationBonus: '500', // 5%
  redeemDuration: "2", // 2 days
  auctionDuration: "2", // 2 days
  redeemFine: "500", // 5%
  redeemThreshold: "5000", // 50%
  minBidFine: "2000", // 0.2 ETH
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassE: INftParams = {
  baseLTVAsCollateral: '1000', // 10%
  liquidationThreshold: '9000', // 90%
  liquidationBonus: '500', // 5%
  redeemDuration: "2", // 2 days
  auctionDuration: "2", // 2 days
  redeemFine: "500", // 5%
  redeemThreshold: "5000", // 50%
  minBidFine: "2000", // 0.2 ETH
  bNftImpl: eContractid.BNFT,
};

export const strategyNftParams: SymbolMap<INftParams> = {
  "ClassA": strategyNftClassA,
  "ClassB": strategyNftClassB,
  "ClassC": strategyNftClassC,
  "ClassD": strategyNftClassD,
  "ClassE": strategyNftClassE,
};

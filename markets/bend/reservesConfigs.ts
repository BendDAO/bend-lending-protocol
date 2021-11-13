import { eContractid, IReserveParams, INftParams, SymbolMap } from '../../helpers/types';

import { 
  rateStrategyStableOne,
  rateStrategyStableTwo,
  rateStrategyStableThree,
  rateStrategyWETH,
} from './rateStrategies';

export const strategyBUSD: IReserveParams = {
  strategy: rateStrategyStableOne,
  baseLTVAsCollateral: '0',
  liquidationThreshold: '0',
  liquidationBonus: '0',
  borrowingEnabled: true,
  reserveDecimals: '18',
  bTokenImpl: eContractid.BToken,
  reserveFactor: '1000'
};

export const strategyDAI: IReserveParams = {
  strategy: rateStrategyStableTwo,
  baseLTVAsCollateral: '7500',
  liquidationThreshold: '8000',
  liquidationBonus: '500',
  borrowingEnabled: true,
  reserveDecimals: '18',
  bTokenImpl: eContractid.BToken,
  reserveFactor: '1000'
};

export const strategyUSDC: IReserveParams = {
  strategy: rateStrategyStableThree,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8500',
  liquidationBonus: '500',
  borrowingEnabled: true,
  reserveDecimals: '6',
  bTokenImpl: eContractid.BToken,
  reserveFactor: '1000'
};

export const strategyUSDT: IReserveParams = {
  strategy: rateStrategyStableThree,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8500',
  liquidationBonus: '500',
  borrowingEnabled: true,
  reserveDecimals: '6',
  bTokenImpl: eContractid.BToken,
  reserveFactor: '1000'
};

export const strategyWETH: IReserveParams = {
  strategy: rateStrategyWETH,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8250',
  liquidationBonus: '500',
  borrowingEnabled: true,
  reserveDecimals: '18',
  bTokenImpl: eContractid.BToken,
  reserveFactor: '1000'
};

export const strategyWPUNKS: INftParams = {
  baseLTVAsCollateral: '5000', // 50%
  liquidationThreshold: '7000', // 70%
  liquidationBonus: '500', // 5%
  bNftImpl: eContractid.BNFT,
};

export const strategyBAYC: INftParams = {
  baseLTVAsCollateral: '4000', // 40%
  liquidationThreshold: '6500', // 65%
  liquidationBonus: '500', // 5%
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassA: INftParams = {
  baseLTVAsCollateral: '5000', // 50%
  liquidationThreshold: '7000', // 70%
  liquidationBonus: '500', // 5%
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassB: INftParams = {
  baseLTVAsCollateral: '4000', // 40%
  liquidationThreshold: '6500', // 65%
  liquidationBonus: '500', // 5%
  bNftImpl: eContractid.BNFT,
};

export const strategyNftClassC: INftParams = {
  baseLTVAsCollateral: '2000', // 20%
  liquidationThreshold: '4500', // 35%
  liquidationBonus: '1000', // 10%
  bNftImpl: eContractid.BNFT,
};

export const strategyNftParams: SymbolMap<INftParams> = {
  "ClassA": strategyNftClassA,
  "ClassB": strategyNftClassB,
  "ClassC": strategyNftClassC,
};

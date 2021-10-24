import { eContractid, IReserveParams, INftParams } from '../../helpers/types';

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
  liquidationBonus: '10500',
  borrowingEnabled: true,
  reserveDecimals: '18',
  bTokenImpl: eContractid.BToken,
  reserveFactor: '1000'
};

export const strategyUSDC: IReserveParams = {
  strategy: rateStrategyStableThree,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8500',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  reserveDecimals: '6',
  bTokenImpl: eContractid.BToken,
  reserveFactor: '1000'
};

export const strategyUSDT: IReserveParams = {
  strategy: rateStrategyStableThree,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8500',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  reserveDecimals: '6',
  bTokenImpl: eContractid.BToken,
  reserveFactor: '1000'
};

export const strategyWETH: IReserveParams = {
  strategy: rateStrategyWETH,
  baseLTVAsCollateral: '8000',
  liquidationThreshold: '8250',
  liquidationBonus: '10500',
  borrowingEnabled: true,
  reserveDecimals: '18',
  bTokenImpl: eContractid.BToken,
  reserveFactor: '1000'
};

export const strategyWPUNKS: INftParams = {
  baseLTVAsCollateral: '5000', // 50%
  liquidationThreshold: '7000', // 70%
  liquidationBonus: '10500', // 5% = 105% - 100%
  bNftImpl: eContractid.BNFT,
};

export const strategyBAYC: INftParams = {
  baseLTVAsCollateral: '4000', // 40%
  liquidationThreshold: '6500', // 65%
  liquidationBonus: '10500', // 5% = 105% - 100%
  bNftImpl: eContractid.BNFT,
};

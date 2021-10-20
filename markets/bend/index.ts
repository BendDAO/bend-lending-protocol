import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IBendConfiguration, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyWETH,
  strategyDAI,
  strategyBUSD,
  strategyUSDC,
  strategyUSDT,

  strategyWPUNK,
  strategyAPE,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const BendConfig: IBendConfiguration = {
  ...CommonsConfig,
  MarketId: 'Bend genesis market',
  ProviderId: 1,
  ReservesConfig: {
    WETH: strategyWETH,
    DAI: strategyDAI,
    //BUSD: strategyBUSD,
    //USDC: strategyUSDC,
    ///USDT: strategyUSDT,
  },
  NftsConfig: {
    WPUNK: strategyWPUNK,
    APE: strategyAPE,
  },
  ReserveAssets: {
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.rikeyby]: {
      BUSD: '',
      DAI: '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea',
      USDC: '',
      USDT: '',
      WETH: '0xdf032bc4b9dc2782bb09352007d4c57b75160b15',
    },
    [eEthereumNetwork.kovan]: {
      BUSD: '0x4c6E1EFC12FDfD568186b7BAEc0A43fFfb4bCcCf',
      DAI: '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD',
      USDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
      USDT: '0x13512979ADE267AB5100878E2e0f485B568328a4',
      WETH: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    },
    [eEthereumNetwork.ropsten]: {
      BUSD: '0xFA6adcFf6A90c11f31Bc9bb59eC0a6efB38381C6',
      DAI: '0xf80A32A835F79D7787E8a8ee5721D0fEaFd78108',
      USDC: '0x851dEf71f0e6A903375C1e536Bd9ff1684BAD802',
      USDT: '0xB404c51BBC10dcBE948077F18a4B8E553D160084',
      WETH: '0xc778417e063141139fce010982780140aa0cd5ab',
    },
    [eEthereumNetwork.main]: {
      BUSD: '0x4Fabb145d64652a948d72533023f6E7A623C7C53',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
  },
};

export default BendConfig;

import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IBendConfiguration, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyWETH,
  strategyDAI,
  strategyUSDC,
} from './reservesConfigs';
import {
  strategyNftClassA,
  strategyNftClassB,
  strategyNftClassC,
  strategyNftClassD,
  strategyNftClassE,
} from './nftsConfigs';

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
    USDC: strategyUSDC,
  },
  NftsConfig: {
    WPUNKS: strategyNftClassB,
    BAYC: strategyNftClassB,
    DOODLE: strategyNftClassC,
    COOL: strategyNftClassC,
    MEEBITS: strategyNftClassC,
    MAYC: strategyNftClassC,
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.localhost]: {
      WETH: '0xB4B4ead1A260F1572b88b9D8ABa5A152D166c104',
      DAI: '0xa05ffF82bcC0C599984b0839218DC6ee9328d1Fb',
      USDC: '0x025FE4760c6f14dE878C22cEb09A3235F16dAe53',
    },
    [eEthereumNetwork.rinkeby]: {
      WETH: '0xaD1908f909B5C5D2B1032a215d611773F26f089F',
      DAI: '0x51EA2fEb1b1EB0891595f846456068D497734ca4',
      USDC: '0xB07416EFa22C8A502ff3845D3c0BdA400f929cB8',
    },
    [eEthereumNetwork.main]: {
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
  },
  NftsAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.localhost]: {
      WPUNKS: '0x5a60c5d89A0A0e08ae0CAe73453e3AcC9C335847',
      BAYC: '0x4e07D87De1CF586D51C3665e6a4d36eB9d99a457',
      DOODLE: '0x2F7f69a3cd22FcfFB5E0C0fB7Ae5Eb278b3919Ff',
      COOL: '0xC7F247a33C79BB0fABc3605479372D3Ba188fcbc',
      MEEBITS: '0x69D1108D37825212736aC101B445b6B57a390d13',
      MAYC: '0x8b89F971cA1A5dE1B7df7f554a3024eE84FeeB05',
    },
    [eEthereumNetwork.rinkeby]: {
      WPUNKS: '0x74e4418A41169Fb951Ca886976ccd8b36968c4Ab',
      BAYC: '0x588D1a07ccdb224cB28dCd8E3dD46E16B3a72b5e',
      DOODLE: '0x10cACFfBf3Cdcfb365FDdC4795079417768BaA74',
      COOL: '0x1F912E9b691858052196F11Aff9d8B6f89951AbD',
      MEEBITS: '0xA1BaBAB6d6cf1DC9C87Be22D1d5142CF905016a4',
      MAYC: '0x9C235dF4053a415f028b8386ed13ae8162843a6e',
    },
    [eEthereumNetwork.main]: {
      WPUNKS: '0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6',
      BAYC: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
      DOODLE: '0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e',
      COOL: '0x1A92f7381B9F03921564a437210bB9396471050C',
      MEEBITS: '0x7Bd29408f11D2bFC23c34f18275bBf23bB716Bc7',
      MAYC: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
    },
  },
};

export default BendConfig;

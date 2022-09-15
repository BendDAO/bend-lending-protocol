import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IBendConfiguration, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyWETH,
  strategyDAI,
  strategyUSDC,
} from './reservesConfigs';
import {
  strategyNft_AZUKI,
  strategyNft_BAYC,
  strategyNft_CLONEX,
  strategyNft_COOL,
  strategyNft_DOODLE,
  strategyNft_KONGZ,
  strategyNft_MAYC,
  strategyNft_MEEBITS,
  strategyNft_WOW,
  strategyNft_WPUNKS,
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
    WPUNKS: strategyNft_WPUNKS,
    BAYC: strategyNft_BAYC,
    DOODLE: strategyNft_DOODLE,
    SDOODLE: strategyNft_DOODLE,
    MAYC: strategyNft_MAYC,
    CLONEX: strategyNft_CLONEX,
    AZUKI: strategyNft_AZUKI,
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.localhost]: {
      WETH: '0xB4B4ead1A260F1572b88b9D8ABa5A152D166c104',
      DAI: '0xa05ffF82bcC0C599984b0839218DC6ee9328d1Fb',
      USDC: '0x025FE4760c6f14dE878C22cEb09A3235F16dAe53',
    },
    [eEthereumNetwork.goerli]: {
      WETH: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
    },
    [eEthereumNetwork.rinkeby]: {
      WETH: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
      DAI: '0x51EA2fEb1b1EB0891595f846456068D497734ca4',
      USDC: '0xB07416EFa22C8A502ff3845D3c0BdA400f929cB8',
    },
    [eEthereumNetwork.main]: {
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
  },
  NftsAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.localhost]: {
      WPUNKS: '0x5a60c5d89A0A0e08ae0CAe73453e3AcC9C335847',
      BAYC: '0x4e07D87De1CF586D51C3665e6a4d36eB9d99a457',
      DOODLE: '0x2F7f69a3cd22FcfFB5E0C0fB7Ae5Eb278b3919Ff',
      MAYC: '0x8b89F971cA1A5dE1B7df7f554a3024eE84FeeB05',
    },
    [eEthereumNetwork.goerli]: {
      WPUNKS: '0xbeD1e8B430FD512b82A18cb121a8442F3889E505',
      BAYC: '0x30d190032A34d6151073a7DB8793c01Aa05987ec',
      DOODLE: '0x317e19Fe3DB508f1A45421379FBbd7564d0259c0',
      SDOODLE: '0x82C348Ef21629f5aaeE5280ef3f4389Ad82F8799',
      MAYC: '0x15596C27900e12A9cfC301248E21888751f61c19',
      CLONEX: '0x578bc56a145A3464Adc44635C23501653138c946',
      AZUKI: '0x708c48AaA4Ea8B9E46Bd8DEb6470986842b9a16d',
    },
    [eEthereumNetwork.rinkeby]: {
      WPUNKS: '0x74e4418A41169Fb951Ca886976ccd8b36968c4Ab',
      BAYC: '0x588D1a07ccdb224cB28dCd8E3dD46E16B3a72b5e',
      DOODLE: '0x10cACFfBf3Cdcfb365FDdC4795079417768BaA74',
      COOL: '0x1F912E9b691858052196F11Aff9d8B6f89951AbD',
      MAYC: '0x9C235dF4053a415f028b8386ed13ae8162843a6e',
      CLONEX: '0xdd04ba0254972CC736F6966c496B4941f02BD816',
      AZUKI: '0x050Cd8082B86c5F469e0ba72ef4400E5E454886D',
    },
    [eEthereumNetwork.main]: {
      WPUNKS: '0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6',
      BAYC: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
      DOODLE: '0x8a90cab2b38dba80c64b7734e58ee1db38b8992e',
      SDOODLE: '0x620b70123fb810f6c653da7644b5dd0b6312e4d8',
      MAYC: '0x60e4d786628fea6478f785a6d7e704777c86a7c6',
      CLONEX: '0x49cf6f5d44e70224e2e23fdcdd2c053f30ada28b',
      AZUKI: '0xed5af388653567af2f388e6224dc7c4b3241c544',
    },
  },
};

export default BendConfig;

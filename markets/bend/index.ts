import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IBendConfiguration, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyWETH,
  strategyDAI,
  strategyUSDC,
} from './reservesConfigs';
import {
  strategyWPUNKS,
  strategyBAYC,
  strategyNftClassC,
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
    WPUNKS: strategyWPUNKS,
    BAYC: strategyBAYC,
    DOODLE: strategyNftClassC,
    COOL: strategyNftClassC,
    MEEBITS: strategyNftClassC,
    MAYC: strategyNftClassC,
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.localhost]: {
      DAI: '0xa05ffF82bcC0C599984b0839218DC6ee9328d1Fb',
      USDC: '0x025FE4760c6f14dE878C22cEb09A3235F16dAe53',
      WETH: '0xB4B4ead1A260F1572b88b9D8ABa5A152D166c104',
    },
    [eEthereumNetwork.rinkeby]: {
      DAI: '0x56C0dab0209Ad53C8de55480167667b4884e3d0F',
      USDC: '0xA535aA6A943706c589616f982d0d05f50710C8A7',
      WETH: '0x585d17A346cb99849a539F553f4d542D7e5B5B28',
    },
    [eEthereumNetwork.main]: {
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
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
      COOL: '0xC7F247a33C79BB0fABc3605479372D3Ba188fcbc',
      MEEBITS: '0x69D1108D37825212736aC101B445b6B57a390d13',
      MAYC: '0x8b89F971cA1A5dE1B7df7f554a3024eE84FeeB05',
    },
    [eEthereumNetwork.rinkeby]: {
      WPUNKS: '0x5b4FaC380a2A79EE0ddA713a31cbA7A74Cba7Cd0',
      BAYC: '0x6b81840bc2E607C1Ea099D7BD93957608CEB3947',
      DOODLE: '0x7b5f4f9fb286a77A57127FEfE01E36155164D718',
      COOL: '0xf976e5355d10F90c189c5527abc4F89EE8967A95',
      MEEBITS: '0x84BBb2a522D71DffAeea24B582Ef6d7AfA8aE9a1',
      MAYC: '0x4a0e0813F88b25e8e740fbaa268a1Cd487126c9d',
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

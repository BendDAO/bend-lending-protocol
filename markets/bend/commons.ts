import BigNumber from 'bignumber.js';
import {
  oneEther,
  oneRay,
  RAY,
  ZERO_ADDRESS,
  MOCK_RESERVE_AGGREGATORS_PRICES,
  MOCK_NFT_AGGREGATORS_PRICES,
} from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  BTokenNamePrefix: 'Bend interest bearing',
  BTokenSymbolPrefix: 'bend',
  DebtTokenNamePrefix: 'Bend debt bearing',
  DebtTokenSymbolPrefix: "bendDebt",

  ProviderId: 0, // Overriden in index.ts
  OracleQuoteCurrency: 'ETH',
  OracleQuoteUnit: oneEther.toString(),
  ProtocolGlobalParams: {
    MockUsdPrice: '425107839690',
    UsdAddress: '0x9ceb4d4c184d1786614a593a03621b7f37f8685f', //index 19, lowercase
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
    BNftNamePrefix: 'Bound NFT',
    BNftSymbolPrefix: 'bound',
    AllAssetsInitialPrices: {
      ...MOCK_RESERVE_AGGREGATORS_PRICES,
    },
    AllNftsInitialPrices: {
      ...MOCK_NFT_AGGREGATORS_PRICES,
    },
  },

  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  ProxyAdminPool: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.localhost]: undefined,
    [eEthereumNetwork.goerli]: '0x19Fc1F11e1BEA5317ce54d97bbf5675a38e2F4a3',
    [eEthereumNetwork.rinkeby]: '0xC019619F15aF1f96A695aBA39478e64ABcAa474b',
    [eEthereumNetwork.main]: '0x501c991E0D31D408c25bCf00da27BdF2759A394a',
  },
  ProxyAdminFund: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.localhost]: undefined,
    [eEthereumNetwork.goerli]: '0xd9E1e945e042fa29cD984cb0f280ae5Ce990D993',
    [eEthereumNetwork.rinkeby]: '0x64DA9D7651CA78caAB756740C6057e2b7B1E63De',
    [eEthereumNetwork.main]: '0x2A71a0F5cef1fFc519027AD12f19453110e70666',
  },

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.localhost]: undefined,
    [eEthereumNetwork.goerli]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.rinkeby]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.main]: '0x868964fa49a6fd6e116FE82c8f4165904406f479',
  },
  PoolAdminIndex: 1,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.localhost]: undefined,
    [eEthereumNetwork.goerli]: '0xFc6a5b329340719b2693C2c74a5D056cf4f93FB0',
    [eEthereumNetwork.rinkeby]: '0xFc6a5b329340719b2693C2c74a5D056cf4f93FB0',
    [eEthereumNetwork.main]: '0x2CFa21b4dEc4409670899d05b8644e9C432250de',
  },
  EmergencyAdminIndex: 2,

  BNFTRegistry: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.localhost]: '0xCE1e5D792d24F62b29D35DeB85eC04b1F66447b1',
    [eEthereumNetwork.goerli]: '0x37A76Db446bDB3EF1b73112a8D5E6868de06464f',
    [eEthereumNetwork.rinkeby]: '0xB873F088EB721261bc88BbC739B5C794e02e414b',
    [eEthereumNetwork.main]: '0x79d922DD382E42A156bC0A354861cDBC4F09110d',
  },

  ProviderRegistry: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.localhost]: '',
    [eEthereumNetwork.goerli]: '0x5eff819a886474503004d39C64b5c057FFD6fAe2',
    [eEthereumNetwork.rinkeby]: '0xE199f7a0173FEAfb8c0085b2724b544a7c614273',
    [eEthereumNetwork.main]: '0x2C16905Dfd953cf3BF3960c4A101c1eEBBd37E32',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.goerli]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.rinkeby]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.main]: '0x868964fa49a6fd6e116FE82c8f4165904406f479',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.localhost]: '',
  },

  ReserveOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.localhost]: '',
    [eEthereumNetwork.goerli]: '0xFFC171ff66bba4303Ea8334d08dB5779daF860a3',
    [eEthereumNetwork.rinkeby]: '0xEEa5BC7BEB4DD341E8BBa230E22df9CA45f0AE19',
    [eEthereumNetwork.main]: '0x16ca3E500dA893cF2EEBb6b401247e68ca5BC072',
  },
  NFTOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.localhost]: '',
    [eEthereumNetwork.goerli]: '0xE7E268cC1D025906fe8f6b076ecc40FF1a8dfA61',
    [eEthereumNetwork.rinkeby]: '0x04af5eF6100E1025560Be50FF244CB31f60d08c2',
    [eEthereumNetwork.main]: '0x7C2A19e54e48718f6C60908a9Cff3396E4Ea1eBA',
  },

  ReserveAggregators: {
    // https://data.chain.link/ethereum/mainnet/crypto-eth
    // https://docs.chain.link/docs/ethereum-addresses/
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.localhost]: {
      DAI: '0x10F6794a3Df86bD8B97c7d6D625BAB54677D443b',
      USDC: '0x2cC3790f7CF280fA898E4913CA980410cF38e53b',
      USD: '0x6B8dcBD1bb131ED184221902df1Fe21019ccD7dc',
    },
    [eEthereumNetwork.goerli]: {
      USD: '0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e', //ETH - USD
    },
    [eEthereumNetwork.rinkeby]: {
      DAI: '0x74825DbC8BF76CC4e9494d0ecB210f676Efa001D',
      USDC: '0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf',
      USD: '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e', //ETH - USD
    },
    [eEthereumNetwork.main]: {
      USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', //ETH - USD
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.localhost]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.rinkeby]: {},
    [eEthereumNetwork.goerli]: {},
  },
  ReservesConfig: {},
  NftsAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.localhost]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.rinkeby]: {},
    [eEthereumNetwork.goerli]: {},
  },
  NftsConfig: {},

  WrappedNativeToken: { //WETH
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.localhost]: '0xB4B4ead1A260F1572b88b9D8ABa5A152D166c104',
    [eEthereumNetwork.goerli]: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
    [eEthereumNetwork.rinkeby]: '0xc778417E063141139Fce010982780140Aa0cD5Ab',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },

  CryptoPunksMarket: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.localhost]: '0xb2f97A3c2E48cd368901657e31Faaa93035CE390',
    [eEthereumNetwork.goerli]: '0xBccC7a1E79215EC3FD36824615801BCeE0Df2eC3',
    [eEthereumNetwork.rinkeby]: '0x6389eA3Cf6dE815ba76d7Cf4C6Db6A7093471bcb',
    [eEthereumNetwork.main]: '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb',
  },
  WrappedPunkToken: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.localhost]: '0x5a60c5d89A0A0e08ae0CAe73453e3AcC9C335847',
    [eEthereumNetwork.goerli]: '0xbeD1e8B430FD512b82A18cb121a8442F3889E505',
    [eEthereumNetwork.rinkeby]: '0x74e4418A41169Fb951Ca886976ccd8b36968c4Ab',
    [eEthereumNetwork.main]: '0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6',
  },

  ReserveFactorCollectorAddress: {
    [eEthereumNetwork.coverage]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.hardhat]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.localhost]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.goerli]: '0x32B08f895d93a207e8A5C9405870D780A43b25Dd',
    [eEthereumNetwork.rinkeby]: '0x7A02EE743Aadca63d60945971B7eD12c7f26b6d2',
    [eEthereumNetwork.main]: '0x43078AbfB76bd24885Fd64eFFB22049f92a8c495',
  },
  IncentivesController: {
    [eEthereumNetwork.coverage]: ZERO_ADDRESS,
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.localhost]: "0x1eaA4a267eDcde0eB5e08D08810Aa1696b123a2D",
    [eEthereumNetwork.goerli]: "0x292F693048208184320C01e0C223D624268e5EE7",
    [eEthereumNetwork.rinkeby]: '0xD800e97aE32b06C1e89ca5126c7bF6aEF89D6B24',
    [eEthereumNetwork.main]: '0x26FC1f11E612366d3367fc0cbFfF9e819da91C8d',
  },
};

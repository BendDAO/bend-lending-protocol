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
  BTokenSymbolPrefix: 'b',
  BNftNamePrefix: 'Bend promissory note',
  BNftSymbolPrefix: 'b',
  ProviderId: 0, // Overriden in index.ts
  OracleQuoteCurrency: 'ETH',
  OracleQuoteUnit: oneEther.toString(),
  ProtocolGlobalParams: {
    MockUsdPriceInWei: '5848466240000000',
    UsdAddress: '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96',
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
    BendReferral: '0',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
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

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.main]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.main]: undefined,
  },
  EmergencyAdminIndex: 1,
  ProxyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.main]: undefined,
  },
  BNFTRegistry: {
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
  },
  BNFTRegistryOwner: {
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
  },
  ProviderRegistry: {
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
  },
  LendPoolConfigurator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
  },
  LendPool: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
  },
  LendPoolLoan: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
  },
  WethGateway: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '0x3BD0A71D39E67fc49D5A6645550f2bc95F5cb398',
    [eEthereumNetwork.main]: '',
  },
  PunkGateway: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '0x94150C5cb7881d25eD4360127ccBDA853bFb6a30',
    [eEthereumNetwork.main]: '',
  },
  ReserveOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
  },
  NFTOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
  },
  ReserveAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.rinkeby]: {
      DAI: '0x74825DbC8BF76CC4e9494d0ecB210f676Efa001D',
      USDC: '0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf',
    },
    [eEthereumNetwork.main]: {
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
    },
  },
  NftAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.rinkeby]: {},
    [eEthereumNetwork.main]: {},
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.rinkeby]: {},
  },
  ReservesConfig: {},
  NftsAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.rinkeby]: {},
  },
  NftsConfig: {},
  BTokenDomainSeparator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
  },
  BNftDomainSeparator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
  },
  WrappedNativeToken: { // ETH, BNB, MATIC
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  CryptoPunksMarket: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '0x292F693048208184320C01e0C223D624268e5EE7',
    [eEthereumNetwork.main]: '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb',
  },
  WrappedPunkToken: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '0xd51fC3376F6D7C86D8639d5ec238327ab0EE69e3',
    [eEthereumNetwork.main]: '0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.coverage]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.hardhat]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.rinkeby]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.main]: '',
  },
  IncentivesController: {
    [eEthereumNetwork.coverage]: ZERO_ADDRESS,
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.rinkeby]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: ZERO_ADDRESS,
  },
};

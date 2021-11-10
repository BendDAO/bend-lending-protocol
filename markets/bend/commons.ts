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
  DebtTokenNamePrefix: 'Bend debt bearing',
  DebtTokenSymbolPrefix: "bDebt",
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

  ProxyAdminBNFT: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.main]: undefined,
  },
  ProxyAdminPool: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.main]: undefined,
  },
  ProxyAdminFund: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.main]: undefined,
  },

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
  BNFTRegistry: {
    [eEthereumNetwork.rinkeby]: '0x55C44d8dDCEaceD2d9a40a1e68Ca3F8bE5E96b91',
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
    [eEthereumNetwork.rinkeby]: '0x77537048BEd42b0f3aCfd58D9e865774367FC0f5',
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
  ReserveOracle: {
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
  },
  NFTOracle: {
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
  },

  ReserveAggregator: {
    // https://data.chain.link/ethereum/mainnet/crypto-eth
    // https://docs.chain.link/docs/ethereum-addresses/
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.rinkeby]: {
      DAI: '0x74825DbC8BF76CC4e9494d0ecB210f676Efa001D',
      USDC: '0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf',
      USD: '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e', //ETH - USD
    },
    [eEthereumNetwork.main]: {
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      USD: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', //ETH - USD
    },
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

  WrappedNativeToken: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  WethGateway: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
  },

  CryptoPunksMarket: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb',
  },
  WrappedPunkToken: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6',
  },

  PunkGateway: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.main]: '',
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
    [eEthereumNetwork.rinkeby]: '0x3914b761079Ad67c5e0928BB3337B481c69e3CdE',
    [eEthereumNetwork.main]: ZERO_ADDRESS,
  },
};

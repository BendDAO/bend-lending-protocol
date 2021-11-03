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
    [eEthereumNetwork.buidlerevm]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.main]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.buidlerevm]: undefined,
    [eEthereumNetwork.rinkeby]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.main]: undefined,
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '0x1E40B561EC587036f9789aF83236f057D1ed2A90',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '0x52D306e36E3B6B02c153d0266ff0f85d18BCD413',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '0x85e4A467343c0dc4aDAB74Af84448D9c45D8ae6F',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '0xB9062896ec3A615a4e4444DF183F0531a77218AE',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
  },
  LendPoolConfigurator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
  },
  LendPool: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
  },
  LendPoolLoan: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
  },
  WethGateway: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
  },
  ReserveOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: '',
  },
  NFTOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: '',
  },
  ReserveAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.rinkeby]: {},
    [eEthereumNetwork.kovan]: {
      BUSD: '0xbF7A18ea5DE0501f7559144e702b29c55b055CcB',
      DAI: '0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541',
      USDC: '0x64EaC61A2DFda2c3Fa04eED49AA33D021AeC8838',
      USDT: '0x0bF499444525a23E7Bb61997539725cA2e928138',
    },
    [eEthereumNetwork.ropsten]: {
      BUSD: '0x0A32D96Ff131cd5c3E0E5AAB645BF009Eda61564',
      DAI: '0x64b8e49baded7bfb2fd5a9235b2440c0ee02971b',
      USDC: '0xe1480303dde539e2c241bdc527649f37c9cbef7d',
      USDT: '0xc08fe0c4d97ccda6b40649c6da621761b628c288',
    },
    [eEthereumNetwork.main]: {
      BUSD: '0x614715d2Af89E6EC99A233818275142cE88d1Cfd',
      DAI: '0x773616E4d11A78F511299002da57A0a94577F1f4',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
    },
  },
  NftAggregator: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.rinkeby]: {},
    [eEthereumNetwork.kovan]: {},
    [eEthereumNetwork.ropsten]: {},
    [eEthereumNetwork.main]: {},
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.rinkeby]: {},
    [eEthereumNetwork.kovan]: {},
    [eEthereumNetwork.ropsten]: {},
  },
  ReservesConfig: {},
  NftsAssets: {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.rinkeby]: {},
    [eEthereumNetwork.kovan]: {},
    [eEthereumNetwork.ropsten]: {},
  },
  NftsConfig: {},
  BTokenDomainSeparator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
  },
  BNftDomainSeparator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.rinkeby]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
  },
  WETH: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.buidlerevm]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '0xdf032bc4b9dc2782bb09352007d4c57b75160b15',
    [eEthereumNetwork.kovan]: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    [eEthereumNetwork.ropsten]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  WrappedNativeToken: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.buidlerevm]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.kovan]: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    [eEthereumNetwork.ropsten]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.coverage]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.hardhat]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.buidlerevm]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.rinkeby]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.kovan]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.ropsten]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.main]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  },
  IncentivesController: {
    [eEthereumNetwork.coverage]: ZERO_ADDRESS,
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.buidlerevm]: ZERO_ADDRESS,
    [eEthereumNetwork.rinkeby]: ZERO_ADDRESS,
    [eEthereumNetwork.kovan]: ZERO_ADDRESS,
    [eEthereumNetwork.ropsten]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: ZERO_ADDRESS,
  },
};

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
    MockUsdPrice: '425107839690',
    UsdAddress: '0x9ceb4d4c184d1786614a593a03621b7f37f8685f', //index 19, lowercase
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
    [eEthereumNetwork.rinkeby]: '0x57310Fa646Ed3B45B3b70c70F23bf57d3E305F42',
    [eEthereumNetwork.main]: undefined,
  },
  ProxyAdminPool: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.rinkeby]: '0x60C7eb6362D4fD6dFa53f6610784924eFaA1d178',
    [eEthereumNetwork.main]: undefined,
  },
  ProxyAdminFund: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.rinkeby]: '0xa9A3b239CC1C2Fc9D40E6258464a9c180aaA3A19',
    [eEthereumNetwork.main]: undefined,
  },

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.rinkeby]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.main]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.rinkeby]: '0xFc6a5b329340719b2693C2c74a5D056cf4f93FB0',
    [eEthereumNetwork.main]: undefined,
  },
  EmergencyAdminIndex: 1,

  BNFTRegistry: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '0x683f73Ddb5272049e392603d55593511Fd503D61',
    [eEthereumNetwork.main]: '',
  },
  BNFTRegistryOwner: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.main]: '',
  },
  ProviderRegistry: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '0x800Ad9f20c396592FccC8C0f7cc418F7fDcF70f2',
    [eEthereumNetwork.main]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.rinkeby]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
  },

  ReserveOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '0xF8cbFf1Ef3e84a50E3F5e0b8617aa85162FDF5D3',
    [eEthereumNetwork.main]: '',
  },
  NFTOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.rinkeby]: '0xb55ea3D072Fd8943fa7DEf37b8da4a20A9d9ebF9',
    [eEthereumNetwork.main]: '',
  },

  ReserveAggregators: {
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

  WrappedNativeToken: { //WETH
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '0x585d17A346cb99849a539F553f4d542D7e5B5B28',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  },

  CryptoPunksMarket: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '0xF85EeD76C0D2b3f0C50140BEdB2aF489E5eaaeB8',
    [eEthereumNetwork.main]: '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb',
  },
  WrappedPunkToken: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.rinkeby]: '0x5b4FaC380a2A79EE0ddA713a31cbA7A74Cba7Cd0',
    [eEthereumNetwork.main]: '0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6',
  },

  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.coverage]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.hardhat]: '0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6',
    [eEthereumNetwork.rinkeby]: '0x707D1a914ea67855617557bd700F01537353a74E',
    [eEthereumNetwork.main]: '',
  },
  IncentivesController: {
    [eEthereumNetwork.coverage]: ZERO_ADDRESS,
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.rinkeby]: '0x06b0C0aEE6A2DDf5cb4fc76764e8107bA36B22b7',
    [eEthereumNetwork.main]: ZERO_ADDRESS,
  },
};

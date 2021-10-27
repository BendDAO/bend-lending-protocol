import {
  BendPools,
  iMultiPoolsAssets,
  IReserveParams,
  iMultiPoolsNfts,
  INftParams,
  PoolConfiguration,
  ICommonConfiguration,
  eNetwork,
} from './types';
import { getEthersSignersAddresses, getParamPerPool } from './contracts-helpers';
import BendConfig from '../markets/bend';
import { CommonsConfig } from '../markets/bend/commons';
import { DRE, filterMapBy } from './misc-utils';
import { tEthereumAddress } from './types';
import { getParamPerNetwork } from './contracts-helpers';
import { deployWETHMocked } from './contracts-deployments';

export enum ConfigNames {
  Commons = 'Commons',
  Bend = 'Bend',
}

export const loadPoolConfig = (configName: ConfigNames): PoolConfiguration => {
  switch (configName) {
    case ConfigNames.Bend:
      return BendConfig;
    case ConfigNames.Commons:
      return CommonsConfig;
    default:
      throw new Error(`Unsupported pool configuration: ${Object.values(ConfigNames)}`);
  }
};

// ----------------
// PROTOCOL PARAMS PER POOL
// ----------------

export const getReservesConfigByPool = (pool: BendPools): iMultiPoolsAssets<IReserveParams> =>
  getParamPerPool<iMultiPoolsAssets<IReserveParams>>(
    {
      [BendPools.proto]: {
        ...BendConfig.ReservesConfig,
      },
    },
    pool
  );

export const getNftsConfigByPool = (pool: BendPools): iMultiPoolsNfts<INftParams> =>
  getParamPerPool<iMultiPoolsNfts<INftParams>>(
    {
      [BendPools.proto]: {
        ...BendConfig.NftsConfig,
      },
    },
    pool
  );

export const getGenesisPoolAdmin = async (
  config: ICommonConfiguration
): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  const targetAddress = getParamPerNetwork(config.PoolAdmin, <eNetwork>currentNetwork);
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await getEthersSignersAddresses();
  const addressIndex = config.PoolAdminIndex;
  return addressList[addressIndex];
};

export const getEmergencyAdmin = async (
  config: ICommonConfiguration
): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  const targetAddress = getParamPerNetwork(config.EmergencyAdmin, <eNetwork>currentNetwork);
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await getEthersSignersAddresses();
  const addressIndex = config.EmergencyAdminIndex;
  return addressList[addressIndex];
};

export const getTreasuryAddress = async (
  config: ICommonConfiguration
): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  return getParamPerNetwork(config.ReserveFactorTreasuryAddress, <eNetwork>currentNetwork);
};

export const getBTokenDomainSeparatorPerNetwork = (
  network: eNetwork,
  config: ICommonConfiguration
): tEthereumAddress => getParamPerNetwork<tEthereumAddress>(config.BTokenDomainSeparator, network);

export const getWethAddress = async (config: ICommonConfiguration) => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  const wethAddress = getParamPerNetwork(config.WETH, <eNetwork>currentNetwork);
  if (wethAddress) {
    return wethAddress;
  }
  if (currentNetwork.includes('main')) {
    throw new Error('WETH not set at mainnet configuration.');
  }
  const weth = await deployWETHMocked();
  return weth.address;
};

export const getWrappedNativeTokenAddress = async (config: ICommonConfiguration) => {
  const currentNetwork = process.env.MAINNET_FORK === 'true' ? 'main' : DRE.network.name;
  const wethAddress = getParamPerNetwork(config.WrappedNativeToken, <eNetwork>currentNetwork);
  if (wethAddress) {
    return wethAddress;
  }
  if (currentNetwork.includes('main')) {
    throw new Error('WETH not set at mainnet configuration.');
  }
  const weth = await deployWETHMocked();
  return weth.address;
};

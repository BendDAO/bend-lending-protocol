import { Signer, ethers } from "ethers";
import {
  BendProtocolDataProviderFactory,
  BTokenFactory,
  BNFTFactory,
  BNFTRegistryFactory,
  InterestRateFactory,
  GenericLogicFactory,
  LendPoolAddressesProviderFactory,
  LendPoolAddressesProviderRegistryFactory,
  LendPoolConfiguratorFactory,
  LendPoolFactory,
  LendPoolLoanFactory,
  MintableERC20Factory,
  MintableERC721Factory,
  MockBTokenFactory,
  BTokensAndBNFTsHelperFactory,
  BendOracleFactory,
  ReserveOracleFactory,
  MockChainlinkOracleFactory,
  MockReserveOracleFactory,
  NFTOracleFactory,
  MockNFTOracleFactory,
  ReserveLogicFactory,
  SelfdestructTransferFactory,
  WalletBalanceProviderFactory,
  WETH9MockedFactory,
  WETHGatewayFactory,
  CryptoPunksMarketFactory,
  WrappedPunkFactory,
  PunkGatewayFactory,
  MockReserveOracle,
  InitializableAdminProxyFactory,
} from "../types";
import { IERC20DetailedFactory } from "../types/IERC20DetailedFactory";
import { IERC721DetailedFactory } from "../types/IERC721DetailedFactory";
import { MockChainlinkOracle } from "../types/MockChainlinkOracle";
import { getEthersSigners, MockTokenMap, MockNftMap } from "./contracts-helpers";
import { DRE, getDb, notFalsyOrZeroAddress, omit } from "./misc-utils";
import { eContractid, PoolConfiguration, tEthereumAddress, TokenContractId, NftContractId } from "./types";

export const getFirstSigner = async () => (await getEthersSigners())[0];

export const getSecondSigner = async () => (await getEthersSigners())[1];

export const getLendPoolAddressesProviderRegistry = async (address?: tEthereumAddress) => {
  return await LendPoolAddressesProviderRegistryFactory.connect(
    address ||
      (
        await getDb().get(`${eContractid.LendPoolAddressesProviderRegistry}.${DRE.network.name}`).value()
      ).address,
    await getFirstSigner()
  );
};

export const getLendPoolAddressesProvider = async (address?: tEthereumAddress) => {
  return await LendPoolAddressesProviderFactory.connect(
    address || (await getDb().get(`${eContractid.LendPoolAddressesProvider}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );
};

export const getLendPoolConfiguratorProxy = async (address?: tEthereumAddress) => {
  return await LendPoolConfiguratorFactory.connect(
    address || (await getDb().get(`${eContractid.LendPoolConfigurator}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );
};

export const getBNFTRegistryProxy = async (address?: tEthereumAddress) => {
  return await BNFTRegistryFactory.connect(
    address || (await getDb().get(`${eContractid.BNFTRegistry}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );
};

export const getLendPoolLoanProxy = async (address?: tEthereumAddress) => {
  return await LendPoolLoanFactory.connect(
    address || (await getDb().get(`${eContractid.LendPoolLoan}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );
};

export const getLendPool = async (address?: tEthereumAddress) =>
  await LendPoolFactory.connect(
    address || (await getDb().get(`${eContractid.LendPool}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getBendOracle = async (address?: tEthereumAddress) =>
  await BendOracleFactory.connect(
    address || (await getDb().get(`${eContractid.BendOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getReserveOracle = async (address?: tEthereumAddress) =>
  await ReserveOracleFactory.connect(
    address || (await getDb().get(`${eContractid.ReserveOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockChainlinkOracle = async (address?: tEthereumAddress) =>
  await MockChainlinkOracleFactory.connect(
    address || (await getDb().get(`${eContractid.MockChainlinkOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getNFTOracle = async (address?: tEthereumAddress) =>
  await NFTOracleFactory.connect(
    address || (await getDb().get(`${eContractid.NFTOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockReserveOracle = async (address?: tEthereumAddress) =>
  await MockReserveOracleFactory.connect(
    address || (await getDb().get(`${eContractid.MockReserveOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockNFTOracle = async (address?: tEthereumAddress) =>
  await MockNFTOracleFactory.connect(
    address || (await getDb().get(`${eContractid.MockNFTOracle}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getBToken = async (address?: tEthereumAddress) =>
  await BTokenFactory.connect(
    address || (await getDb().get(`${eContractid.BToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getBNFT = async (address?: tEthereumAddress) =>
  await BNFTFactory.connect(
    address || (await getDb().get(`${eContractid.BNFT}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMintableERC20 = async (address: tEthereumAddress) =>
  await MintableERC20Factory.connect(
    address || (await getDb().get(`${eContractid.MintableERC20}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMintableERC721 = async (address: tEthereumAddress) =>
  await MintableERC721Factory.connect(
    address || (await getDb().get(`${eContractid.MintableERC721}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getIErc20Detailed = async (address: tEthereumAddress) =>
  await IERC20DetailedFactory.connect(
    address || (await getDb().get(`${eContractid.IERC20Detailed}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getIErc721Detailed = async (address: tEthereumAddress) =>
  await IERC721DetailedFactory.connect(
    address || (await getDb().get(`${eContractid.IERC721Detailed}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getBendProtocolDataProvider = async (address?: tEthereumAddress) =>
  await BendProtocolDataProviderFactory.connect(
    address || (await getDb().get(`${eContractid.BendProtocolDataProvider}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getInterestRate = async (address?: tEthereumAddress) =>
  await InterestRateFactory.connect(
    address || (await getDb().get(`${eContractid.InterestRate}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockedTokens = async (config: PoolConfiguration) => {
  const tokenSymbols = Object.keys(config.ReservesConfig);
  const db = getDb();
  const tokens: MockTokenMap = await tokenSymbols.reduce<Promise<MockTokenMap>>(async (acc, tokenSymbol) => {
    const accumulator = await acc;
    const address = db.get(`${tokenSymbol.toUpperCase()}.${DRE.network.name}`).value().address;
    accumulator[tokenSymbol] = await getMintableERC20(address);
    return Promise.resolve(acc);
  }, Promise.resolve({}));
  return tokens;
};

export const getAllMockedTokens = async () => {
  const db = getDb();
  const tokens: MockTokenMap = await Object.keys(TokenContractId).reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = db.get(`${tokenSymbol.toUpperCase()}.${DRE.network.name}`).value().address;
      accumulator[tokenSymbol] = await getMintableERC20(address);
      return Promise.resolve(acc);
    },
    Promise.resolve({})
  );
  return tokens;
};

export const getConfigMockedNfts = async (config: PoolConfiguration) => {
  const tokenSymbols = Object.keys(config.NftsConfig);
  const db = getDb();
  const tokens: MockNftMap = await tokenSymbols.reduce<Promise<MockNftMap>>(async (acc, tokenSymbol) => {
    const accumulator = await acc;
    const address = db.get(`${tokenSymbol.toUpperCase()}.${DRE.network.name}`).value().address;
    accumulator[tokenSymbol] = await getMintableERC721(address);
    return Promise.resolve(acc);
  }, Promise.resolve({}));
  return tokens;
};

export const getAllMockedNfts = async () => {
  const db = getDb();
  const tokens: MockNftMap = await Object.keys(NftContractId).reduce<Promise<MockNftMap>>(async (acc, tokenSymbol) => {
    const accumulator = await acc;
    const address = db.get(`${tokenSymbol.toUpperCase()}.${DRE.network.name}`).value().address;
    accumulator[tokenSymbol] = await getMintableERC721(address);
    return Promise.resolve(acc);
  }, Promise.resolve({}));
  return tokens;
};

export const getQuoteCurrencies = (oracleQuoteCurrency: string): string[] => {
  switch (oracleQuoteCurrency) {
    case "ETH":
    case "WETH":
    default:
      return ["ETH", "WETH"];
  }
};

export const getPairsTokenAggregator = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  oracleQuoteCurrency: string
): [string[], string[]] => {
  const assetsWithoutQuoteCurrency = omit(allAssetsAddresses, getQuoteCurrencies(oracleQuoteCurrency));

  const pairs = Object.entries(assetsWithoutQuoteCurrency).map(([tokenSymbol, tokenAddress]) => {
    //if (true/*tokenSymbol !== 'WETH' && tokenSymbol !== 'ETH' && tokenSymbol !== 'LpWETH'*/) {
    const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex((value) => value === tokenSymbol);
    const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [string, tEthereumAddress][])[
      aggregatorAddressIndex
    ];
    return [tokenAddress, aggregatorAddress];
    //}
  }) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};

export const getReserveLogic = async (address?: tEthereumAddress) =>
  await ReserveLogicFactory.connect(
    address || (await getDb().get(`${eContractid.ReserveLogic}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getGenericLogic = async (address?: tEthereumAddress) =>
  await GenericLogicFactory.connect(
    address || (await getDb().get(`${eContractid.GenericLogic}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getBTokensAndBNFTsHelper = async (address?: tEthereumAddress) =>
  await BTokensAndBNFTsHelperFactory.connect(
    address || (await getDb().get(`${eContractid.BTokensAndBNFTsHelper}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getWETHGateway = async (address?: tEthereumAddress) =>
  await WETHGatewayFactory.connect(
    address || (await getDb().get(`${eContractid.WETHGateway}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getWETHMocked = async (address?: tEthereumAddress) =>
  await WETH9MockedFactory.connect(
    address || (await getDb().get(`${eContractid.WETHMocked}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getMockBToken = async (address?: tEthereumAddress) =>
  await MockBTokenFactory.connect(
    address || (await getDb().get(`${eContractid.MockBToken}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getSelfdestructTransferMock = async (address?: tEthereumAddress) =>
  await SelfdestructTransferFactory.connect(
    address || (await getDb().get(`${eContractid.SelfdestructTransferMock}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getProxy = async (address: tEthereumAddress) =>
  await InitializableAdminProxyFactory.connect(address, await getFirstSigner());

export const getInitializableAdminProxy = async (address: tEthereumAddress) =>
  await InitializableAdminProxyFactory.connect(address, await getFirstSigner());

export const getLendPoolImpl = async (address?: tEthereumAddress) =>
  await LendPoolFactory.connect(
    address || (await getDb().get(`${eContractid.LendPoolImpl}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getLendPoolConfiguratorImpl = async (address?: tEthereumAddress) =>
  await LendPoolConfiguratorFactory.connect(
    address || (await getDb().get(`${eContractid.LendPoolConfiguratorImpl}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getLendPoolLoanImpl = async (address?: tEthereumAddress) =>
  await LendPoolLoanFactory.connect(
    address || (await getDb().get(`${eContractid.LendPoolLoanImpl}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getWalletProvider = async (address?: tEthereumAddress) =>
  await WalletBalanceProviderFactory.connect(
    address || (await getDb().get(`${eContractid.WalletBalanceProvider}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getAddressById = async (id: string): Promise<tEthereumAddress | undefined> =>
  (await getDb().get(`${id}.${DRE.network.name}`).value())?.address || undefined;

export const getMockBNFTMinter = async (address?: tEthereumAddress) =>
  await MockBTokenFactory.connect(
    address || (await getDb().get(`${eContractid.MockBNFTMinter}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getCryptoPunksMarket = async (address?: tEthereumAddress) =>
  await CryptoPunksMarketFactory.connect(
    address || (await getDb().get(`${eContractid.CryptoPunksMarket}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getWrappedPunk = async (address?: tEthereumAddress) =>
  await WrappedPunkFactory.connect(
    address || (await getDb().get(`${eContractid.WrappedPunk}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

export const getPunkGateway = async (address?: tEthereumAddress) =>
  await PunkGatewayFactory.connect(
    address || (await getDb().get(`${eContractid.PunkGateway}.${DRE.network.name}`).value()).address,
    await getFirstSigner()
  );

import { Signer, ethers } from "ethers";
import {
  BendProtocolDataProviderFactory,
  BTokenFactory,
  DebtTokenFactory,
  BNFTFactory,
  BNFTRegistryFactory,
  InterestRateFactory,
  GenericLogicFactory,
  LendPoolAddressesProviderFactory,
  LendPoolAddressesProviderRegistryFactory,
  LendPoolConfiguratorFactory,
  LendPoolFactory,
  LendPoolLoanFactory,
  LendPoolLiquidatorFactory,
  MintableERC20Factory,
  MintableERC721Factory,
  BTokensAndBNFTsHelperFactory,
  ReserveOracleFactory,
  MockChainlinkOracleFactory,
  MockReserveOracleFactory,
  NFTOracleFactory,
  MockNFTOracleFactory,
  ReserveLogicFactory,
  //NftLogicFactory,
  SelfdestructTransferFactory,
  WalletBalanceProviderFactory,
  WETH9MockedFactory,
  WETHGatewayFactory,
  CryptoPunksMarketFactory,
  WrappedPunkFactory,
  PunkGatewayFactory,
  BendUpgradeableProxyFactory,
  BendProxyAdminFactory,
  MockIncentivesControllerFactory,
  UiPoolDataProviderFactory,
  BendCollectorFactory,
} from "../types";
import { IERC20DetailedFactory } from "../types/IERC20DetailedFactory";
import { IERC721DetailedFactory } from "../types/IERC721DetailedFactory";
import { getEthersSigners, MockTokenMap, MockNftMap } from "./contracts-helpers";
import { DRE, getDb, notFalsyOrZeroAddress, omit } from "./misc-utils";
import { eContractid, PoolConfiguration, tEthereumAddress, TokenContractId, NftContractId } from "./types";

export const getFirstSigner = async () => (await getEthersSigners())[0];

export const getSecondSigner = async () => (await getEthersSigners())[1];

export const getThirdSigner = async () => (await getEthersSigners())[2];

export const getDeploySigner = async () => (await getEthersSigners())[0];

export const getPoolAdminSigner = async () => (await getEthersSigners())[0];

export const getPoolOwnerSigner = async () => (await getEthersSigners())[0];

export const getEmergencyAdminSigner = async () => (await getEthersSigners())[1];

export const getProxyAdminSigner = async () => (await getEthersSigners())[2];

export const getLendPoolAddressesProviderRegistry = async (address?: tEthereumAddress) => {
  return await LendPoolAddressesProviderRegistryFactory.connect(
    address ||
      (
        await getDb(`${DRE.network.name}`).get(`${eContractid.LendPoolAddressesProviderRegistry}`).value()
      ).address,
    await getFirstSigner()
  );
};

export const getLendPoolAddressesProvider = async (address?: tEthereumAddress) => {
  return await LendPoolAddressesProviderFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.LendPoolAddressesProvider}`).value()).address,
    await getFirstSigner()
  );
};

export const getLendPoolConfiguratorProxy = async (address?: tEthereumAddress) => {
  return await LendPoolConfiguratorFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.LendPoolConfigurator}`).value()).address,
    await getFirstSigner()
  );
};

export const getBNFTRegistryProxy = async (address?: tEthereumAddress) => {
  return await BNFTRegistryFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.BNFTRegistry}`).value()).address,
    await getFirstSigner()
  );
};

export const getLendPoolLoanProxy = async (address?: tEthereumAddress) => {
  return await LendPoolLoanFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.LendPoolLoan}`).value()).address,
    await getFirstSigner()
  );
};

export const getLendPool = async (address?: tEthereumAddress) =>
  await LendPoolFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.LendPool}`).value()).address,
    await getFirstSigner()
  );

export const getLendPoolLiquidator = async (address?: tEthereumAddress) =>
  await LendPoolLiquidatorFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.LendPoolLiquidator}`).value()).address,
    await getFirstSigner()
  );

export const getReserveOracle = async (address?: tEthereumAddress) =>
  await ReserveOracleFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.ReserveOracle}`).value()).address,
    await getFirstSigner()
  );

export const getReserveOracleImpl = async (address?: tEthereumAddress) =>
  await ReserveOracleFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.ReserveOracleImpl}`).value()).address,
    await getFirstSigner()
  );

export const getMockChainlinkOracle = async (address?: tEthereumAddress) =>
  await MockChainlinkOracleFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.MockChainlinkOracle}`).value()).address,
    await getFirstSigner()
  );

export const getNFTOracle = async (address?: tEthereumAddress) =>
  await NFTOracleFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.NFTOracle}`).value()).address,
    await getFirstSigner()
  );

export const getNFTOracleImpl = async (address?: tEthereumAddress) =>
  await NFTOracleFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.NFTOracleImpl}`).value()).address,
    await getFirstSigner()
  );

export const getMockReserveOracle = async (address?: tEthereumAddress) =>
  await MockReserveOracleFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.MockReserveOracle}`).value()).address,
    await getFirstSigner()
  );

export const getMockNFTOracle = async (address?: tEthereumAddress) =>
  await MockNFTOracleFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.MockNFTOracle}`).value()).address,
    await getFirstSigner()
  );

export const getBToken = async (address?: tEthereumAddress) =>
  await BTokenFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.BToken}`).value()).address,
    await getFirstSigner()
  );

export const getDebtToken = async (address?: tEthereumAddress) =>
  await DebtTokenFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.DebtToken}`).value()).address,
    await getFirstSigner()
  );

export const getBNFT = async (address?: tEthereumAddress) =>
  await BNFTFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.BNFT}`).value()).address,
    await getFirstSigner()
  );

export const getMintableERC20 = async (address: tEthereumAddress) =>
  await MintableERC20Factory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.MintableERC20}`).value()).address,
    await getFirstSigner()
  );

export const getMintableERC721 = async (address: tEthereumAddress) =>
  await MintableERC721Factory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.MintableERC721}`).value()).address,
    await getFirstSigner()
  );

export const getIErc20Detailed = async (address: tEthereumAddress) =>
  await IERC20DetailedFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.IERC20Detailed}`).value()).address,
    await getFirstSigner()
  );

export const getIErc721Detailed = async (address: tEthereumAddress) =>
  await IERC721DetailedFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.IERC721Detailed}`).value()).address,
    await getFirstSigner()
  );

export const getBendProtocolDataProvider = async (address?: tEthereumAddress) =>
  await BendProtocolDataProviderFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.BendProtocolDataProvider}`).value()).address,
    await getFirstSigner()
  );

export const getUIPoolDataProvider = async (address?: tEthereumAddress) =>
  await UiPoolDataProviderFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.UIPoolDataProvider}`).value()).address,
    await getFirstSigner()
  );

export const getInterestRate = async (address?: tEthereumAddress) =>
  await InterestRateFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.InterestRate}`).value()).address,
    await getFirstSigner()
  );

export const getMockedTokens = async (config: PoolConfiguration) => {
  const tokenSymbols = Object.keys(config.ReservesConfig);
  const db = getDb(DRE.network.name);
  const tokens: MockTokenMap = await tokenSymbols.reduce<Promise<MockTokenMap>>(async (acc, tokenSymbol) => {
    const accumulator = await acc;
    const address = db.get(`${tokenSymbol.toUpperCase()}`).value().address;
    accumulator[tokenSymbol] = await getMintableERC20(address);
    return Promise.resolve(acc);
  }, Promise.resolve({}));
  return tokens;
};

export const getAllMockedTokens = async () => {
  const db = getDb(DRE.network.name);
  const tokens: MockTokenMap = await Object.keys(TokenContractId).reduce<Promise<MockTokenMap>>(
    async (acc, tokenSymbol) => {
      const accumulator = await acc;
      const address = db.get(`${tokenSymbol.toUpperCase()}`).value().address;
      accumulator[tokenSymbol] = await getMintableERC20(address);
      return Promise.resolve(acc);
    },
    Promise.resolve({})
  );
  return tokens;
};

export const getConfigMockedNfts = async (config: PoolConfiguration) => {
  const tokenSymbols = Object.keys(config.NftsConfig);
  const db = getDb(DRE.network.name);
  const tokens: MockNftMap = await tokenSymbols.reduce<Promise<MockNftMap>>(async (acc, tokenSymbol) => {
    const accumulator = await acc;
    const address = db.get(`${tokenSymbol.toUpperCase()}`).value().address;
    accumulator[tokenSymbol] = await getMintableERC721(address);
    return Promise.resolve(acc);
  }, Promise.resolve({}));
  return tokens;
};

export const getAllMockedNfts = async () => {
  const db = getDb(DRE.network.name);
  const tokens: MockNftMap = await Object.keys(NftContractId).reduce<Promise<MockNftMap>>(async (acc, tokenSymbol) => {
    const accumulator = await acc;
    const address = db.get(`${tokenSymbol.toUpperCase()}`).value().address;
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
    if (aggregatorAddressIndex < 0) {
      throw Error(`can not find aggregator for ${tokenSymbol}`);
    }
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

/*
export const getNftLogic = async (address?: tEthereumAddress) =>
  await NftLogicFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.NftLogic}`).value()).address,
    await getFirstSigner()
  );
*/

export const getReserveLogic = async (address?: tEthereumAddress) =>
  await ReserveLogicFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.ReserveLogic}`).value()).address,
    await getFirstSigner()
  );

export const getGenericLogic = async (address?: tEthereumAddress) =>
  await GenericLogicFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.GenericLogic}`).value()).address,
    await getFirstSigner()
  );

export const getBTokensAndBNFTsHelper = async (address?: tEthereumAddress) =>
  await BTokensAndBNFTsHelperFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.BTokensAndBNFTsHelper}`).value()).address,
    await getFirstSigner()
  );

export const getWETHGateway = async (address?: tEthereumAddress) =>
  await WETHGatewayFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.WETHGateway}`).value()).address,
    await getFirstSigner()
  );

export const getWETHMocked = async (address?: tEthereumAddress) =>
  await WETH9MockedFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.WETHMocked}`).value()).address,
    await getFirstSigner()
  );

export const getSelfdestructTransferMock = async (address?: tEthereumAddress) =>
  await SelfdestructTransferFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.SelfdestructTransferMock}`).value()).address,
    await getFirstSigner()
  );

export const getBendUpgradeableProxy = async (address: tEthereumAddress) =>
  await BendUpgradeableProxyFactory.connect(address, await getFirstSigner());

export const getBendProxyAdminByAddress = async (address: tEthereumAddress) =>
  await BendProxyAdminFactory.connect(address, await getFirstSigner());

export const getBendProxyAdminById = async (id: string) =>
  await BendProxyAdminFactory.connect(
    (
      await getDb(DRE.network.name).get(`${id}`).value()
    ).address,
    await getFirstSigner()
  );

export const getLendPoolImpl = async (address?: tEthereumAddress) =>
  await LendPoolFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.LendPoolImpl}`).value()).address,
    await getFirstSigner()
  );

export const getLendPoolConfiguratorImpl = async (address?: tEthereumAddress) =>
  await LendPoolConfiguratorFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.LendPoolConfiguratorImpl}`).value()).address,
    await getFirstSigner()
  );

export const getLendPoolLoanImpl = async (address?: tEthereumAddress) =>
  await LendPoolLoanFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.LendPoolLoanImpl}`).value()).address,
    await getFirstSigner()
  );

export const getBNFTRegistryImpl = async (address?: tEthereumAddress) => {
  return await BNFTRegistryFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.BNFTRegistryImpl}`).value()).address,
    await getFirstSigner()
  );
};

export const getWalletProvider = async (address?: tEthereumAddress) =>
  await WalletBalanceProviderFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.WalletBalanceProvider}`).value()).address,
    await getFirstSigner()
  );

export const getAddressById = async (id: string): Promise<tEthereumAddress | undefined> =>
  (await getDb(DRE.network.name).get(`${id}`).value())?.address || undefined;

export const getCryptoPunksMarket = async (address?: tEthereumAddress) =>
  await CryptoPunksMarketFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.CryptoPunksMarket}`).value()).address,
    await getFirstSigner()
  );

export const getWrappedPunk = async (address?: tEthereumAddress) =>
  await WrappedPunkFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.WrappedPunk}`).value()).address,
    await getFirstSigner()
  );

export const getPunkGateway = async (address?: tEthereumAddress) =>
  await PunkGatewayFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.PunkGateway}`).value()).address,
    await getFirstSigner()
  );

export const getMockIncentivesController = async (address?: tEthereumAddress) =>
  await MockIncentivesControllerFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.MockIncentivesController}`).value()).address,
    await getFirstSigner()
  );

export const getBendCollectorProxy = async (address?: tEthereumAddress) =>
  await BendCollectorFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.BendCollector}`).value()).address,
    await getFirstSigner()
  );

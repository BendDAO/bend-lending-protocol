import { Contract } from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { DRE, getDb, notFalsyOrZeroAddress } from "./misc-utils";
import {
  tEthereumAddress,
  eContractid,
  BendPools,
  TokenContractId,
  NftContractId,
  IReserveParams,
  INftParams,
} from "./types";
import { MockContract } from "ethereum-waffle";
import { ConfigNames, getReservesConfigByPool, getNftsConfigByPool, loadPoolConfig } from "./configuration";
import { getDeploySigner } from "./contracts-getters";
import {
  LendPoolAddressesProviderRegistryFactory,
  BendProtocolDataProviderFactory,
  MintableERC20,
  MintableERC20Factory,
  MintableERC721,
  MintableERC721Factory,
  BTokenFactory,
  DebtTokenFactory,
  BNFTFactory,
  BNFTRegistryFactory,
  InterestRateFactory,
  LendPoolConfiguratorFactory,
  LendPoolFactory,
  LendPoolAddressesProviderFactory,
  LendPoolLoanFactory,
  ReserveOracleFactory,
  NFTOracleFactory,
  MockNFTOracleFactory,
  MockReserveOracleFactory,
  ReserveLogicFactory,
  //NftLogicFactory,
  SelfdestructTransferFactory,
  WalletBalanceProviderFactory,
  WETH9MockedFactory,
  WETHGatewayFactory,
  CryptoPunksMarketFactory,
  WrappedPunkFactory,
  PunkGatewayFactory,
  MockChainlinkOracleFactory,
  BendUpgradeableProxyFactory,
  BendProxyAdminFactory,
  MockIncentivesControllerFactory,
  WrappedPunk,
  WETH9Mocked,
  UiPoolDataProviderFactory,
  BendCollectorFactory,
  TimelockControllerFactory,
  WETH9,
  WETH9Factory,
  SupplyLogicFactory,
  BorrowLogicFactory,
  LiquidateLogicFactory,
  GenericLogicFactory,
  ConfiguratorLogicFactory,
} from "../types";
import {
  withSaveAndVerify,
  registerContractInJsonDb,
  linkBytecode,
  insertContractAddressInDb,
  getOptionalParamAddressPerNetwork,
  getContractAddressInDb,
} from "./contracts-helpers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { LendPoolLibraryAddresses } from "../types/LendPoolFactory";
import { eNetwork } from "./types";

const readArtifact = async (id: string) => {
  return (DRE as HardhatRuntimeEnvironment).artifacts.readArtifact(id);
};

export const deployLendPoolAddressesProviderRegistry = async (verify?: boolean) =>
  withSaveAndVerify(
    await new LendPoolAddressesProviderRegistryFactory(await getDeploySigner()).deploy(),
    eContractid.LendPoolAddressesProviderRegistry,
    [],
    verify
  );

export const deployLendPoolAddressesProvider = async (marketId: string, verify?: boolean) =>
  withSaveAndVerify(
    await new LendPoolAddressesProviderFactory(await getDeploySigner()).deploy(marketId),
    eContractid.LendPoolAddressesProvider,
    [marketId],
    verify
  );

export const deployLendPoolConfigurator = async (verify?: boolean) => {
  const cfgLogicAddress = await getContractAddressInDb(eContractid.ConfiguratorLogic);

  const libraries = {
    [PLACEHOLDER_CONFIGURATOR_LOGIC]: cfgLogicAddress,
  };

  const lendPoolConfiguratorImpl = await new LendPoolConfiguratorFactory(libraries, await getDeploySigner()).deploy();
  await insertContractAddressInDb(eContractid.LendPoolConfiguratorImpl, lendPoolConfiguratorImpl.address);
  return withSaveAndVerify(lendPoolConfiguratorImpl, eContractid.LendPoolConfigurator, [], verify);
};

export const deployLendPoolLoan = async (verify?: boolean) => {
  const lendPoolLoanImpl = await new LendPoolLoanFactory(await getDeploySigner()).deploy();
  await insertContractAddressInDb(eContractid.LendPoolLoanImpl, lendPoolLoanImpl.address);
  return withSaveAndVerify(lendPoolLoanImpl, eContractid.LendPoolLoan, [], verify);
};

export const deployBNFTRegistry = async (verify?: boolean) => {
  const bnftRegistryImpl = await new BNFTRegistryFactory(await getDeploySigner()).deploy();
  await insertContractAddressInDb(eContractid.BNFTRegistryImpl, bnftRegistryImpl.address);
  return withSaveAndVerify(bnftRegistryImpl, eContractid.BNFTRegistry, [], verify);
};

export const deployReserveLogicLibrary = async (verify?: boolean) =>
  withSaveAndVerify(
    await new ReserveLogicFactory(await getDeploySigner()).deploy(),
    eContractid.ReserveLogic,
    [],
    verify
  );

export const deployNftLogicLibrary = async (verify?: boolean) => {
  const nftLogicArtifact = await readArtifact(eContractid.NftLogic);
  const linkedNftLogicByteCode = linkBytecode(nftLogicArtifact, {
    //[eContractid.ReserveLogic]: reserveLogic.address,
  });

  const nftLogicFactory = await DRE.ethers.getContractFactory(nftLogicArtifact.abi, linkedNftLogicByteCode);

  const nftLogic = await (await nftLogicFactory.connect(await getDeploySigner()).deploy()).deployed();

  return withSaveAndVerify(nftLogic, eContractid.NftLogic, [], verify);
};

export const deployGenericLogic = async (verify?: boolean) => {
  return withSaveAndVerify(
    await new GenericLogicFactory(await getDeploySigner()).deploy(),
    eContractid.GenericLogic,
    [],
    verify
  );
};

export const deployValidationLogic = async (reserveLogic: Contract, genericLogic: Contract, verify?: boolean) => {
  const validationLogicArtifact = await readArtifact(eContractid.ValidationLogic);

  const linkedValidationLogicByteCode = linkBytecode(validationLogicArtifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
    [eContractid.GenericLogic]: genericLogic.address,
  });

  const validationLogicFactory = await DRE.ethers.getContractFactory(
    validationLogicArtifact.abi,
    linkedValidationLogicByteCode
  );

  const validationLogic = await (await validationLogicFactory.connect(await getDeploySigner()).deploy()).deployed();

  return withSaveAndVerify(validationLogic, eContractid.ValidationLogic, [], verify);
};

export const deploySupplyLogicLibrary = async (verify?: boolean) => {
  const validateLogicAddress = await getContractAddressInDb(eContractid.ValidationLogic);
  const libraries = {
    [PLACEHOLDER_VALIDATION_LOGIC]: validateLogicAddress,
  };

  return withSaveAndVerify(
    await new SupplyLogicFactory(libraries, await getDeploySigner()).deploy(),
    eContractid.SupplyLogic,
    [],
    verify
  );
};

export const deployBorrowLogicLibrary = async (verify?: boolean) => {
  const validateLogicAddress = await getContractAddressInDb(eContractid.ValidationLogic);
  const libraries = {
    [PLACEHOLDER_VALIDATION_LOGIC]: validateLogicAddress,
  };

  return withSaveAndVerify(
    await new BorrowLogicFactory(libraries, await getDeploySigner()).deploy(),
    eContractid.BorrowLogic,
    [],
    verify
  );
};

export const deployLiquidateLogicLibrary = async (verify?: boolean) => {
  const validateLogicAddress = await getContractAddressInDb(eContractid.ValidationLogic);
  const libraries = {
    [PLACEHOLDER_VALIDATION_LOGIC]: validateLogicAddress,
  };

  return withSaveAndVerify(
    await new LiquidateLogicFactory(libraries, await getDeploySigner()).deploy(),
    eContractid.LiquidateLogic,
    [],
    verify
  );
};

export const deployBendLibraries = async (verify?: boolean) => {
  await deployLendPoolLibraries(verify);
  await deployConfiguratorLibraries(verify);
};

export const deployLendPoolLibraries = async (verify?: boolean) => {
  const genericLogic = await deployGenericLogic(verify);
  const reserveLogic = await deployReserveLogicLibrary(verify);
  const nftLogic = await deployNftLogicLibrary(verify);
  const validationLogic = await deployValidationLogic(reserveLogic, genericLogic, verify);

  const supplyLogic = await deploySupplyLogicLibrary(verify);
  const borrowLogic = await deployBorrowLogicLibrary(verify);
  const liquidateLogic = await deployLiquidateLogicLibrary(verify);
};

export const getLendPoolLibraries = async (verify?: boolean): Promise<LendPoolLibraryAddresses> => {
  const reserveLogicAddress = await getContractAddressInDb(eContractid.ReserveLogic);
  const nftLogicAddress = await getContractAddressInDb(eContractid.NftLogic);
  const validationLogicAddress = await getContractAddressInDb(eContractid.ValidationLogic);
  const genericLogicAddress = await getContractAddressInDb(eContractid.GenericLogic);
  const supplyLogicAddress = await getContractAddressInDb(eContractid.SupplyLogic);
  const borrowLogicAddress = await getContractAddressInDb(eContractid.BorrowLogic);
  const liquidateLogicAddress = await getContractAddressInDb(eContractid.LiquidateLogic);

  // Hardcoded solidity placeholders, if any library changes path this will fail.
  // The '__$PLACEHOLDER$__ can be calculated via solidity keccak, but the LendPoolLibraryAddresses Type seems to
  // require a hardcoded string.
  //
  //  how-to:
  //  1. PLACEHOLDER = solidity Keccak256(['string'], `${libPath}:${libName}`).slice(2, 36)
  //  2. LIB_PLACEHOLDER = `__$${PLACEHOLDER}$__`
  // or grab placeholdes from LendPoolLibraryAddresses at Typechain generation.
  //
  // libPath example: contracts/libraries/logic/GenericLogic.sol
  // libName example: GenericLogic
  return {
    //[PLACEHOLDER_GENERIC_LOGIC]: genericLogic.address,
    //[PLACEHOLDER_VALIDATION_LOGIC]: validationLogicAddress,
    [PLACEHOLDER_RESERVE_LOGIC]: reserveLogicAddress,
    [PLACEHOLDER_NFT_LOGIC]: nftLogicAddress,
    [PLACEHOLDER_SUPPLY_LOGIC]: supplyLogicAddress,
    [PLACEHOLDER_BORROW_LOGIC]: borrowLogicAddress,
    [PLACEHOLDER_LIQUIDATE_LOGIC]: liquidateLogicAddress,
  };
};

const PLACEHOLDER_GENERIC_LOGIC = "__$4c26be947d349222af871a3168b3fe584b$__";
const PLACEHOLDER_VALIDATION_LOGIC = "__$5201a97c05ba6aa659e2f36a933dd51801$__";
const PLACEHOLDER_RESERVE_LOGIC = "__$d3b4366daeb9cadc7528af6145b50b2183$__";
const PLACEHOLDER_NFT_LOGIC = "__$eceb79063fab52ea3826f3ee75ecd7f36d$__";
const PLACEHOLDER_SUPPLY_LOGIC = "__$2f7c76ee15bdc1d8f3b34a04b86951fc56$__";
const PLACEHOLDER_BORROW_LOGIC = "__$77c5a84c43428e206d5bf08427df63fefa$__";
const PLACEHOLDER_LIQUIDATE_LOGIC = "__$ce70b23849b5cbed90e6e2f622d8887206$__";
const PLACEHOLDER_CONFIGURATOR_LOGIC = "__$3b2ad8f1ea56cc7a60e9a93596bbfe9178$__";

export const deployConfiguratorLibraries = async (verify?: boolean) => {
  const cfgLogic = await deployConfiguratorLogicLibrary(verify);
};

export const deployConfiguratorLogicLibrary = async (verify?: boolean) => {
  return withSaveAndVerify(
    await new ConfiguratorLogicFactory(await getDeploySigner()).deploy(),
    eContractid.ConfiguratorLogic,
    [],
    verify
  );
};

export const deployLendPool = async (verify?: boolean) => {
  const libraries = await getLendPoolLibraries(verify);
  const lendPoolImpl = await new LendPoolFactory(libraries, await getDeploySigner()).deploy();
  await insertContractAddressInDb(eContractid.LendPoolImpl, lendPoolImpl.address);
  return withSaveAndVerify(lendPoolImpl, eContractid.LendPool, [], verify);
};

export const deployReserveOracle = async (args: [], verify?: boolean) => {
  const oracleImpl = await new ReserveOracleFactory(await getDeploySigner()).deploy();
  await insertContractAddressInDb(eContractid.ReserveOracleImpl, oracleImpl.address);
  return withSaveAndVerify(oracleImpl, eContractid.ReserveOracle, [], verify);
};

export const deployMockReserveOracle = async (args: [], verify?: boolean) =>
  withSaveAndVerify(
    await new MockReserveOracleFactory(await getDeploySigner()).deploy(...args),
    eContractid.MockReserveOracle,
    args,
    verify
  );

export const deployMockChainlinkOracle = async (decimals: string, verify?: boolean) =>
  withSaveAndVerify(
    await new MockChainlinkOracleFactory(await getDeploySigner()).deploy(decimals),
    eContractid.MockChainlinkOracle,
    [decimals],
    verify
  );

export const deployNFTOracle = async (verify?: boolean) => {
  const oracleImpl = await new NFTOracleFactory(await getDeploySigner()).deploy();
  await insertContractAddressInDb(eContractid.NFTOracleImpl, oracleImpl.address);
  return withSaveAndVerify(oracleImpl, eContractid.NFTOracle, [], verify);
};

export const deployMockNFTOracle = async (verify?: boolean) =>
  withSaveAndVerify(
    await new MockNFTOracleFactory(await getDeploySigner()).deploy(),
    eContractid.MockNFTOracle,
    [],
    verify
  );

export const deployWalletBalancerProvider = async (verify?: boolean) =>
  withSaveAndVerify(
    await new WalletBalanceProviderFactory(await getDeploySigner()).deploy(),
    eContractid.WalletBalanceProvider,
    [],
    verify
  );

export const deployBendProtocolDataProvider = async (addressesProvider: tEthereumAddress, verify?: boolean) =>
  withSaveAndVerify(
    await new BendProtocolDataProviderFactory(await getDeploySigner()).deploy(addressesProvider),
    eContractid.BendProtocolDataProvider,
    [addressesProvider],
    verify
  );

export const deployUiPoolDataProvider = async (
  reserveOracle: tEthereumAddress,
  nftOracle: tEthereumAddress,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new UiPoolDataProviderFactory(await getDeploySigner()).deploy(reserveOracle, nftOracle),
    eContractid.UIPoolDataProvider,
    [reserveOracle, nftOracle],
    verify
  );

export const deployMintableERC20 = async (args: [string, string, string], verify?: boolean): Promise<MintableERC20> =>
  withSaveAndVerify(
    await new MintableERC20Factory(await getDeploySigner()).deploy(...args),
    eContractid.MintableERC20,
    args,
    verify
  );

export const deployMintableERC721 = async (args: [string, string], verify?: boolean): Promise<MintableERC721> =>
  withSaveAndVerify(
    await new MintableERC721Factory(await getDeploySigner()).deploy(...args),
    eContractid.MintableERC721,
    args,
    verify
  );

export const deployInterestRate = async (args: [tEthereumAddress, string, string, string, string], verify: boolean) =>
  withSaveAndVerify(
    await new InterestRateFactory(await getDeploySigner()).deploy(...args),
    eContractid.InterestRate,
    args,
    verify
  );

export const deployGenericDebtToken = async (verify?: boolean) =>
  withSaveAndVerify(await new DebtTokenFactory(await getDeploySigner()).deploy(), eContractid.DebtToken, [], verify);

export const deployGenericBTokenImpl = async (verify: boolean) =>
  withSaveAndVerify(await new BTokenFactory(await getDeploySigner()).deploy(), eContractid.BToken, [], verify);

export const deployGenericBNFTImpl = async (verify: boolean) =>
  withSaveAndVerify(await new BNFTFactory(await getDeploySigner()).deploy(), eContractid.BNFT, [], verify);

export const deployAllMockTokens = async (forTestCases: boolean, verify?: boolean) => {
  const tokens: { [symbol: string]: MockContract | MintableERC20 | WETH9Mocked | WETH9 } = {};

  const protoConfigData = getReservesConfigByPool(BendPools.proto);

  for (const tokenSymbol of Object.keys(TokenContractId)) {
    const tokenName = "Bend Mock " + tokenSymbol;

    if (tokenSymbol === "WETH") {
      if (forTestCases) {
        tokens[tokenSymbol] = await deployWETHMocked();
      } else {
        tokens[tokenSymbol] = await deployWETH9();
      }
      await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
      continue;
    }

    let decimals = "18";

    let configData = (<any>protoConfigData)[tokenSymbol];

    tokens[tokenSymbol] = await deployMintableERC20(
      [tokenName, tokenSymbol, configData ? configData.reserveDecimals : decimals],
      verify
    );
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }
  return tokens;
};

export const deployAllMockNfts = async (verify?: boolean) => {
  const tokens: { [symbol: string]: MockContract | MintableERC721 | WrappedPunk } = {};

  for (const tokenSymbol of Object.keys(NftContractId)) {
    const tokenName = "Bend Mock " + tokenSymbol;
    if (tokenSymbol === "WPUNKS") {
      const cryptoPunksMarket = await deployCryptoPunksMarket([], verify);
      const wrappedPunk = await deployWrappedPunk([cryptoPunksMarket.address], verify);
      tokens[tokenSymbol] = wrappedPunk;
      await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
      continue;
    }

    tokens[tokenSymbol] = await deployMintableERC721([tokenName, tokenSymbol], verify);
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }
  return tokens;
};

export const deployWETHGateway = async (verify?: boolean) => {
  const wethImpl = await new WETHGatewayFactory(await getDeploySigner()).deploy();
  await insertContractAddressInDb(eContractid.WETHGatewayImpl, wethImpl.address);
  return withSaveAndVerify(wethImpl, eContractid.WETHGateway, [], verify);
};

export const deployWETH9 = async (verify?: boolean) =>
  withSaveAndVerify(await new WETH9Factory(await getDeploySigner()).deploy(), eContractid.WETH, [], verify);

export const deployWETHMocked = async (verify?: boolean) =>
  withSaveAndVerify(await new WETH9MockedFactory(await getDeploySigner()).deploy(), eContractid.WETHMocked, [], verify);

export const deploySelfdestructTransferMock = async (verify?: boolean) =>
  withSaveAndVerify(
    await new SelfdestructTransferFactory(await getDeploySigner()).deploy(),
    eContractid.SelfdestructTransferMock,
    [],
    verify
  );

export const chooseBTokenDeployment = (id: eContractid) => {
  switch (id) {
    case eContractid.BToken:
      return deployGenericBTokenImpl;
    //case eContractid.DelegationAwareBToken:
    //  return deployDelegationAwareBTokenImpl;
    default:
      throw Error(`Missing bToken implementation deployment script for: ${id}`);
  }
};

export const deployBTokenImplementations = async (
  pool: ConfigNames,
  reservesConfig: { [key: string]: IReserveParams },
  verify = false
) => {
  const poolConfig = loadPoolConfig(pool);
  const network = <eNetwork>DRE.network.name;

  // Obtain the different BToken implementations of all reserves inside the Market config
  const tokenImplementations = [
    ...Object.entries(reservesConfig).reduce<Set<eContractid>>((acc, [, entry]) => {
      acc.add(entry.bTokenImpl);
      return acc;
    }, new Set<eContractid>()),
  ];

  for (let x = 0; x < tokenImplementations.length; x++) {
    const tokenAddress = getOptionalParamAddressPerNetwork(poolConfig[tokenImplementations[x].toString()], network);
    if (!notFalsyOrZeroAddress(tokenAddress)) {
      const deployImplementationMethod = chooseBTokenDeployment(tokenImplementations[x]);
      console.log(`Deploying BToken implementation`, tokenImplementations[x]);
      await deployImplementationMethod(verify);
    }
  }

  // Debt tokens, for now all Market configs follows same implementations
  const genericDebtTokenAddress = getOptionalParamAddressPerNetwork(poolConfig.DebtTokenImplementation, network);

  if (!notFalsyOrZeroAddress(genericDebtTokenAddress)) {
    await deployGenericDebtToken(verify);
  }
};

export const chooseBNFTDeployment = (id: eContractid) => {
  switch (id) {
    case eContractid.BNFT:
      return deployGenericBNFTImpl;
    //case eContractid.DelegationAwareBNFT:
    //  return deployDelegationAwareBNFTImpl;
    default:
      throw Error(`Missing bNFT implementation deployment script for: ${id}`);
  }
};

export const deployBNFTImplementations = async (
  pool: ConfigNames,
  NftsConfig: { [key: string]: INftParams },
  verify = false
) => {
  const poolConfig = loadPoolConfig(pool);
  const network = <eNetwork>DRE.network.name;

  // Obtain the different BNFT implementations of all nfts inside the Market config
  const bNftImplementations = [
    ...Object.entries(NftsConfig).reduce<Set<eContractid>>((acc, [, entry]) => {
      acc.add(entry.bNftImpl);
      return acc;
    }, new Set<eContractid>()),
  ];

  for (let x = 0; x < bNftImplementations.length; x++) {
    const bNftAddress = getOptionalParamAddressPerNetwork(poolConfig[bNftImplementations[x].toString()], network);
    if (!notFalsyOrZeroAddress(bNftAddress)) {
      const deployImplementationMethod = chooseBNFTDeployment(bNftImplementations[x]);
      console.log(`Deploying BNFT implementation`, bNftImplementations[x]);
      await deployImplementationMethod(verify);
    }
  }
};

export const deployRateStrategy = async (
  strategyName: string,
  args: [tEthereumAddress, string, string, string, string],
  verify: boolean
): Promise<tEthereumAddress> => {
  switch (strategyName) {
    default:
      return await (
        await deployInterestRate(args, verify)
      ).address;
  }
};

export const deployCryptoPunksMarket = async (args: [], verify?: boolean) =>
  withSaveAndVerify(
    await new CryptoPunksMarketFactory(await getDeploySigner()).deploy(...args),
    eContractid.CryptoPunksMarket,
    args,
    verify
  );

export const deployWrappedPunk = async (args: [tEthereumAddress], verify?: boolean) =>
  withSaveAndVerify(
    await new WrappedPunkFactory(await getDeploySigner()).deploy(...args),
    eContractid.WrappedPunk,
    args,
    verify
  );

export const deployPunkGateway = async (verify?: boolean) => {
  const punkImpl = await new PunkGatewayFactory(await getDeploySigner()).deploy();
  await insertContractAddressInDb(eContractid.PunkGatewayImpl, punkImpl.address);
  return withSaveAndVerify(punkImpl, eContractid.PunkGateway, [], verify);
};

export const deployBendUpgradeableProxy = async (
  id: string,
  admin: tEthereumAddress,
  logic: tEthereumAddress,
  data: BytesLike,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new BendUpgradeableProxyFactory(await getDeploySigner()).deploy(logic, admin, data),
    id,
    [logic, admin, DRE.ethers.utils.hexlify(data)],
    verify
  );

export const deployBendProxyAdmin = async (id: string, verify?: boolean) =>
  withSaveAndVerify(await new BendProxyAdminFactory(await getDeploySigner()).deploy(), id, [], verify);

export const deployMockIncentivesController = async (verify?: boolean) =>
  withSaveAndVerify(
    await new MockIncentivesControllerFactory(await getDeploySigner()).deploy(),
    eContractid.MockIncentivesController,
    [],
    verify
  );

export const deployBendCollector = async (args: [], verify?: boolean) => {
  const bendCollectorImpl = await new BendCollectorFactory(await getDeploySigner()).deploy();
  await insertContractAddressInDb(eContractid.BendCollectorImpl, bendCollectorImpl.address);
  return withSaveAndVerify(bendCollectorImpl, eContractid.BendCollector, [], verify);
};

export const deployTimelockController = async (
  id: string,
  minDelay: string,
  proposers: string[],
  executors: string[],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new TimelockControllerFactory(await getDeploySigner()).deploy(minDelay, proposers, executors),
    id,
    [],
    verify
  );

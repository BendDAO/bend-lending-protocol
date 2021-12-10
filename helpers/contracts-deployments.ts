import { Contract } from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { DRE, getDb, notFalsyOrZeroAddress } from "./misc-utils";
import {
  tEthereumAddress,
  eContractid,
  tStringTokenSmallUnits,
  BendPools,
  TokenContractId,
  NftContractId,
  iMultiPoolsAssets,
  IReserveParams,
  INftParams,
  PoolConfiguration,
  eEthereumNetwork,
} from "./types";
import { MockContract } from "ethereum-waffle";
import { ConfigNames, getReservesConfigByPool, getNftsConfigByPool, loadPoolConfig } from "./configuration";
import { getFirstSigner } from "./contracts-getters";
import { ZERO_ADDRESS } from "./constants";
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
  LendPoolLiquidatorFactory,
  BTokensAndBNFTsHelperFactory,
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
} from "../types";
import {
  withSaveAndVerify,
  registerContractInJsonDb,
  linkBytecode,
  insertContractAddressInDb,
  deployContract,
  verifyContract,
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
    await new LendPoolAddressesProviderRegistryFactory(await getFirstSigner()).deploy(),
    eContractid.LendPoolAddressesProviderRegistry,
    [],
    verify
  );

export const deployLendPoolAddressesProvider = async (marketId: string, verify?: boolean) =>
  withSaveAndVerify(
    await new LendPoolAddressesProviderFactory(await getFirstSigner()).deploy(marketId),
    eContractid.LendPoolAddressesProvider,
    [marketId],
    verify
  );

export const deployLendPoolConfigurator = async (verify?: boolean) => {
  const lendPoolConfiguratorImpl = await new LendPoolConfiguratorFactory(await getFirstSigner()).deploy();
  await insertContractAddressInDb(eContractid.LendPoolConfiguratorImpl, lendPoolConfiguratorImpl.address);
  return withSaveAndVerify(lendPoolConfiguratorImpl, eContractid.LendPoolConfigurator, [], verify);
};

export const deployLendPoolLoan = async (verify?: boolean) => {
  const lendPoolLoanImpl = await new LendPoolLoanFactory(await getFirstSigner()).deploy();
  await insertContractAddressInDb(eContractid.LendPoolLoanImpl, lendPoolLoanImpl.address);
  return withSaveAndVerify(lendPoolLoanImpl, eContractid.LendPoolLoan, [], verify);
};

export const deployBNFTRegistry = async (verify?: boolean) => {
  const bnftRegistryImpl = await new BNFTRegistryFactory(await getFirstSigner()).deploy();
  await insertContractAddressInDb(eContractid.BNFTRegistryImpl, bnftRegistryImpl.address);
  return withSaveAndVerify(bnftRegistryImpl, eContractid.BNFTRegistry, [], verify);
};

export const deployReserveLogicLibrary = async (verify?: boolean) =>
  withSaveAndVerify(
    await new ReserveLogicFactory(await getFirstSigner()).deploy(),
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

  const nftLogic = await (await nftLogicFactory.connect(await getFirstSigner()).deploy()).deployed();

  return withSaveAndVerify(nftLogic, eContractid.NftLogic, [], verify);
};

export const deployGenericLogic = async (reserveLogic: Contract, verify?: boolean) => {
  const genericLogicArtifact = await readArtifact(eContractid.GenericLogic);

  const linkedGenericLogicByteCode = linkBytecode(genericLogicArtifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
  });

  const genericLogicFactory = await DRE.ethers.getContractFactory(genericLogicArtifact.abi, linkedGenericLogicByteCode);

  const genericLogic = await (await genericLogicFactory.connect(await getFirstSigner()).deploy()).deployed();
  return withSaveAndVerify(genericLogic, eContractid.GenericLogic, [], verify);
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

  const validationLogic = await (await validationLogicFactory.connect(await getFirstSigner()).deploy()).deployed();

  return withSaveAndVerify(validationLogic, eContractid.ValidationLogic, [], verify);
};

export const deployBendLibraries = async (verify?: boolean) => {
  const reserveLogic = await deployReserveLogicLibrary(verify);
  const nftLogic = await deployNftLogicLibrary(verify);
  const genericLogic = await deployGenericLogic(reserveLogic, verify);
  const validationLogic = await deployValidationLogic(reserveLogic, genericLogic, verify);
};

export const getBendLibraries = async (verify?: boolean): Promise<LendPoolLibraryAddresses> => {
  const reserveLogicAddress = await getContractAddressInDb(eContractid.ReserveLogic);
  const nftLogicAddress = await getContractAddressInDb(eContractid.NftLogic);
  const validationLogicAddress = await getContractAddressInDb(eContractid.ValidationLogic);
  const genericLogicAddress = await getContractAddressInDb(eContractid.GenericLogic);

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
    //["__$4c26be947d349222af871a3168b3fe584b$__"]: genericLogic.address,
    ["__$5201a97c05ba6aa659e2f36a933dd51801$__"]: validationLogicAddress,
    ["__$d3b4366daeb9cadc7528af6145b50b2183$__"]: reserveLogicAddress,
    ["__$eceb79063fab52ea3826f3ee75ecd7f36d$__"]: nftLogicAddress,
  };
};

export const deployLendPool = async (verify?: boolean) => {
  const libraries = await getBendLibraries(verify);
  const lendPoolImpl = await new LendPoolFactory(libraries, await getFirstSigner()).deploy();
  await insertContractAddressInDb(eContractid.LendPoolImpl, lendPoolImpl.address);
  return withSaveAndVerify(lendPoolImpl, eContractid.LendPool, [], verify);
};

export const deployLendPoolLiquidator = async (verify?: boolean) => {
  const libraries = await getBendLibraries(verify);
  const collateralManagerImpl = await new LendPoolLiquidatorFactory(libraries, await getFirstSigner()).deploy();
  await insertContractAddressInDb(eContractid.LendPoolLiquidatorImpl, collateralManagerImpl.address);
  return withSaveAndVerify(collateralManagerImpl, eContractid.LendPoolLiquidator, [], verify);
};

export const deployReserveOracle = async (args: [], verify?: boolean) => {
  const oracleImpl = await new ReserveOracleFactory(await getFirstSigner()).deploy();
  await insertContractAddressInDb(eContractid.ReserveOracleImpl, oracleImpl.address);
  return withSaveAndVerify(oracleImpl, eContractid.ReserveOracle, [], verify);
};

export const deployMockReserveOracle = async (args: [], verify?: boolean) =>
  withSaveAndVerify(
    await new MockReserveOracleFactory(await getFirstSigner()).deploy(...args),
    eContractid.MockReserveOracle,
    args,
    verify
  );

export const deployMockChainlinkOracle = async (decimals: string, verify?: boolean) =>
  withSaveAndVerify(
    await new MockChainlinkOracleFactory(await getFirstSigner()).deploy(decimals),
    eContractid.MockChainlinkOracle,
    [decimals],
    verify
  );

export const deployNFTOracle = async (verify?: boolean) => {
  const oracleImpl = await new NFTOracleFactory(await getFirstSigner()).deploy();
  await insertContractAddressInDb(eContractid.NFTOracleImpl, oracleImpl.address);
  return withSaveAndVerify(oracleImpl, eContractid.NFTOracle, [], verify);
};

export const deployMockNFTOracle = async (verify?: boolean) =>
  withSaveAndVerify(
    await new MockNFTOracleFactory(await getFirstSigner()).deploy(),
    eContractid.MockNFTOracle,
    [],
    verify
  );

export const deployWalletBalancerProvider = async (verify?: boolean) =>
  withSaveAndVerify(
    await new WalletBalanceProviderFactory(await getFirstSigner()).deploy(),
    eContractid.WalletBalanceProvider,
    [],
    verify
  );

export const deployBendProtocolDataProvider = async (addressesProvider: tEthereumAddress, verify?: boolean) =>
  withSaveAndVerify(
    await new BendProtocolDataProviderFactory(await getFirstSigner()).deploy(addressesProvider),
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
    await new UiPoolDataProviderFactory(await getFirstSigner()).deploy(reserveOracle, nftOracle),
    eContractid.UIPoolDataProvider,
    [reserveOracle, nftOracle],
    verify
  );

export const deployMintableERC20 = async (args: [string, string, string], verify?: boolean): Promise<MintableERC20> =>
  withSaveAndVerify(
    await new MintableERC20Factory(await getFirstSigner()).deploy(...args),
    eContractid.MintableERC20,
    args,
    verify
  );

export const deployMintableERC721 = async (args: [string, string], verify?: boolean): Promise<MintableERC721> =>
  withSaveAndVerify(
    await new MintableERC721Factory(await getFirstSigner()).deploy(...args),
    eContractid.MintableERC721,
    args,
    verify
  );

export const deployInterestRate = async (args: [tEthereumAddress, string, string, string, string], verify: boolean) =>
  withSaveAndVerify(
    await new InterestRateFactory(await getFirstSigner()).deploy(...args),
    eContractid.InterestRate,
    args,
    verify
  );

export const deployGenericDebtToken = async (verify?: boolean) =>
  withSaveAndVerify(await new DebtTokenFactory(await getFirstSigner()).deploy(), eContractid.DebtToken, [], verify);

export const deployGenericBTokenImpl = async (verify: boolean) =>
  withSaveAndVerify(await new BTokenFactory(await getFirstSigner()).deploy(), eContractid.BToken, [], verify);

export const deployGenericBNFTImpl = async (verify: boolean) =>
  withSaveAndVerify(await new BNFTFactory(await getFirstSigner()).deploy(), eContractid.BNFT, [], verify);

export const deployAllMockTokens = async (verify?: boolean) => {
  const tokens: { [symbol: string]: MockContract | MintableERC20 | WETH9Mocked } = {};

  const protoConfigData = getReservesConfigByPool(BendPools.proto);

  for (const tokenSymbol of Object.keys(TokenContractId)) {
    const tokenName = "Bend Mock " + tokenSymbol;

    if (tokenSymbol === "WETH") {
      tokens[tokenSymbol] = await deployWETHMocked();
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

export const deployBTokensAndBNFTsHelper = async (
  args: [tEthereumAddress, tEthereumAddress, tEthereumAddress],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new BTokensAndBNFTsHelperFactory(await getFirstSigner()).deploy(...args),
    eContractid.BTokensAndBNFTsHelper,
    args,
    verify
  );

export const deployWETHGateway = async (args: [tEthereumAddress, tEthereumAddress], verify?: boolean) =>
  withSaveAndVerify(
    await new WETHGatewayFactory(await getFirstSigner()).deploy(...args),
    eContractid.WETHGateway,
    args,
    verify
  );

export const deployWETHMocked = async (verify?: boolean) =>
  withSaveAndVerify(await new WETH9MockedFactory(await getFirstSigner()).deploy(), eContractid.WETHMocked, [], verify);

export const deploySelfdestructTransferMock = async (verify?: boolean) =>
  withSaveAndVerify(
    await new SelfdestructTransferFactory(await getFirstSigner()).deploy(),
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
    await new CryptoPunksMarketFactory(await getFirstSigner()).deploy(...args),
    eContractid.CryptoPunksMarket,
    args,
    verify
  );

export const deployWrappedPunk = async (args: [tEthereumAddress], verify?: boolean) =>
  withSaveAndVerify(
    await new WrappedPunkFactory(await getFirstSigner()).deploy(...args),
    eContractid.WrappedPunk,
    args,
    verify
  );

export const deployPunkGateway = async (
  args: [tEthereumAddress, tEthereumAddress, tEthereumAddress, tEthereumAddress],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new PunkGatewayFactory(await getFirstSigner()).deploy(...args),
    eContractid.PunkGateway,
    args,
    verify
  );

export const deployBendUpgradeableProxy = async (
  id: string,
  admin: tEthereumAddress,
  logic: tEthereumAddress,
  data: BytesLike,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new BendUpgradeableProxyFactory(await getFirstSigner()).deploy(logic, admin, data),
    id,
    [logic, admin, DRE.ethers.utils.hexlify(data)],
    verify
  );

export const deployBendProxyAdmin = async (id: string, verify?: boolean) =>
  withSaveAndVerify(await new BendProxyAdminFactory(await getFirstSigner()).deploy(), id, [], verify);

export const deployMockIncentivesController = async (verify?: boolean) =>
  withSaveAndVerify(
    await new MockIncentivesControllerFactory(await getFirstSigner()).deploy(),
    eContractid.MockIncentivesController,
    [],
    verify
  );

export const deployBendCollector = async (args: [], verify?: boolean) => {
  const bendCollectorImpl = await new BendCollectorFactory(await getFirstSigner()).deploy();
  await insertContractAddressInDb(eContractid.BendCollectorImpl, bendCollectorImpl.address);
  return withSaveAndVerify(bendCollectorImpl, eContractid.BendCollector, [], verify);
};

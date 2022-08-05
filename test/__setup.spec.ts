import rawBRE from "hardhat";
import { MockContract } from "ethereum-waffle";
import "./helpers/utils/math";
import { insertContractAddressInDb, registerContractInJsonDb } from "../helpers/contracts-helpers";
import {
  deployLendPoolAddressesProvider,
  deployBTokenImplementations,
  deployLendPoolConfigurator,
  deployLendPool,
  deployLendPoolLoan,
  deployReserveOracle,
  deployNFTOracle,
  deployMockNFTOracle,
  deployMockReserveOracle,
  deployWalletBalancerProvider,
  deployBendProtocolDataProvider,
  deployWETHGateway,
  deployBNFTRegistry,
  deployPunkGateway,
  deployBendUpgradeableProxy,
  deployBendProxyAdmin,
  deployGenericBNFTImpl,
  deployLendPoolAddressesProviderRegistry,
  deployMockIncentivesController,
  deployAllMockTokens,
  deployAllMockNfts,
  deployUiPoolDataProvider,
  deployMockChainlinkOracle,
  deployBendLibraries,
} from "../helpers/contracts-deployments";
import { Signer } from "ethers";
import { eContractid, tEthereumAddress, BendPools } from "../helpers/types";
import { MintableERC20 } from "../types/MintableERC20";
import { MintableERC721 } from "../types/MintableERC721";
import { ConfigNames, getReserveFactorCollectorAddress, loadPoolConfig } from "../helpers/configuration";
import { initializeMakeSuite } from "./helpers/make-suite";

import {
  setAggregatorsInReserveOracle,
  addAssetsInNFTOracle,
  setPricesInNFTOracle,
  deployAllChainlinkMockAggregators,
  deployChainlinkMockAggregator,
} from "../helpers/oracles-helpers";
import { DRE, waitForTx } from "../helpers/misc-utils";
import {
  initReservesByHelper,
  configureReservesByHelper,
  initNftsByHelper,
  configureNftsByHelper,
} from "../helpers/init-helpers";
import BendConfig from "../markets/bend";
import {
  getSecondSigner,
  getDeploySigner,
  getPoolAdminSigner,
  getEmergencyAdminSigner,
  getLendPool,
  getLendPoolConfiguratorProxy,
  getLendPoolLoanProxy,
  getBNFTRegistryProxy,
  getCryptoPunksMarket,
  getWrappedPunk,
  getWETHGateway,
  getPunkGateway,
} from "../helpers/contracts-getters";
import { WETH9Mocked } from "../types/WETH9Mocked";
import { getNftAddressFromSymbol } from "./helpers/utils/helpers";
import { WrappedPunk } from "../types/WrappedPunk";
import { ADDRESS_ID_PUNK_GATEWAY, ADDRESS_ID_WETH_GATEWAY } from "../helpers/constants";
import { WETH9 } from "../types";

const MOCK_USD_PRICE = BendConfig.ProtocolGlobalParams.MockUsdPrice;
const ALL_ASSETS_INITIAL_PRICES = BendConfig.Mocks.AllAssetsInitialPrices;
const USD_ADDRESS = BendConfig.ProtocolGlobalParams.UsdAddress;

const ALL_NFTS_INITIAL_PRICES = BendConfig.Mocks.AllNftsInitialPrices;

const buildTestEnv = async (deployer: Signer, secondaryWallet: Signer) => {
  console.time("setup");

  const poolAdmin = await (await getPoolAdminSigner()).getAddress();
  const emergencyAdmin = await (await getEmergencyAdminSigner()).getAddress();
  console.log("Admin accounts:", "poolAdmin:", poolAdmin, "emergencyAdmin:", emergencyAdmin);

  const config = loadPoolConfig(ConfigNames.Bend);

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare mock external ERC20 Tokens, such as WETH, DAI...");
  const mockTokens: {
    [symbol: string]: MockContract | MintableERC20 | WETH9Mocked | WETH9;
  } = {
    ...(await deployAllMockTokens(true)),
  };

  console.log("-> Prepare mock external ERC721 NFTs, such as WPUNKS, BAYC...");
  const mockNfts: {
    [symbol: string]: MockContract | MintableERC721 | WrappedPunk;
  } = {
    ...(await deployAllMockNfts(false)),
  };
  const cryptoPunksMarket = await getCryptoPunksMarket();
  await waitForTx(await cryptoPunksMarket.allInitialOwnersAssigned());
  const wrappedPunk = await getWrappedPunk();

  console.log("-> Prepare mock external IncentivesController...");
  const mockIncentivesController = await deployMockIncentivesController();
  const incentivesControllerAddress = mockIncentivesController.address;

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare proxy admin...");
  const bendProxyAdmin = await deployBendProxyAdmin(eContractid.BendProxyAdminTest);
  console.log("bendProxyAdmin:", bendProxyAdmin.address);

  //////////////////////////////////////////////////////////////////////////////
  // !!! MUST BEFORE LendPoolConfigurator which will getBNFTRegistry from address provider when init
  console.log("-> Prepare mock bnft registry...");
  const bnftGenericImpl = await deployGenericBNFTImpl(false);

  const bnftRegistryImpl = await deployBNFTRegistry();
  const initEncodedData = bnftRegistryImpl.interface.encodeFunctionData("initialize", [
    bnftGenericImpl.address,
    config.Mocks.BNftNamePrefix,
    config.Mocks.BNftSymbolPrefix,
  ]);

  const bnftRegistryProxy = await deployBendUpgradeableProxy(
    eContractid.BNFTRegistry,
    bendProxyAdmin.address,
    bnftRegistryImpl.address,
    initEncodedData
  );

  const bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxy.address);

  await waitForTx(await bnftRegistry.transferOwnership(poolAdmin));

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare mock bnft tokens...");
  for (const [nftSymbol, mockedNft] of Object.entries(mockNfts) as [string, MintableERC721][]) {
    await waitForTx(await bnftRegistry.createBNFT(mockedNft.address));
    const bnftAddresses = await bnftRegistry.getBNFTAddresses(mockedNft.address);
    console.log("createBNFT:", nftSymbol, bnftAddresses.bNftProxy, bnftAddresses.bNftImpl);
  }

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare address provider...");
  const addressesProviderRegistry = await deployLendPoolAddressesProviderRegistry();

  const addressesProvider = await deployLendPoolAddressesProvider(BendConfig.MarketId);
  await waitForTx(await addressesProvider.setPoolAdmin(poolAdmin));
  await waitForTx(await addressesProvider.setEmergencyAdmin(emergencyAdmin));

  await waitForTx(
    await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, BendConfig.ProviderId)
  );

  //////////////////////////////////////////////////////////////////////////////
  // !!! MUST BEFORE LendPoolConfigurator which will getBNFTRegistry from address provider when init
  await waitForTx(await addressesProvider.setBNFTRegistry(bnftRegistry.address));
  await waitForTx(await addressesProvider.setIncentivesController(incentivesControllerAddress));

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare bend libraries...");
  await deployBendLibraries();

  console.log("-> Prepare lend pool...");
  const lendPoolImpl = await deployLendPool();
  await waitForTx(await addressesProvider.setLendPoolImpl(lendPoolImpl.address, []));
  // configurator will create proxy for implement
  const lendPoolAddress = await addressesProvider.getLendPool();
  const lendPoolProxy = await getLendPool(lendPoolAddress);

  await insertContractAddressInDb(eContractid.LendPool, lendPoolProxy.address);

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare lend pool loan...");
  const lendPoolLoanImpl = await deployLendPoolLoan();
  await waitForTx(await addressesProvider.setLendPoolLoanImpl(lendPoolLoanImpl.address, []));
  // configurator will create proxy for implement
  const lendPoolLoanProxy = await getLendPoolLoanProxy(await addressesProvider.getLendPoolLoan());
  await insertContractAddressInDb(eContractid.LendPoolLoan, lendPoolLoanProxy.address);

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare pool configurator...");
  const lendPoolConfiguratorImpl = await deployLendPoolConfigurator();
  await waitForTx(await addressesProvider.setLendPoolConfiguratorImpl(lendPoolConfiguratorImpl.address, []));
  // configurator will create proxy for implement
  const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
    await addressesProvider.getLendPoolConfigurator()
  );
  await insertContractAddressInDb(eContractid.LendPoolConfigurator, lendPoolConfiguratorProxy.address);

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare mock reserve token aggregators...");
  const allTokenDecimals = Object.entries(config.ReservesConfig).reduce(
    (accum: { [tokenSymbol: string]: string }, [tokenSymbol, tokenConfig]) => ({
      ...accum,
      [tokenSymbol]: tokenConfig.reserveDecimals,
    }),
    {}
  );
  const mockAggregators = await deployAllChainlinkMockAggregators(allTokenDecimals, ALL_ASSETS_INITIAL_PRICES);
  const usdMockAggregator = await deployChainlinkMockAggregator("USD", "8", MOCK_USD_PRICE);
  const allTokenAddresses = Object.entries(mockTokens).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {
      USD: USD_ADDRESS,
    }
  );
  const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
      ...accum,
      [tokenSymbol]: aggregator.address,
    }),
    {
      USD: usdMockAggregator.address,
    }
  );
  await deployMockChainlinkOracle("18", false); // Dummy aggregator for test

  console.log("-> Prepare reserve oracle...");
  const reserveOracleImpl = await deployReserveOracle([
    //mockTokens.WETH.address
  ]);
  await waitForTx(await reserveOracleImpl.initialize(mockTokens.WETH.address));
  await waitForTx(await addressesProvider.setReserveOracle(reserveOracleImpl.address));
  await setAggregatorsInReserveOracle(allTokenAddresses, allAggregatorsAddresses, reserveOracleImpl);

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare mock reserve oracle...");
  const mockReserveOracleImpl = await deployMockReserveOracle([]);
  await waitForTx(await mockReserveOracleImpl.initialize(mockTokens.WETH.address));

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare mock NFT token aggregators...");
  const allNftAddresses = Object.entries(mockNfts).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {}
  );
  const allNftPrices = Object.entries(ALL_NFTS_INITIAL_PRICES).reduce(
    (accum: { [tokenSymbol: string]: string }, [tokenSymbol, tokenPrice]) => ({
      ...accum,
      [tokenSymbol]: tokenPrice,
    }),
    {}
  );

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare nft oracle...");
  const nftOracleImpl = await deployNFTOracle();
  await waitForTx(
    await nftOracleImpl.initialize(
      await addressesProvider.getPoolAdmin(),
      "20000000000000000000",
      "10000000000000000000",
      1,
      1,
      100
    )
  );
  await waitForTx(await addressesProvider.setNFTOracle(nftOracleImpl.address));
  await addAssetsInNFTOracle(allNftAddresses, nftOracleImpl);
  await setPricesInNFTOracle(allNftPrices, allNftAddresses, nftOracleImpl);

  console.log("-> Prepare mock nft oracle...");
  const mockNftOracleImpl = await deployMockNFTOracle();
  await waitForTx(
    await mockNftOracleImpl.initialize(
      await addressesProvider.getPoolAdmin(),
      "20000000000000000000",
      "10000000000000000000",
      1,
      1,
      100
    )
  );

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare Reserve pool...");
  const { ...tokensAddressesWithoutUsd } = allTokenAddresses;
  const allReservesAddresses = {
    ...tokensAddressesWithoutUsd,
  };

  // Reserve params from pool + mocked tokens
  const reservesParams = {
    ...config.ReservesConfig,
  };

  console.log("-> Prepare BToken impl contract...");
  await deployBTokenImplementations(ConfigNames.Bend, reservesParams, false);

  console.log("-> Prepare Reserve init and configure...");
  const { BTokenNamePrefix, BTokenSymbolPrefix, DebtTokenNamePrefix, DebtTokenSymbolPrefix } = config;
  const collectorAddress = await getReserveFactorCollectorAddress(config);

  await initReservesByHelper(
    reservesParams,
    allReservesAddresses,
    BTokenNamePrefix,
    BTokenSymbolPrefix,
    DebtTokenNamePrefix,
    DebtTokenSymbolPrefix,
    poolAdmin,
    collectorAddress,
    ConfigNames.Bend,
    false
  );

  await configureReservesByHelper(reservesParams, allReservesAddresses, poolAdmin);

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare NFT pools...");
  const allNftsAddresses = {
    ...allNftAddresses,
  };

  // NFT params from pool + mocked tokens
  const nftsParams = {
    ...config.NftsConfig,
  };

  console.log("-> Prepare NFT init and configure...");
  await initNftsByHelper(nftsParams, allNftsAddresses, poolAdmin, ConfigNames.Bend, false);

  await configureNftsByHelper(nftsParams, allNftsAddresses, poolAdmin);

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare wallet & data & ui provider...");
  const walletProvider = await deployWalletBalancerProvider();
  await waitForTx(await addressesProvider.setWalletBalanceProvider(walletProvider.address));

  const bendDataProvider = await deployBendProtocolDataProvider(addressesProvider.address);
  await waitForTx(await addressesProvider.setBendDataProvider(bendDataProvider.address));

  const uiDataProvider = await deployUiPoolDataProvider(reserveOracleImpl.address, nftOracleImpl.address, false);
  await waitForTx(await addressesProvider.setUIDataProvider(uiDataProvider.address));

  //////////////////////////////////////////////////////////////////////////////
  console.log("-> Prepare WETH gateway...");
  const wethGatewayImpl = await deployWETHGateway();
  const wethGwInitEncodedData = wethGatewayImpl.interface.encodeFunctionData("initialize", [
    addressesProvider.address,
    mockTokens.WETH.address,
  ]);
  const wethGatewayProxy = await deployBendUpgradeableProxy(
    eContractid.WETHGateway,
    bendProxyAdmin.address,
    wethGatewayImpl.address,
    wethGwInitEncodedData
  );
  await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_WETH_GATEWAY, wethGatewayProxy.address));
  const wethGateway = await getWETHGateway(await addressesProvider.getAddress(ADDRESS_ID_WETH_GATEWAY));
  await waitForTx(await wethGateway.authorizeLendPoolNFT([allNftsAddresses.BAYC, allNftsAddresses.WPUNKS]));
  await insertContractAddressInDb(eContractid.WETHGateway, wethGateway.address);

  console.log("-> Prepare PUNK gateway...");
  const punkGatewayImpl = await deployPunkGateway();
  const punkGwInitEncodedData = punkGatewayImpl.interface.encodeFunctionData("initialize", [
    addressesProvider.address,
    wethGateway.address,
    cryptoPunksMarket.address,
    wrappedPunk.address,
  ]);
  const punkGatewayProxy = await deployBendUpgradeableProxy(
    eContractid.PunkGateway,
    bendProxyAdmin.address,
    punkGatewayImpl.address,
    punkGwInitEncodedData
  );
  await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_PUNK_GATEWAY, punkGatewayProxy.address));
  const punkGateway = await getPunkGateway(await addressesProvider.getAddress(ADDRESS_ID_PUNK_GATEWAY));
  await waitForTx(
    await punkGateway.authorizeLendPoolERC20([
      allReservesAddresses.WETH,
      allReservesAddresses.DAI,
      allReservesAddresses.USDC,
    ])
  );
  await insertContractAddressInDb(eContractid.PunkGateway, punkGateway.address);

  await waitForTx(await wethGateway.authorizeCallerWhitelist([punkGateway.address], true));

  console.timeEnd("setup");
};

before(async () => {
  await rawBRE.run("set-DRE");
  const deployer = await getDeploySigner();
  const secondaryWallet = await getSecondSigner();
  const FORK = process.env.FORK;

  if (FORK) {
    await rawBRE.run("bend:mainnet", { skipRegistry: true });
  } else {
    console.log("-> Deploying test environment...");
    await buildTestEnv(deployer, secondaryWallet);
  }

  console.log("-> Initialize make suite...");
  await initializeMakeSuite();

  console.log("\n***************");
  console.log("Setup and snapshot finished");
  console.log("***************\n");
});

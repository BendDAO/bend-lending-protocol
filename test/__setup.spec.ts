import rawBRE from "hardhat";
import { MockContract } from "ethereum-waffle";
import {
  insertContractAddressInDb,
  getEthersSigners,
  registerContractInJsonDb,
  getEthersSignersAddresses,
} from "../helpers/contracts-helpers";
import {
  deployLendPoolAddressesProvider,
  deployMintableERC20,
  deployMintableERC721,
  deployBTokenImplementations,
  deployBNFTImplementations,
  deployLendPoolConfigurator,
  deployLendPool,
  deployBTokensAndRatesHelper,
  deployMockReserveOracle,
  deployMockNFTOracle,
  deployReserveOracle,
  deployNFTOracle,
  deployWalletBalancerProvider,
  deployBendProtocolDataProvider,
  deployWETHGateway,
  deployWETHMocked,
  authorizeWETHGateway,
} from "../helpers/contracts-deployments";
import { Signer } from "ethers";
import {
  TokenContractId,
  NftContractId,
  eContractid,
  tEthereumAddress,
  BendPools,
} from "../helpers/types";
import { MintableERC20 } from "../types/MintableERC20";
import { MintableERC721 } from "../types/MintableERC721";
import {
  ConfigNames,
  getReservesConfigByPool,
  getNftsConfigByPool,
  getTreasuryAddress,
  loadPoolConfig,
} from "../helpers/configuration";
import { initializeMakeSuite } from "./helpers/make-suite";

import {
  setInitialAssetPricesInOracle,
  setReserveAggregatorsInOracle,
  setNftAggregatorsInOracle,
  deployAllMockReserveAggregators,
  deployAllMockNftAggregators,
} from "../helpers/oracles-helpers";
import { DRE, waitForTx } from "../helpers/misc-utils";
import {
  initReservesByHelper,
  configureReservesByHelper,
  initNftsByHelper,
  configureNftsByHelper,
} from "../helpers/init-helpers";
import BendConfig from "../markets/bend";
import { oneEther, ZERO_ADDRESS } from "../helpers/constants";
import {
  getLendPool,
  getLendPoolConfiguratorProxy,
  getPairsTokenAggregator,
} from "../helpers/contracts-getters";
import { WETH9Mocked } from "../types/WETH9Mocked";

const MOCK_USD_PRICE_IN_WEI = BendConfig.ProtocolGlobalParams.MockUsdPriceInWei;
const ALL_ASSETS_INITIAL_PRICES = BendConfig.Mocks.AllAssetsInitialPrices;
const USD_ADDRESS = BendConfig.ProtocolGlobalParams.UsdAddress;

const ALL_NFTS_INITIAL_PRICES = BendConfig.Mocks.AllNftsInitialPrices;

const deployAllMockTokens = async (deployer: Signer) => {
  const tokens: {
    [symbol: string]: MockContract | MintableERC20 | WETH9Mocked;
  } = {};

  const protoConfigData = getReservesConfigByPool(BendPools.proto);

  for (const tokenSymbol of Object.keys(TokenContractId)) {
    if (tokenSymbol === "WETH") {
      tokens[tokenSymbol] = await deployWETHMocked();
      await registerContractInJsonDb(
        tokenSymbol.toUpperCase(),
        tokens[tokenSymbol]
      );
      continue;
    }
    let decimals = 18;

    let configData = (<any>protoConfigData)[tokenSymbol];

    if (!configData) {
      decimals = 18;
    }

    tokens[tokenSymbol] = await deployMintableERC20([
      tokenSymbol,
      tokenSymbol,
      configData ? configData.reserveDecimals : 18,
    ]);
    await registerContractInJsonDb(
      tokenSymbol.toUpperCase(),
      tokens[tokenSymbol]
    );
  }

  return tokens;
};

const deployAllMockNfts = async (deployer: Signer) => {
  const tokens: {
    [symbol: string]: MockContract | MintableERC721;
  } = {};

  const protoConfigData = getNftsConfigByPool(BendPools.proto);

  for (const tokenSymbol of Object.keys(NftContractId)) {
    /*
    if (tokenSymbol === "WETH") {
      tokens[tokenSymbol] = await deployWETHMocked();
      await registerContractInJsonDb(
        tokenSymbol.toUpperCase(),
        tokens[tokenSymbol]
      );
      continue;
    }
    */

    let configData = (<any>protoConfigData)[tokenSymbol];

    tokens[tokenSymbol] = await deployMintableERC721([
      tokenSymbol,
      tokenSymbol,
    ]);
    await registerContractInJsonDb(
      tokenSymbol.toUpperCase(),
      tokens[tokenSymbol]
    );
  }

  return tokens;
};

const buildTestEnv = async (deployer: Signer, secondaryWallet: Signer) => {
  console.time("setup");
  const bendAdmin = await deployer.getAddress();
  const config = loadPoolConfig(ConfigNames.Bend);

  //////////////////////////////////////////////////////////////////////////////
  // prepare mock ERC20 Tokens
  const mockTokens: {
    [symbol: string]: MockContract | MintableERC20 | WETH9Mocked;
  } = {
    ...(await deployAllMockTokens(deployer)),
  };

  // prepare mock ERC721 NFTs
  const mockNfts: {
    [symbol: string]: MockContract | MintableERC721;
  } = {
    ...(await deployAllMockNfts(deployer)),
  };

  //////////////////////////////////////////////////////////////////////////////
  // prepare address provider
  const addressesProvider = await deployLendPoolAddressesProvider(
    BendConfig.MarketId
  );
  await waitForTx(await addressesProvider.setPoolAdmin(bendAdmin));

  //setting users[1] as emergency admin, which is in position 2 in the DRE addresses list
  const addressList = await getEthersSignersAddresses();

  await waitForTx(await addressesProvider.setEmergencyAdmin(addressList[2]));

  //////////////////////////////////////////////////////////////////////////////
  // prepare lend pool
  const lendPoolImpl = await deployLendPool();
  await waitForTx(
    await addressesProvider.setLendPoolImpl(lendPoolImpl.address)
  );

  const lendPoolAddress = await addressesProvider.getLendPool();
  const lendPoolProxy = await getLendPool(lendPoolAddress);

  await insertContractAddressInDb(eContractid.LendPool, lendPoolProxy.address);

  //////////////////////////////////////////////////////////////////////////////
  // prepare pool configurator
  const lendPoolConfiguratorImpl = await deployLendPoolConfigurator();
  await waitForTx(
    await addressesProvider.setLendPoolConfiguratorImpl(
      lendPoolConfiguratorImpl.address
    )
  );
  const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
    await addressesProvider.getLendPoolConfigurator()
  );
  await insertContractAddressInDb(
    eContractid.LendPoolConfigurator,
    lendPoolConfiguratorProxy.address
  );

  //////////////////////////////////////////////////////////////////////////////
  // prepare token and rate helper
  await deployBTokensAndRatesHelper([
    lendPoolProxy.address,
    addressesProvider.address,
    lendPoolConfiguratorProxy.address,
  ]);
  /*
  // prepare mock reservable oracle
  const mockReserveOracle = await deployMockReserveOracle();
  await setInitialAssetPricesInOracle(
    ALL_ASSETS_INITIAL_PRICES,
    {
      WETH: mockTokens.WETH.address,
      DAI: mockTokens.DAI.address,
      //USDC: mockTokens.USDC.address,
      //USDT: mockTokens.USDT.address,
      //BUSD: mockTokens.BUSD.address,
    },
    mockReserveOracle
  );

  // prepare mock nft oracle
  const mockNFTOracle = await deployMockNFTOracle();
*/
  //////////////////////////////////////////////////////////////////////////////
  // prepare mock ERC20 token chainlink aggregators
  const mockAggregators = await deployAllMockReserveAggregators(
    ALL_ASSETS_INITIAL_PRICES
  );
  const allTokenAddresses = Object.entries(mockTokens).reduce(
    (
      accum: { [tokenSymbol: string]: tEthereumAddress },
      [tokenSymbol, tokenContract]
    ) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {}
  );
  const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
    (
      accum: { [tokenSymbol: string]: tEthereumAddress },
      [tokenSymbol, aggregator]
    ) => ({
      ...accum,
      [tokenSymbol]: aggregator.address,
    }),
    {}
  );
  const [tokens, aggregators] = getPairsTokenAggregator(
    allTokenAddresses,
    allAggregatorsAddresses,
    config.OracleQuoteCurrency
  );

  // prepare reserve oracle
  const reserveOracleImpl = await deployReserveOracle([
    //mockTokens.WETH.address
  ]);
  reserveOracleImpl.initialize(
    rawBRE.ethers.utils.zeroPad(
      rawBRE.ethers.utils.arrayify(mockTokens.WETH.address),
      32
    )
  );
  await waitForTx(
    await addressesProvider.setReserveOracle(reserveOracleImpl.address)
  );
  await setReserveAggregatorsInOracle(
    allTokenAddresses,
    allAggregatorsAddresses,
    reserveOracleImpl
  );

  //////////////////////////////////////////////////////////////////////////////
  // prepare mock ERC721 token chainlink aggregators
  const mockNftAggregators = await deployAllMockNftAggregators(
    ALL_NFTS_INITIAL_PRICES
  );
  const allNftAddresses = Object.entries(mockNfts).reduce(
    (
      accum: { [tokenSymbol: string]: tEthereumAddress },
      [tokenSymbol, tokenContract]
    ) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {}
  );
  const allNftAggregatorsAddresses = Object.entries(mockNftAggregators).reduce(
    (
      accum: { [tokenSymbol: string]: tEthereumAddress },
      [tokenSymbol, aggregator]
    ) => ({
      ...accum,
      [tokenSymbol]: aggregator.address,
    }),
    {}
  );
  const [nftTokens, nftAggregators] = getPairsTokenAggregator(
    allNftAddresses,
    allNftAggregatorsAddresses,
    config.OracleQuoteCurrency
  );

  // prepare nft oracle
  const nftOracleImpl = await deployNFTOracle();
  await waitForTx(await addressesProvider.setNFTOracle(nftOracleImpl.address));
  await setNftAggregatorsInOracle(
    allNftAddresses,
    allNftAggregatorsAddresses,
    nftOracleImpl
  );

  const testHelpers = await deployBendProtocolDataProvider(
    addressesProvider.address
  );

  const admin = await deployer.getAddress();

  //////////////////////////////////////////////////////////////////////////////
  // prepare reserve pool
  const { ...tokensAddressesWithoutUsd } = allTokenAddresses;
  const allReservesAddresses = {
    ...tokensAddressesWithoutUsd,
  };

  // Reserve params from pool + mocked tokens
  const reservesParams = {
    ...config.ReservesConfig,
  };

  // prepare BToken impl contract
  await deployBTokenImplementations(ConfigNames.Bend, reservesParams, false);

  const { BTokenNamePrefix, BTokenSymbolPrefix } = config;
  const treasuryAddress = await getTreasuryAddress(config);

  await initReservesByHelper(
    reservesParams,
    allReservesAddresses,
    BTokenNamePrefix,
    BTokenSymbolPrefix,
    admin,
    treasuryAddress,
    ZERO_ADDRESS,
    ConfigNames.Bend,
    false
  );

  await configureReservesByHelper(
    reservesParams,
    allReservesAddresses,
    testHelpers,
    admin
  );

  //////////////////////////////////////////////////////////////////////////////
  // prepare nft pools
  // prepare reserve pool
  const allNftsAddresses = {
    ...allNftAddresses,
  };

  // NFT params from pool + mocked tokens
  const nftsParams = {
    ...config.NftsConfig,
  };

  // prepare BNFT impl contract
  await deployBNFTImplementations(ConfigNames.Bend, nftsParams, false);

  const { BNftNamePrefix, BNftSymbolPrefix } = config;

  await initNftsByHelper(
    nftsParams,
    allNftsAddresses,
    BNftNamePrefix,
    BNftSymbolPrefix,
    admin,
    ConfigNames.Bend,
    false
  );

  await configureNftsByHelper(nftsParams, allNftsAddresses, testHelpers, admin);

  //////////////////////////////////////////////////////////////////////////////
  // prepapre wallet
  await deployWalletBalancerProvider();

  //////////////////////////////////////////////////////////////////////////////
  // prepare WETH gateway
  //const gateWay = await deployWETHGateway([mockTokens.WETH.address]);
  //await authorizeWETHGateway(gateWay.address, lendPoolAddress);

  console.timeEnd("setup");
};

before(async () => {
  await rawBRE.run("set-DRE");
  const [deployer, secondaryWallet] = await getEthersSigners();
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

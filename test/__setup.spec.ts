import rawBRE from 'hardhat';
import { MockContract } from 'ethereum-waffle';
import {
  insertContractAddressInDb,
  getEthersSigners,
  registerContractInJsonDb,
  getEthersSignersAddresses,
} from '../helpers/contracts-helpers';
import {
  deployLendPoolAddressesProvider,
  deployMintableERC20,
  deployMintableERC721,
  deployBTokenImplementations,
  deployBNFTImplementations,
  deployLendPoolConfigurator,
  deployLendPool,
  deployLendPoolLoan,
  deployBTokensAndBNFTsHelper,
  deployBendOracle,
  deployReserveOracle,
  deployNFTOracle,
  deployWalletBalancerProvider,
  deployBendProtocolDataProvider,
  deployWETHGateway,
  deployWETHMocked,
  authorizeWETHGateway,
  deployBNFTRegistry,
} from '../helpers/contracts-deployments';
import { Signer } from 'ethers';
import {
  TokenContractId,
  NftContractId,
  eContractid,
  tEthereumAddress,
  BendPools,
} from '../helpers/types';
import { MintableERC20 } from '../types/MintableERC20';
import { MintableERC721 } from '../types/MintableERC721';
import {
  ConfigNames,
  getReservesConfigByPool,
  getNftsConfigByPool,
  getTreasuryAddress,
  loadPoolConfig,
} from '../helpers/configuration';
import { initializeMakeSuite } from './helpers/make-suite';

import {
  setAssetContractsInBendOracle,
  setPricesInChainlinkMockAggregator,
  setAggregatorsInReserveOracle,
  addAssetsInNFTOracle,
  setPricesInNFTOracle,
  deployAllChainlinkMockAggregators,
} from '../helpers/oracles-helpers';
import { DRE, waitForTx } from '../helpers/misc-utils';
import {
  initReservesByHelper,
  configureReservesByHelper,
  initNftsByHelper,
  configureNftsByHelper,
} from '../helpers/init-helpers';
import BendConfig from '../markets/bend';
import { oneEther, ZERO_ADDRESS } from '../helpers/constants';
import {
  getLendPool,
  getLendPoolConfiguratorProxy,
  getLendPoolLoanProxy,
  getBNFTRegistryProxy,
  getPairsTokenAggregator,
} from '../helpers/contracts-getters';
import { WETH9Mocked } from '../types/WETH9Mocked';

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
    if (tokenSymbol === 'WETH') {
      tokens[tokenSymbol] = await deployWETHMocked();
      await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
      continue;
    }
    let decimals = 18;

    let configData = (<any>protoConfigData)[tokenSymbol];

    if (configData) {
      decimals = configData.reserveDecimals;
    }

    tokens[tokenSymbol] = await deployMintableERC20([
      tokenSymbol,
      tokenSymbol,
      decimals.toString(),
    ]);
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
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
    if (tokenSymbol === "WPUNKS") {
      tokens[tokenSymbol] = await deployWPUNKSMocked();
      await registerContractInJsonDb(
        tokenSymbol.toUpperCase(),
        tokens[tokenSymbol]
      );
      continue;
    }
    */

    let configData = (<any>protoConfigData)[tokenSymbol];

    tokens[tokenSymbol] = await deployMintableERC721([tokenSymbol, tokenSymbol]);
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }

  return tokens;
};

const buildTestEnv = async (deployer: Signer, secondaryWallet: Signer) => {
  console.time('setup');
  const bendAdmin = await deployer.getAddress();
  const config = loadPoolConfig(ConfigNames.Bend);

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare mock external ERC20 Tokens, such as WETH, DAI...');
  const mockTokens: {
    [symbol: string]: MockContract | MintableERC20 | WETH9Mocked;
  } = {
    ...(await deployAllMockTokens(deployer)),
  };

  console.log('-> Prepare mock external ERC721 NFTs, such as WPUNKS, BAYC...');
  const mockNfts: {
    [symbol: string]: MockContract | MintableERC721;
  } = {
    ...(await deployAllMockNfts(deployer)),
  };

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare address provider...');
  const addressesProvider = await deployLendPoolAddressesProvider(BendConfig.MarketId);
  await waitForTx(await addressesProvider.setPoolAdmin(bendAdmin));

  //setting users[1] as emergency admin, which is in position 2 in the DRE addresses list
  const addressList = await getEthersSignersAddresses();

  await waitForTx(await addressesProvider.setEmergencyAdmin(addressList[2]));

  //////////////////////////////////////////////////////////////////////////////
  // !!! MUST BEFORE LendPoolConfigurator which will getBNFTRegistry from address provider when init
  console.log('-> Prepare bnft registry...');
  const bnftRegistryImpl = await deployBNFTRegistry([
    config.BNftNamePrefix,
    config.BNftSymbolPrefix,
  ]);
  await waitForTx(await bnftRegistryImpl.transferOwnership(await deployer.getAddress()));
  await waitForTx(await addressesProvider.setBNFTRegistry(await bnftRegistryImpl.address));
  /* no need proxy, just use implement is enough
  const bnftRegistryProxy = await getBNFTRegistryProxy(
    await addressesProvider.getBNFTRegistry()
  );
  await insertContractAddressInDb(
    eContractid.BNFTRegistry,
    bnftRegistryProxy.address
  );
  */

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare lend pool...');
  const lendPoolImpl = await deployLendPool();
  await waitForTx(await addressesProvider.setLendPoolImpl(lendPoolImpl.address));
  // configurator will create proxy for implement
  const lendPoolAddress = await addressesProvider.getLendPool();
  const lendPoolProxy = await getLendPool(lendPoolAddress);

  await insertContractAddressInDb(eContractid.LendPool, lendPoolProxy.address);

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare lend loan...');
  const lendPoolLoanImpl = await deployLendPoolLoan();
  await waitForTx(await addressesProvider.setLendPoolLoanImpl(lendPoolLoanImpl.address));
  // configurator will create proxy for implement
  const lendPoolLoanProxy = await getLendPoolLoanProxy(await addressesProvider.getLendPoolLoan());
  await insertContractAddressInDb(eContractid.LendPoolLoan, lendPoolLoanProxy.address);

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare pool configurator...');
  const lendPoolConfiguratorImpl = await deployLendPoolConfigurator();
  await waitForTx(
    await addressesProvider.setLendPoolConfiguratorImpl(lendPoolConfiguratorImpl.address)
  );
  // configurator will create proxy for implement
  const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
    await addressesProvider.getLendPoolConfigurator()
  );
  await insertContractAddressInDb(
    eContractid.LendPoolConfigurator,
    lendPoolConfiguratorProxy.address
  );

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare token and rate helper...');
  await deployBTokensAndBNFTsHelper([
    lendPoolProxy.address,
    addressesProvider.address,
    lendPoolConfiguratorProxy.address,
  ]);

  const dataProvider = await deployBendProtocolDataProvider(addressesProvider.address);

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare mock reserve token aggregators...');
  const allTokenDecimals = Object.entries(config.ReservesConfig).reduce(
    (accum: { [tokenSymbol: string]: string }, [tokenSymbol, tokenConfig]) => ({
      ...accum,
      [tokenSymbol]: tokenConfig.reserveDecimals,
    }),
    {}
  );
  const mockAggregators = await deployAllChainlinkMockAggregators(
    allTokenDecimals,
    ALL_ASSETS_INITIAL_PRICES
  );
  const allTokenAddresses = Object.entries(mockTokens).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {}
  );
  const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
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

  console.log('-> Prepare reserve oracle...');
  const reserveOracleImpl = await deployReserveOracle([
    //mockTokens.WETH.address
  ]);
  await waitForTx(await reserveOracleImpl.initialize(mockTokens.WETH.address));
  await waitForTx(await addressesProvider.setReserveOracle(reserveOracleImpl.address));
  await setAggregatorsInReserveOracle(
    allTokenAddresses,
    allAggregatorsAddresses,
    reserveOracleImpl
  );

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare mock NFT token aggregators...');
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

  console.log('-> Prepare nft oracle...');
  const nftOracleImpl = await deployNFTOracle();
  await waitForTx(await nftOracleImpl.initialize(await addressesProvider.getPoolAdmin()));
  await waitForTx(await addressesProvider.setNFTOracle(nftOracleImpl.address));
  await addAssetsInNFTOracle(allNftAddresses, nftOracleImpl);
  await setPricesInNFTOracle(allNftPrices, allNftAddresses, nftOracleImpl);

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare bend oracle...');
  const bendOracleImpl = await deployBendOracle();
  await waitForTx(await bendOracleImpl.initialize());
  await setAssetContractsInBendOracle(allTokenAddresses, reserveOracleImpl.address, bendOracleImpl);
  await setAssetContractsInBendOracle(allNftAddresses, nftOracleImpl.address, bendOracleImpl);

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare Reserve pool...');
  const { ...tokensAddressesWithoutUsd } = allTokenAddresses;
  const allReservesAddresses = {
    ...tokensAddressesWithoutUsd,
  };

  // Reserve params from pool + mocked tokens
  const reservesParams = {
    ...config.ReservesConfig,
  };

  console.log('-> Prepare BToken impl contract...');
  await deployBTokenImplementations(ConfigNames.Bend, reservesParams, false);

  console.log('-> Prepare Reserve init and configure...');
  const { BTokenNamePrefix, BTokenSymbolPrefix } = config;
  const treasuryAddress = await getTreasuryAddress(config);

  await initReservesByHelper(
    reservesParams,
    allReservesAddresses,
    BTokenNamePrefix,
    BTokenSymbolPrefix,
    bendAdmin,
    treasuryAddress,
    ZERO_ADDRESS,
    ConfigNames.Bend,
    false
  );

  await configureReservesByHelper(reservesParams, allReservesAddresses, dataProvider, bendAdmin);

  //////////////////////////////////////////////////////////////////////////////
  console.log('-> Prepare NFT pools...');
  const allNftsAddresses = {
    ...allNftAddresses,
  };

  // NFT params from pool + mocked tokens
  const nftsParams = {
    ...config.NftsConfig,
  };

  console.log('-> Prepare BNFT impl contract...');
  await deployBNFTImplementations(ConfigNames.Bend, nftsParams, false);

  console.log('-> Prepare NFT init and configure...');
  const { BNftNamePrefix, BNftSymbolPrefix } = config;

  await initNftsByHelper(
    nftsParams,
    allNftsAddresses,
    BNftNamePrefix,
    BNftSymbolPrefix,
    bendAdmin,
    ConfigNames.Bend,
    false
  );

  await configureNftsByHelper(nftsParams, allNftsAddresses, dataProvider, bendAdmin);

  //////////////////////////////////////////////////////////////////////////////
  // prepapre wallet
  await deployWalletBalancerProvider();

  //////////////////////////////////////////////////////////////////////////////
  //console.log("-> Prepare WETH gateway...");
  //const wethGateway = await deployWETHGateway([mockTokens.WETH.address]);
  //await authorizeWETHGateway(wethGateway.address, lendPoolAddress);

  //console.log("-> Prepare PUNK gateway...");
  //const punkGateway = await deployWPUNKSGateway([mockNFTs.WPUNKS.address]);
  //await authorizePunkGateway(punkGateWay.address, lendPoolAddress);

  console.timeEnd('setup');
};

before(async () => {
  await rawBRE.run('set-DRE');
  const [deployer, secondaryWallet] = await getEthersSigners();
  const FORK = process.env.FORK;

  if (FORK) {
    await rawBRE.run('bend:mainnet', { skipRegistry: true });
  } else {
    console.log('-> Deploying test environment...');
    await buildTestEnv(deployer, secondaryWallet);
  }

  console.log('-> Initialize make suite...');
  await initializeMakeSuite();

  console.log('\n***************');
  console.log('Setup and snapshot finished');
  console.log('***************\n');
});

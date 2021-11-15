import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from "../../helpers/configuration";
import { MOCK_NFT_AGGREGATORS_PRICES } from "../../helpers/constants";
import { deployBNFTRegistry, deployGenericBNFTImpl, deployLendPool } from "../../helpers/contracts-deployments";
import {
  getBendProtocolDataProvider,
  getBendProxyAdminByAddress,
  getBNFTRegistryProxy,
  getFirstSigner,
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
  getMintableERC721,
  getNFTOracle,
  getUIPoolDataProvider,
  getWalletProvider,
  getWETHGateway,
} from "../../helpers/contracts-getters";
import { getEthersSigners, getParamPerNetwork, verifyContract } from "../../helpers/contracts-helpers";
import { getNowTimeInSeconds, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork, PoolConfiguration } from "../../helpers/types";
import { LendPoolAddressesProvider, MintableERC721Factory } from "../../types";

task("dev:custom-task", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    //await printUISimpleData(addressesProvider);
    //await printWalletBatchToken();
  });

const dummyFunction = async (addressesProvider: LendPoolAddressesProvider) => {};

const lendPoolUnpause = async (
  DRE: HardhatRuntimeEnvironment,
  network: eNetwork,
  poolConfig: PoolConfiguration,
  addressesProvider: LendPoolAddressesProvider
) => {
  const emAdmin = await DRE.ethers.getSigner(await getEmergencyAdmin(poolConfig));

  const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
    await addressesProvider.getLendPoolConfigurator()
  );

  const lendPoolProxy = await getLendPool(await addressesProvider.getLendPool());

  await waitForTx(await lendPoolConfiguratorProxy.connect(emAdmin).setPoolPause(false));
  console.log("LendPool Pause:", await lendPoolProxy.paused());
};

const feedNftOraclePrice = async (
  network: eNetwork,
  poolConfig: PoolConfiguration,
  addressesProvider: LendPoolAddressesProvider
) => {
  const nftOracleProxy = await getNFTOracle(await addressesProvider.getNFTOracle());
  const latestTime = await getNowTimeInSeconds();
  const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);
  /*
  const mockedCoolAddress = "0xEF307D349b242b6967a75A4f19Cdb692170F1106";
  await waitForTx(await nftOracleProxy.addAsset(mockedCoolAddress));
  await waitForTx(
    await nftOracleProxy.setAssetData(mockedCoolAddress, MOCK_NFT_AGGREGATORS_PRICES["COOL"], latestTime, 1)
  );
  */
  await waitForTx(
    await nftOracleProxy.setAssetData(nftsAssets["WPUNKS"], MOCK_NFT_AGGREGATORS_PRICES["WPUNKS"], latestTime, 1)
  );
  await waitForTx(
    await nftOracleProxy.setAssetData(nftsAssets["BAYC"], MOCK_NFT_AGGREGATORS_PRICES["BAYC"], latestTime, 1)
  );
  await waitForTx(
    await nftOracleProxy.setAssetData(nftsAssets["COOL"], MOCK_NFT_AGGREGATORS_PRICES["COOL"], latestTime, 1)
  );
};

const printUISimpleData = async (addressesProvider: LendPoolAddressesProvider) => {
  const dataProvider = await getBendProtocolDataProvider();
  const uiProvider = await getUIPoolDataProvider();

  const simpleNftsData = await uiProvider.getSimpleNftsData(addressesProvider.address);
  console.log(simpleNftsData);

  const userNftData = await uiProvider.getUserNftsData(
    addressesProvider.address,
    "0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6"
  );
  console.log(userNftData);

  const simpleReservesData = await uiProvider.getSimpleReservesData(addressesProvider.address);
  console.log(simpleReservesData);

  const userReserveData = await uiProvider.getUserReservesData(
    addressesProvider.address,
    "0xafF5C36642385b6c7Aaf7585eC785aB2316b5db6"
  );
  console.log(userReserveData);
};

const createMockedCool = async () => {
  const mockedCool = await new MintableERC721Factory(await getFirstSigner()).deploy("Bend Mock COOL", "COOL");
  console.log("Deployed Mocked COOL, address:", mockedCool.address);
  await waitForTx(await mockedCool.setBaseURI("https://api.coolcatsnft.com/cat/"));
  await verifyContract(eContractid.MintableERC721, mockedCool, [await mockedCool.name(), await mockedCool.symbol()]);
};

const verifyMockedCool = async () => {
  const mockedCoolAddress = "0xEF307D349b242b6967a75A4f19Cdb692170F1106";
  const mockedCool = await getMintableERC721(mockedCoolAddress);
  await verifyContract(eContractid.MintableERC721, mockedCool, [await mockedCool.name(), await mockedCool.symbol()]);
};

const borrowETHUsingBAYC = async (addressesProvider: LendPoolAddressesProvider) => {
  const signer = await getFirstSigner();

  const wethGateway = await getWETHGateway("0xda66d66534072356EE7DCBfeB29493A925d55d95");
  const baycAddress = "0x6f9a28ACE211122CfD6f115084507b44FDBc12C7";

  const mockedCoolAddress = "0xEF307D349b242b6967a75A4f19Cdb692170F1106";
  //await waitForTx(await wethGateway.authorizeLendPoolNFT(mockedCoolAddress));

  const bayc = await getMintableERC721(baycAddress);
  //await waitForTx(await bayc.setApprovalForAll(wethGateway.address, true));
  //await waitForTx(await bayc.mint(5001));
  await waitForTx(
    await wethGateway.borrowETH("500000000000000000", bayc.address, "5001", await signer.getAddress(), "0")
  );
};

const printWalletBatchToken = async () => {
  const user0signer = await getFirstSigner();
  const user0Address = await user0signer.getAddress();
  const user = "0x8b04B42962BeCb429a4dBFb5025b66D3d7D31d27";

  const walletProvider = await getWalletProvider("0xcdAeD24a337CC35006b5CF79a7A858561686E783");
  {
    const punkIndexs = await walletProvider.batchPunkOfOwner(
      user,
      "0x6AB60B1E965d9Aa445d637Ac5034Eba605FF0b82",
      0,
      2000
    );
    console.log("batchPunkOfOwner:", punkIndexs.join(","));
  }
  {
    const tokenIds = await walletProvider.batchTokenOfOwner(
      user,
      "0x6f9a28ACE211122CfD6f115084507b44FDBc12C7",
      0,
      2000
    );
    console.log("batchTokenOfOwner(BAYC):", tokenIds.join(","));
  }
  {
    const tokenIds = await walletProvider.batchTokenOfOwnerByIndex(user, "0xEF307D349b242b6967a75A4f19Cdb692170F1106");
    console.log("batchTokenOfOwnerByIndex(COOL):", tokenIds.join(","));
  }

  {
    const tokenIds = await walletProvider.batchTokenOfOwner(
      user0Address,
      "0x42258A4ab69a6570381277d384D6F1419d765fEA",
      5000,
      2000
    );
    console.log("batchTokenOfOwner(bBAYC):", tokenIds.join(","));
  }
  {
    const tokenIds = await walletProvider.batchTokenOfOwnerByIndex(
      user0Address,
      "0x42258A4ab69a6570381277d384D6F1419d765fEA"
    );
    console.log("batchTokenOfOwnerByIndex(bBAYC):", tokenIds.join(","));
  }
};

const changeNFTOracleFeedAdmin = async (addressesProvider: LendPoolAddressesProvider) => {
  const nftOracleProxy = await getNFTOracle(await addressesProvider.getNFTOracle());

  await waitForTx(await nftOracleProxy.setPriceFeedAdmin("0x1Cd450216B4221D76A13cAd3aa8aF87F39c4Cb2c"));
  console.log("priceFeedAdmin:", await nftOracleProxy.priceFeedAdmin());
};

const upgradeLendPool1115 = async (addressesProvider: LendPoolAddressesProvider) => {
  const lendPoolProxy = await getLendPool(await addressesProvider.getLendPool());

  const lendPoolImpl = await deployLendPool(false);

  await waitForTx(await addressesProvider.setLendPoolImpl(lendPoolImpl.address));
  console.log("LendPool:", "proxy.address", lendPoolProxy.address, "implementation.address", lendPoolImpl.address);
};

const upgradeBNFTRegistry1115 = async (
  DRE: HardhatRuntimeEnvironment,
  network: eNetwork,
  poolConfig: PoolConfiguration,
  addressesProvider: LendPoolAddressesProvider
) => {
  const proxyAdminAddress = getParamPerNetwork(poolConfig.ProxyAdminBNFT, network);
  if (proxyAdminAddress == undefined) {
    throw new Error("Invalid proxy admin address");
  }
  const proxyAdminBNFT = await getBendProxyAdminByAddress(proxyAdminAddress);
  const proxyOwnerAddress = await proxyAdminBNFT.owner();

  const bnftRegistryImpl = await deployBNFTRegistry(false);
  const bnftRegistry = await getBNFTRegistryProxy(await addressesProvider.getBNFTRegistry());
  const ownerSigner = DRE.ethers.provider.getSigner(proxyOwnerAddress);
  await waitForTx(await proxyAdminBNFT.connect(ownerSigner).upgrade(bnftRegistry.address, bnftRegistryImpl.address));

  console.log(
    "BNFTRegistr:",
    "proxy.address",
    bnftRegistry.address,
    "implementation.address",
    bnftRegistryImpl.address
  );
};

const upgradeBNFT1115 = async (
  DRE: HardhatRuntimeEnvironment,
  network: eNetwork,
  poolConfig: PoolConfiguration,
  addressesProvider: LendPoolAddressesProvider
) => {
  const bnftRegistry = await getBNFTRegistryProxy(await addressesProvider.getBNFTRegistry());
  const registryOwnerAddress = await bnftRegistry.owner();

  const bnftGenericImpl = await deployGenericBNFTImpl(false);
  await waitForTx(await bnftRegistry.setBNFTGenericImpl(bnftGenericImpl.address));

  const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);
  for (const [assetSymbol, assetAddress] of Object.entries(nftsAssets) as [string, string][]) {
    const ownerSigner = DRE.ethers.provider.getSigner(registryOwnerAddress);
    await waitForTx(
      await bnftRegistry.connect(ownerSigner).upgradeBNFTWithImpl(assetAddress, bnftGenericImpl.address, [])
    );
    const { bNftProxy, bNftImpl } = await bnftRegistry.getBNFTAddresses(assetAddress);
    console.log("BNFT:", assetSymbol, "proxy.address", bNftProxy, "implementation.address", bNftImpl);
  }
};

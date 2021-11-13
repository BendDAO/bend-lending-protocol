import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from "../../helpers/configuration";
import { MOCK_NFT_AGGREGATORS_PRICES } from "../../helpers/constants";
import {
  getBendProtocolDataProvider,
  getFirstSigner,
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
  getMintableERC721,
  getNFTOracle,
  getUIPoolDataProvider,
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

    await printUISimpleData(addressesProvider);
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
  return;
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

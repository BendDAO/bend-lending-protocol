import { getAccountPath } from "@ethersproject/hdnode";
import { task } from "hardhat/config";
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from "../../helpers/configuration";
import { MOCK_NFT_AGGREGATORS_PRICES } from "../../helpers/constants";
import {
  getBendProtocolDataProvider,
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
  getNFTOracle,
  getUIPoolDataProvider,
} from "../../helpers/contracts-getters";
import { getEthersSigners, getParamPerNetwork } from "../../helpers/contracts-helpers";
import { getNowTimeInSeconds, waitForTx } from "../../helpers/misc-utils";
import { eNetwork } from "../../helpers/types";

task("custom-task", "Doing custom task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const address = await addressesProvider.getLendPool();
    const lendPoolProxy = await getLendPool(address);

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    //lend pool unpause
    /*
    const emAdmin = await DRE.ethers.getSigner(await getEmergencyAdmin(poolConfig));
    await waitForTx(await lendPoolConfiguratorProxy.connect(emAdmin).setPoolPause(false));
    console.log("LendPool Pause:", await lendPoolProxy.paused());
    */

    //feed price to nft
    /*
    const nftOracleProxy = await getNFTOracle();
    const latestTime = await getNowTimeInSeconds();
    const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);
    await waitForTx(await nftOracleProxy.setAssetData(nftsAssets["WPUNKS"], MOCK_NFT_AGGREGATORS_PRICES["WPUNKS"], latestTime, 1));
    await waitForTx(await nftOracleProxy.setAssetData(nftsAssets["BAYC"], MOCK_NFT_AGGREGATORS_PRICES["BAYC"], latestTime, 1));
    */

    const dataProvider = await getBendProtocolDataProvider();
    const uiProvider = await getUIPoolDataProvider();
    /*
    const simpleNftsData = await uiProvider.getSimpleNftsData(addressesProvider.address);
    console.log(simpleNftsData);
    const userNftData = await uiProvider.getUserNftsData(
      addressesProvider.address,
      "0x"
    );
    console.log(userNftData);
    const simpleReservesData = await uiProvider.getSimpleReservesData(addressesProvider.address);
    console.log(simpleReservesData);
    */
  });

import { task } from "hardhat/config";
import { ConfigNames, getEmergencyAdmin, getGenesisPoolAdmin, loadPoolConfig } from "../../helpers/configuration";
import {
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { configureNftsByHelper } from "../../helpers/init-helpers";
import { waitForTx } from "../../helpers/misc-utils";
import { eNetwork } from "../../helpers/types";

task("pool-amdin:pause", "Doing lend pool admin task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("pause", "Verify contracts at Etherscan")
  .setAction(async ({ pool, pause }, DRE) => {
    await DRE.run("set-DRE");

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const emAdmin = await DRE.ethers.getSigner(await getEmergencyAdmin(poolConfig));

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    const lendPoolProxy = await getLendPool(await addressesProvider.getLendPool());

    const currentPause = await lendPoolProxy.paused();
    console.log("LendPool Current Pause:", currentPause);

    if (currentPause == pause) {
      console.log("No need to do because same state");
      return;
    }

    await waitForTx(await lendPoolConfiguratorProxy.connect(emAdmin).setPoolPause(pause));

    const newPause = await lendPoolProxy.paused();
    console.log("LendPool New Pause:", newPause);
  });

task("pool-amdin:update-nfts-config", "Doing lend pool nft config task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = <eNetwork>DRE.network.name;

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const poolAdminAddress = await addressesProvider.getPoolAdmin();

    const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);
    if (!nftsAssets) {
      throw "NFT assets is undefined. Check NftsAssets configuration at config directory";
    }
    await configureNftsByHelper(poolConfig.NftsConfig, nftsAssets, poolAdminAddress);
  });

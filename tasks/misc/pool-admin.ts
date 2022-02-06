import { task } from "hardhat/config";
import { ConfigNames, getEmergencyAdmin, getGenesisPoolAdmin, loadPoolConfig } from "../../helpers/configuration";
import {
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { configureNftsByHelper, configureReservesByHelper } from "../../helpers/init-helpers";
import { waitForTx } from "../../helpers/misc-utils";
import { eNetwork } from "../../helpers/types";

task("pool-amdin:set-pause", "Doing lend pool pause task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("state", "Admin state of pause, 0-false, 1-true")
  .setAction(async ({ pool, state }, DRE) => {
    await DRE.run("set-DRE");

    let wantPause = true;
    if (state == 0 || state == false) {
      wantPause = false;
    }

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const emAdmin = await DRE.ethers.getSigner(await getEmergencyAdmin(poolConfig));

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    const lendPoolProxy = await getLendPool(await addressesProvider.getLendPool());

    const currentPause = await lendPoolProxy.paused();
    console.log("LendPool Current Pause State:", currentPause);

    if (currentPause == wantPause) {
      console.log("No need to do because same state");
      return;
    }

    await waitForTx(await lendPoolConfiguratorProxy.connect(emAdmin).setPoolPause(wantPause));

    const newPause = await lendPoolProxy.paused();
    console.log("LendPool New Pause State:", newPause);
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

task("pool-amdin:update-reserves-config", "Doing lend pool reserve config task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = <eNetwork>DRE.network.name;

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const poolAdminAddress = await addressesProvider.getPoolAdmin();

    const reservesAssets = getParamPerNetwork(poolConfig.ReserveAssets, network);
    if (!reservesAssets) {
      throw "Reserve assets is undefined. Check ReserveAssets configuration at config directory";
    }
    await configureReservesByHelper(poolConfig.ReservesConfig, reservesAssets, poolAdminAddress);
  });

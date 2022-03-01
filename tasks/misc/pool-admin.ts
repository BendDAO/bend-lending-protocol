import { task } from "hardhat/config";
import { ConfigNames, getEmergencyAdmin, getGenesisPoolAdmin, loadPoolConfig } from "../../helpers/configuration";
import {
  getBendProtocolDataProvider,
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { configureNftsByHelper, configureReservesByHelper } from "../../helpers/init-helpers";
import { waitForTx } from "../../helpers/misc-utils";
import { eNetwork } from "../../helpers/types";

task("pool-admin:set-pause", "Doing lend pool pause task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("state", "Admin state of pause, 0-false, 1-true")
  .setAction(async ({ pool, state }, DRE) => {
    await DRE.run("set-DRE");

    let wantPause = true;
    if (state == 0 || state == false) {
      wantPause = false;
    }

    const addressesProvider = await getLendPoolAddressesProvider();

    const emAdmin = await DRE.ethers.getSigner(await addressesProvider.getEmergencyAdmin());

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

task("pool-admin:update-nfts-config", "Doing lend pool nft config task")
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

task("pool-admin:update-reserves-config", "Doing lend pool reserve config task")
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

task("pool-admin:set-reserve-active", "Doing Reserve active task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("asset", "Address of Reserve")
  .addParam("state", "Active state, 0-false, 1-true")
  .setAction(async ({ pool, asset, state }, DRE) => {
    await DRE.run("set-DRE");

    let wantState = true;
    if (state == 0 || state == false) {
      wantState = false;
    }

    const addressesProvider = await getLendPoolAddressesProvider();

    const pmAdmin = await DRE.ethers.getSigner(await addressesProvider.getPoolAdmin());

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    const bendDataProvider = await getBendProtocolDataProvider(await addressesProvider.getBendDataProvider());

    const reserveConfig = await bendDataProvider.getReserveConfigurationData(asset);
    const currentState = reserveConfig.isActive;
    console.log("Reserve Current Active State:", currentState);

    if (currentState == wantState) {
      console.log("No need to do because same state");
      return;
    }

    if (wantState) {
      await waitForTx(await lendPoolConfiguratorProxy.connect(pmAdmin).activateReserve(asset));
    } else {
      await waitForTx(await lendPoolConfiguratorProxy.connect(pmAdmin).deactivateReserve(asset));
    }

    const newReserveConfig = await bendDataProvider.getReserveConfigurationData(asset);
    console.log("Reserve New Active State:", newReserveConfig.isActive);
  });

task("pool-admin:set-reserve-frozen", "Doing Reserve frozen task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("asset", "Address of Reserve")
  .addParam("state", "Frozen state, 0-false, 1-true")
  .setAction(async ({ pool, asset, state }, DRE) => {
    await DRE.run("set-DRE");

    let wantState = true;
    if (state == 0 || state == false) {
      wantState = false;
    }

    const addressesProvider = await getLendPoolAddressesProvider();

    const pmAdmin = await DRE.ethers.getSigner(await addressesProvider.getPoolAdmin());

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    const bendDataProvider = await getBendProtocolDataProvider(await addressesProvider.getBendDataProvider());

    const reserveConfig = await bendDataProvider.getReserveConfigurationData(asset);
    const currentState = reserveConfig.isFrozen;
    console.log("Reserve Current Frozen State:", currentState);

    if (currentState == wantState) {
      console.log("No need to do because same state");
      return;
    }

    if (wantState) {
      await waitForTx(await lendPoolConfiguratorProxy.connect(pmAdmin).freezeReserve(asset));
    } else {
      await waitForTx(await lendPoolConfiguratorProxy.connect(pmAdmin).unfreezeReserve(asset));
    }

    const newReserveConfig = await bendDataProvider.getReserveConfigurationData(asset);
    console.log("Reserve New Frozen State:", newReserveConfig.isFrozen);
  });

task("pool-admin:set-nft-active", "Doing NFT active task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("asset", "Address of Reserve")
  .addParam("state", "Admin state of Active, 0-false, 1-true")
  .setAction(async ({ pool, asset, state }, DRE) => {
    await DRE.run("set-DRE");

    let wantState = true;
    if (state == 0 || state == false) {
      wantState = false;
    }

    const addressesProvider = await getLendPoolAddressesProvider();

    const pmAdmin = await DRE.ethers.getSigner(await addressesProvider.getPoolAdmin());

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    const bendDataProvider = await getBendProtocolDataProvider(await addressesProvider.getBendDataProvider());

    const curNftConfig = await bendDataProvider.getNftConfigurationData(asset);
    const currentState = curNftConfig.isActive;
    console.log("NFT Current Active State:", currentState);

    if (currentState == wantState) {
      console.log("No need to do because same state");
      return;
    }

    if (wantState) {
      await waitForTx(await lendPoolConfiguratorProxy.connect(pmAdmin).activateNft(asset));
    } else {
      await waitForTx(await lendPoolConfiguratorProxy.connect(pmAdmin).deactivateNft(asset));
    }

    const newNftConfig = await bendDataProvider.getNftConfigurationData(asset);
    console.log("NFT New Active State:", newNftConfig.isActive);
  });

task("pool-admin:set-nft-frozen", "Doing NFT frozen task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("asset", "Address of Reserve")
  .addParam("state", "Frozen state, 0-false, 1-true")
  .setAction(async ({ pool, asset, state }, DRE) => {
    await DRE.run("set-DRE");

    let wantState = true;
    if (state == 0 || state == false) {
      wantState = false;
    }

    const addressesProvider = await getLendPoolAddressesProvider();

    const pmAdmin = await DRE.ethers.getSigner(await addressesProvider.getPoolAdmin());

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );

    const bendDataProvider = await getBendProtocolDataProvider(await addressesProvider.getBendDataProvider());

    const curNftConfig = await bendDataProvider.getNftConfigurationData(asset);
    const currentState = curNftConfig.isFrozen;
    console.log("NFT Current Frozen State:", currentState);

    if (currentState == wantState) {
      console.log("No need to do because same state");
      return;
    }

    if (wantState) {
      await waitForTx(await lendPoolConfiguratorProxy.connect(pmAdmin).freezeNft(asset));
    } else {
      await waitForTx(await lendPoolConfiguratorProxy.connect(pmAdmin).unfreezeNft(asset));
    }

    const newNftConfig = await bendDataProvider.getNftConfigurationData(asset);
    console.log("NFT New Frozen State:", newNftConfig.isFrozen);
  });

import { task } from "hardhat/config";
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from "../../helpers/configuration";
import {
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
} from "../../helpers/contracts-getters";
import { waitForTx } from "../../helpers/misc-utils";

task("pool-amdin:pause", "Doing lend pool pause task")
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

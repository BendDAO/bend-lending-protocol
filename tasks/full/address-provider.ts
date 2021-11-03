import { task } from "hardhat/config";
import { deployLendPoolAddressesProvider } from "../../helpers/contracts-deployments";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig, getGenesisPoolAdmin, getEmergencyAdmin } from "../../helpers/configuration";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { eNetwork } from "../../helpers/types";

task("full:deploy-address-provider", "Deploy address provider for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);

    // Deploy address provider and set genesis manager
    const addressesProvider = await deployLendPoolAddressesProvider(poolConfig.MarketId, verify);

    // Set pool admins
    await waitForTx(await addressesProvider.setPoolAdmin(await getGenesisPoolAdmin(poolConfig)));
    await waitForTx(await addressesProvider.setEmergencyAdmin(await getEmergencyAdmin(poolConfig)));

    console.log("Pool Admin", await addressesProvider.getPoolAdmin());
    console.log("Emergency Admin", await addressesProvider.getEmergencyAdmin());
  });

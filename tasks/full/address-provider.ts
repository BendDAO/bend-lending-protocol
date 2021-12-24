import { task } from "hardhat/config";
import { formatEther } from "ethers/lib/utils";
import { deployLendPoolAddressesProvider } from "../../helpers/contracts-deployments";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig, getGenesisPoolAdmin, getEmergencyAdmin } from "../../helpers/configuration";
import { getDeploySigner } from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { eNetwork } from "../../helpers/types";

task("full:deploy-address-provider", "Deploy address provider for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("skipRegistry")
  .setAction(async ({ verify, pool, skipRegistry }, DRE) => {
    await DRE.run("set-DRE");
    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const signer = await getDeploySigner();

    // this contract is not support upgrade, just deploy new contract
    // Deploy address provider and set genesis manager
    const addressesProvider = await deployLendPoolAddressesProvider(poolConfig.MarketId, verify);

    // Add to registry or setup a new one
    if (!skipRegistry) {
      const providerRegistryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, <eNetwork>DRE.network.name);

      await DRE.run("add-market-to-registry", {
        pool,
        addressesProvider: addressesProvider.address,
        deployRegistry: !notFalsyOrZeroAddress(providerRegistryAddress),
      });
    }

    // Set pool admins
    await waitForTx(await addressesProvider.setPoolAdmin(await getGenesisPoolAdmin(poolConfig)));
    await waitForTx(await addressesProvider.setEmergencyAdmin(await getEmergencyAdmin(poolConfig)));

    console.log("Pool Admin", await addressesProvider.getPoolAdmin());
    console.log("Emergency Admin", await addressesProvider.getEmergencyAdmin());
  });

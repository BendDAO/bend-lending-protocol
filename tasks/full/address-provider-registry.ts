import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployLendPoolAddressesProviderRegistry } from "../../helpers/contracts-deployments";
import { getParamPerNetwork, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";

task("full:deploy-address-provider-registry", "Deploy address provider registry")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>DRE.network.name;

    const providerRegistryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);

    if (providerRegistryAddress != undefined && notFalsyOrZeroAddress(providerRegistryAddress)) {
      console.log("Already deployed Provider Registry Address at", providerRegistryAddress);
      await insertContractAddressInDb(eContractid.LendPoolAddressesProviderRegistry, providerRegistryAddress);
    } else {
      const contract = await deployLendPoolAddressesProviderRegistry(verify);
      console.log("Deployed Registry Address:", contract.address, "Owner Address:", await contract.owner());
    }
  });

import { formatEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployLendPoolAddressesProviderRegistry } from "../../helpers/contracts-deployments";
import { getFirstSigner } from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eNetwork } from "../../helpers/types";

task("full:deploy-address-provider-registry", "Deploy address provider registry")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>DRE.network.name;
    const signer = await getFirstSigner();

    console.log("Deployer:", await signer.getAddress(), "Balance:", formatEther(await signer.getBalance()));

    const providerRegistryAddress = getParamPerNetwork(poolConfig.ProviderRegistry, network);

    if (notFalsyOrZeroAddress(providerRegistryAddress)) {
      console.log("Already deployed Provider Registry Address at", providerRegistryAddress);
    } else {
      const contract = await deployLendPoolAddressesProviderRegistry(verify);
      console.log("Deployed Registry Address:", contract.address);
    }
  });

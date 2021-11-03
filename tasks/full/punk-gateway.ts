import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import { deployPunkGateway } from "../../helpers/contracts-deployments";

const CONTRACT_NAME = "PunkGateway";

task(`full-deploy-punk-gateway`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);

    if (!localBRE.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }
    //const punkGateWay = await deployPunkGateway([], verify);
    //console.log(`${CONTRACT_NAME}.address`, punkGateWay.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });

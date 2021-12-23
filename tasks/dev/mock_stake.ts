import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployMockIncentivesController } from "../../helpers/contracts-deployments";

task("dev:deploy-mock-stakes", "Deploy mock stake for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const poolConfig = loadPoolConfig(pool);

    const mockIncentivesController = await deployMockIncentivesController(verify);

    console.log("MockIncentivesController:", mockIncentivesController.address);
  });

import { task } from "hardhat/config";
import { deployAllMockTokens } from "../../helpers/contracts-deployments";

task("dev:deploy-mock-reserves", "Deploy mock reserves for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");
    await deployAllMockTokens(verify);
  });

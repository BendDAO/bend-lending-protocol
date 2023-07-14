import { task } from "hardhat/config";
import { deployAllMockTokens, deployOneMockToken, deployWETH9 } from "../../helpers/contracts-deployments";

task("dev:deploy-mock-reserves", "Deploy mock reserves for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");
    await deployAllMockTokens(false, verify);
  });

task("dev:deploy-mock-weth", "Deploy WETH for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");
    await deployWETH9(verify);
  });

task("dev:deploy-mock-usdt", "Deploy USDT for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");

    await deployOneMockToken("USDT", verify);
  });

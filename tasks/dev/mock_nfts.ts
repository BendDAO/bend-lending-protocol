import { task } from "hardhat/config";
import { deployAllMockNfts } from "../../helpers/contracts-deployments";

task("dev:deploy-mock-nfts", "Deploy mock nfts for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");
    await deployAllMockNfts(verify);
  });

import { task } from "hardhat/config";
import { checkVerification } from "../../helpers/etherscan-verification";
import { ConfigNames } from "../../helpers/configuration";
import { printContracts } from "../../helpers/misc-utils";

task("bend:dev", "Deploy development enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    const POOL_NAME = ConfigNames.Bend;

    await localBRE.run("set-DRE");

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    console.log("Migration started\n");

    console.log("Deploy mock reserves");
    await localBRE.run("dev:deploy-mock-reserves", { verify });

    console.log("Deploy mock nfts");
    await localBRE.run("dev:deploy-mock-nfts", { verify });

    console.log("Deploy bnft registry");
    await localBRE.run("dev:deploy-bnft-registry", { verify, pool: POOL_NAME });

    console.log("Deploy bnft tokens");
    await localBRE.run("dev:deploy-bnft-tokens", { verify, pool: POOL_NAME });

    console.log("Deploy address provider");
    await localBRE.run("dev:deploy-address-provider", { verify });

    console.log("Deploy lend pool");
    await localBRE.run("dev:deploy-lend-pool", { verify, pool: POOL_NAME });

    console.log("Deploy reserve oracle");
    await localBRE.run("dev:deploy-oracle-reserve", { verify, pool: POOL_NAME });

    console.log("Deploy nft oracle");
    await localBRE.run("dev:deploy-oracle-nft", { verify, pool: POOL_NAME });

    console.log("Deploy WETH Gateway");
    await localBRE.run("full-deploy-weth-gateway", { verify, pool: POOL_NAME });

    console.log("Deploy WPUNKS Gateway");
    await localBRE.run("full-deploy-punk-gateway", { verify, pool: POOL_NAME });

    console.log("Initialize lend pool");
    await localBRE.run("dev:initialize-lend-pool", { verify, pool: POOL_NAME });

    console.log("\nFinished migration");
    printContracts();
  });

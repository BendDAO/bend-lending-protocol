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

    console.log("1.1. Deploy mock reserves");
    await localBRE.run("dev:deploy-mock-reserves", { verify });

    console.log("1.2. Deploy mock nfts");
    await localBRE.run("dev:deploy-mock-nfts", { verify });

    console.log("2.1. Deploy bnft registry");
    await localBRE.run("dev:deploy-bnft-registry", { verify, pool: POOL_NAME });

    console.log("2.2. Deploy bnft tokens");
    await localBRE.run("dev:deploy-bnft-tokens", { verify, pool: POOL_NAME });

    console.log("3.1. Deploy address provider");
    await localBRE.run("dev:deploy-address-provider", { verify });

    console.log("3.2. Deploy lend pool");
    await localBRE.run("dev:deploy-lend-pool", { verify, pool: POOL_NAME });

    console.log("3.3. Deploy reserve oracle");
    await localBRE.run("dev:deploy-oracle-reserve", { verify, pool: POOL_NAME });

    console.log("3.4. Deploy reserve oracle");
    await localBRE.run("dev:deploy-nft-reserve", { verify, pool: POOL_NAME });

    console.log("4.1. Deploy WETH Gateway");
    await localBRE.run("full-deploy-weth-gateway", { verify, pool: POOL_NAME });

    console.log("5.1. Initialize lend pool");
    await localBRE.run("dev:initialize-lend-pool", { verify, pool: POOL_NAME });

    console.log("\nFinished migration");
    printContracts();
  });

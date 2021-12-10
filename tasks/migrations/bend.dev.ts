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

    console.log("\n\nMigration started");

    //////////////////////////////////////////////////////////////////////////
    console.log("\n\nDeploy mock reserves");
    await localBRE.run("dev:deploy-mock-reserves", { verify });

    console.log("\n\nDeploy mock nfts");
    await localBRE.run("dev:deploy-mock-nfts", { verify });

    //////////////////////////////////////////////////////////////////////////
    console.log("\n\nDeploy mock bnft registry");
    await localBRE.run("dev:deploy-mock-bnft-registry", { verify, pool: POOL_NAME });

    console.log("\n\nDeploy mock bnft tokens");
    await localBRE.run("dev:deploy-mock-bnft-tokens", { verify, pool: POOL_NAME });

    //////////////////////////////////////////////////////////////////////////
    console.log("\n\nDeploy proxy admin");
    await localBRE.run("full:deploy-proxy-admin", { verify, pool: POOL_NAME });

    //////////////////////////////////////////////////////////////////////////
    console.log("\n\nDeploy address provider");
    await localBRE.run("dev:deploy-address-provider", { verify, pool: POOL_NAME });

    //////////////////////////////////////////////////////////////////////////
    console.log("\n\nDeploy lend pool");
    await localBRE.run("dev:deploy-lend-pool", { verify, pool: POOL_NAME });

    console.log("\n\nDeploy reserve oracle");
    await localBRE.run("dev:deploy-oracle-reserve", { verify, pool: POOL_NAME });

    console.log("\n\nDeploy nft oracle");
    await localBRE.run("dev:deploy-oracle-nft", { verify, pool: POOL_NAME });

    //////////////////////////////////////////////////////////////////////////
    console.log("\n\nDeploy WETH Gateway");
    await localBRE.run("full:deploy-weth-gateway", { verify, pool: POOL_NAME });

    console.log("\n\nDeploy PUNK Gateway"); // MUST AFTER WETH GATEWAY
    await localBRE.run("full:deploy-punk-gateway", { verify, pool: POOL_NAME });

    //////////////////////////////////////////////////////////////////////////
    console.log("\n\nInitialize lend pool");
    await localBRE.run("dev:initialize-lend-pool", { verify, pool: POOL_NAME });

    console.log("\n\nFinished migration");
    printContracts();
  });

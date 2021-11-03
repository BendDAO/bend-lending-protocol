import { task } from "hardhat/config";
import { deployWalletBalancerProvider } from "../../helpers/contracts-deployments";

task("dev:wallet-balance-provider", "Initialize wallet balance provider configuration.")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");

    await deployWalletBalancerProvider(verify);
  });

import { task } from "hardhat/config";
import { deployBendProtocolDataProvider } from "../../helpers/contracts-deployments";
import { exit } from "process";
import { getLendPoolAddressesProvider } from "../../helpers/contracts-getters";

task("full:data-provider", "Deploy data provider.")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    try {
      await localBRE.run("set-DRE");

      const addressesProvider = await getLendPoolAddressesProvider();

      await deployBendProtocolDataProvider(addressesProvider.address, verify);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

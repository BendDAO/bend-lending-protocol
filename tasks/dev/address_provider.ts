import { task } from "hardhat/config";
import { deployLendPoolAddressesProvider } from "../../helpers/contracts-deployments";
import { getEthersSigners } from "../../helpers/contracts-helpers";
import { waitForTx } from "../../helpers/misc-utils";
import { BendConfig } from "../../markets/bend";

task("dev:deploy-address-provider", "Deploy address provider for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run("set-DRE");

    const admin = await (await getEthersSigners())[0].getAddress();

    const addressesProvider = await deployLendPoolAddressesProvider(BendConfig.MarketId, verify);
    await waitForTx(await addressesProvider.setPoolAdmin(admin));
    await waitForTx(await addressesProvider.setEmergencyAdmin(admin));
  });

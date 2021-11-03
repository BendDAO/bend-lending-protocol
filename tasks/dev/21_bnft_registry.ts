import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployBNFTRegistry } from "../../helpers/contracts-deployments";
import { getEthersSigners } from "../../helpers/contracts-helpers";

task("dev:deploy-bnft-registry", "Deploy bnft registry for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const admin = await (await getEthersSigners())[0].getAddress();

    const poolConfig = loadPoolConfig(pool);

    const bnftRegistryImpl = await deployBNFTRegistry([poolConfig.BNftNamePrefix, poolConfig.BNftSymbolPrefix]);
    await waitForTx(await bnftRegistryImpl.transferOwnership(admin));
  });

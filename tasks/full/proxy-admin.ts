import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployBendProxyAdmin } from "../../helpers/contracts-deployments";
import { getParamPerNetwork, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";

task("full:deploy-proxy-admin", "Deploy proxy admin contract")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>DRE.network.name;

    const proxyAdminAddress = getParamPerNetwork(poolConfig.ProxyAdmin, network);

    if (proxyAdminAddress != undefined && notFalsyOrZeroAddress(proxyAdminAddress)) {
      console.log("Already deployed Proxy Admin Address:", proxyAdminAddress);
      await insertContractAddressInDb(eContractid.BendProxyAdmin, proxyAdminAddress);
    } else {
      const contract = await deployBendProxyAdmin(verify);
      console.log("Deployed Proxy Admin Address:", contract.address);
    }
  });

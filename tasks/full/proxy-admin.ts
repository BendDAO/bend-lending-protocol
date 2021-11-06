import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployBendProxyAdmin } from "../../helpers/contracts-deployments";
import { getBendProxyAdmin, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { getParamPerNetwork, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";

task("full:deploy-proxy-admin", "Deploy proxy admin contract")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>DRE.network.name;
    const addressesProvider = await getLendPoolAddressesProvider();

    let proxyAdminAddress = getParamPerNetwork(poolConfig.ProxyAdmin, network);

    if (proxyAdminAddress != undefined && notFalsyOrZeroAddress(proxyAdminAddress)) {
      await insertContractAddressInDb(eContractid.BendProxyAdmin, proxyAdminAddress);
      const contract = await getBendProxyAdmin(proxyAdminAddress);
      console.log("Already deployed Proxy Admin Address:", proxyAdminAddress, "Owner Address:", await contract.owner());
    } else {
      const contract = await deployBendProxyAdmin(verify);
      proxyAdminAddress = contract.address;
      console.log("Deployed Proxy Admin Address:", contract.address, "Owner Address:", await contract.owner());
    }

    await waitForTx(await addressesProvider.setProxyAdmin(proxyAdminAddress));
  });

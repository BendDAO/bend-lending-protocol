import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import {
  deployBendCollector,
  deployBendProxyAdmin,
  deployBendUpgradeableProxy,
} from "../../helpers/contracts-deployments";
import { getBendProxyAdminById, getBendUpgradeableProxy } from "../../helpers/contracts-getters";
import { getParamPerNetwork, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";
import { BendCollector, BendUpgradeableProxy } from "../../types";

task("full:deploy-bend-collector", "Deploy bend collect contract")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>DRE.network.name;

    const collectorProxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminFund);
    const proxyAdminOwner = await collectorProxyAdmin.owner();
    console.log("Proxy Admin: address %s, owner %s", collectorProxyAdmin.address, proxyAdminOwner);

    const bendCollectorImpl = await deployBendCollector(verify);
    const initEncodedData = bendCollectorImpl.interface.encodeFunctionData("initialize");

    const bendCollectorProxy = await deployBendUpgradeableProxy(
      eContractid.BendCollector,
      collectorProxyAdmin.address,
      bendCollectorImpl.address,
      initEncodedData
    );
    console.log("Bend Collector: proxy %s, implementation %s", bendCollectorProxy.address, bendCollectorImpl.address);
  });

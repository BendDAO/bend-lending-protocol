import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployBendProxyAdmin } from "../../helpers/contracts-deployments";
import { getBendProxyAdminByAddress } from "../../helpers/contracts-getters";
import { getParamPerNetwork, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";
import { BendProxyAdmin } from "../../types";

task("full:deploy-proxy-admin", "Deploy proxy admin contract")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("skipPool", "Skip proxy admin for POOL")
  .addFlag("skipFund", "Skip proxy admin for FUND")
  .setAction(async ({ verify, pool, skipPool, skipFund }, DRE) => {
    await DRE.run("set-DRE");
    await DRE.run("compile");

    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>DRE.network.name;

    if (!skipPool) {
      let proxyAdmin: BendProxyAdmin;
      const proxyAdminAddress = getParamPerNetwork(poolConfig.ProxyAdminPool, network);
      if (proxyAdminAddress == undefined || !notFalsyOrZeroAddress(proxyAdminAddress)) {
        proxyAdmin = await deployBendProxyAdmin(eContractid.BendProxyAdminPool, verify);
      } else {
        await insertContractAddressInDb(eContractid.BendProxyAdminPool, proxyAdminAddress);
        proxyAdmin = await getBendProxyAdminByAddress(proxyAdminAddress);
      }
      console.log("ProxyAdminPool Address:", proxyAdmin.address, "Owner Address:", await proxyAdmin.owner());
    }

    if (!skipFund) {
      let proxyAdmin: BendProxyAdmin;
      const proxyAdminAddress = getParamPerNetwork(poolConfig.ProxyAdminFund, network);
      if (proxyAdminAddress == undefined || !notFalsyOrZeroAddress(proxyAdminAddress)) {
        proxyAdmin = await deployBendProxyAdmin(eContractid.BendProxyAdminFund, verify);
      } else {
        await insertContractAddressInDb(eContractid.BendProxyAdminFund, proxyAdminAddress);
        proxyAdmin = await getBendProxyAdminByAddress(proxyAdminAddress);
      }
      console.log("BendProxyAdminFund Address:", proxyAdmin.address, "Owner Address:", await proxyAdmin.owner());
    }
  });

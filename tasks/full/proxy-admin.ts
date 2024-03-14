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
  .addFlag("all", "Create all proxy admin")
  .addOptionalParam("proxyadminid", "Proxy admin ID")
  .setAction(async ({ verify, pool, all, proxyadminid }, DRE) => {
    await DRE.run("set-DRE");
    await DRE.run("compile");

    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>DRE.network.name;

    if (all || proxyadminid == eContractid.BendProxyAdminPool) {
      let proxyAdmin: BendProxyAdmin;
      const proxyAdminAddress = getParamPerNetwork(poolConfig.ProxyAdminPool, network);
      if (proxyAdminAddress == undefined || !notFalsyOrZeroAddress(proxyAdminAddress)) {
        proxyAdmin = await deployBendProxyAdmin(eContractid.BendProxyAdminPool, verify);
      } else {
        await insertContractAddressInDb(eContractid.BendProxyAdminPool, proxyAdminAddress);
        proxyAdmin = await getBendProxyAdminByAddress(proxyAdminAddress);
      }
      console.log("BendProxyAdminPool Address:", proxyAdmin.address, "Owner Address:", await proxyAdmin.owner());
    }

    if (all || proxyadminid == eContractid.BendProxyAdminFund) {
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

    if (all || proxyadminid == eContractid.BendProxyAdminWTL) {
      let proxyAdmin: BendProxyAdmin;
      const proxyAdminAddress = getParamPerNetwork(poolConfig.ProxyAdminWTL, network);
      if (proxyAdminAddress == undefined || !notFalsyOrZeroAddress(proxyAdminAddress)) {
        proxyAdmin = await deployBendProxyAdmin(eContractid.BendProxyAdminWTL, verify);
      } else {
        await insertContractAddressInDb(eContractid.BendProxyAdminWTL, proxyAdminAddress);
        proxyAdmin = await getBendProxyAdminByAddress(proxyAdminAddress);
      }
      console.log("BendProxyAdminWTL Address:", proxyAdmin.address, "Owner Address:", await proxyAdmin.owner());
    }
  });

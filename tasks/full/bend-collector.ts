import { BigNumber } from "ethers";
import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { MAX_UINT_AMOUNT } from "../../helpers/constants";
import {
  deployBendCollector,
  deployBendProxyAdmin,
  deployBendUpgradeableProxy,
} from "../../helpers/contracts-deployments";
import {
  getBendCollectorProxy,
  getBendProxyAdminById,
  getBendUpgradeableProxy,
  getIErc20Detailed,
} from "../../helpers/contracts-getters";
import {
  convertToCurrencyDecimals,
  getEthersSignerByAddress,
  getParamPerNetwork,
  insertContractAddressInDb,
} from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";
import { BendCollector, BendUpgradeableProxy } from "../../types";

task("full:deploy-bend-collector", "Deploy bend collect contract")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    await DRE.run("compile");

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
      initEncodedData,
      verify
    );
    console.log("Bend Collector: proxy %s, implementation %s", bendCollectorProxy.address, bendCollectorImpl.address);
  });

task("full:upgrade-bend-collector", "Upgrade bend collect contract")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("proxy", "Contract proxy address")
  .addOptionalParam("initFunc", "Name of initialize function")
  .setAction(async ({ verify, pool, proxy, initFunc }, DRE) => {
    await DRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>DRE.network.name;

    const collectorProxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminFund);
    const proxyAdminOwnerAddress = await collectorProxyAdmin.owner();
    const proxyAdminOwnerSigner = await getEthersSignerByAddress(proxyAdminOwnerAddress);
    console.log("Proxy Admin: address %s, owner %s", collectorProxyAdmin.address, proxyAdminOwnerAddress);

    const bendCollectorProxy = await getBendUpgradeableProxy(proxy);
    console.log("Bend Collector: proxy %s", bendCollectorProxy.address);

    const bendCollector = await getBendCollectorProxy(bendCollectorProxy.address);

    const bendCollectorImpl = await deployBendCollector(verify);
    console.log("Bend Collector: new implementation %s", bendCollectorImpl.address);
    insertContractAddressInDb(eContractid.BendCollector, bendCollectorProxy.address);

    if (initFunc != undefined && initFunc != "") {
      const initEncodedData = bendCollectorImpl.interface.encodeFunctionData(initFunc);

      await waitForTx(
        await collectorProxyAdmin
          .connect(proxyAdminOwnerSigner)
          .upgradeAndCall(bendCollectorProxy.address, bendCollectorImpl.address, initEncodedData)
      );
    } else {
      await waitForTx(
        await collectorProxyAdmin
          .connect(proxyAdminOwnerSigner)
          .upgrade(bendCollectorProxy.address, bendCollectorImpl.address)
      );
    }

    //await waitForTx(await bendCollector.initialize_v2());

    console.log("Bend Collector: upgrade ok");
  });

task("bend-collector:approve-erc20", "Approve ERC20 token")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("proxy", "Contract proxy address")
  .addParam("token", "ERC20 token address")
  .addParam("to", "Target address, like 0.1")
  .addParam("amount", "Amount to approve")
  .setAction(async ({ verify, pool, proxy, token, to, amount }, DRE) => {
    await DRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>DRE.network.name;

    const bendCollectorProxy = await getBendUpgradeableProxy(proxy);
    console.log("Bend Collector: proxy %s", bendCollectorProxy.address);

    const bendCollector = await getBendCollectorProxy(bendCollectorProxy.address);
    const ownerSigner = await getEthersSignerByAddress(await bendCollector.owner());

    let amountDecimals = MAX_UINT_AMOUNT;
    if (amount != "-1") {
      amountDecimals = (await convertToCurrencyDecimals(token, amount)).toString();
    }

    await waitForTx(await bendCollector.connect(ownerSigner).approve(token, to, amountDecimals));

    console.log("Bend Collector: approve ok");
  });

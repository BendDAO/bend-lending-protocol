import { task } from "hardhat/config";
import {
  deployBendUpgradeableProxy,
  deployOpenseaDownpaymentBuyAdapterImpl,
} from "../../helpers/contracts-deployments";
import { eContractid, eNetwork } from "../../helpers/types";
import { DRE, notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { ConfigNames, getWrappedNativeTokenAddress, loadPoolConfig } from "../../helpers/configuration";
import {
  getBendCollectorProxy,
  getBendProxyAdminById,
  getLendPoolAddressesProvider,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";

task("dev:deploy-openseaDownpaymentBuyAdapter", "Deploy OpenseaDownpaymentBuyAdapter ")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);
    const network = <eNetwork>localBRE.network.name;

    const addressesProvider = await getLendPoolAddressesProvider();
    const proxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminPool);
    if (proxyAdmin == undefined || !notFalsyOrZeroAddress(proxyAdmin.address)) {
      throw Error("Invalid pool proxy admin in config");
    }
    const weth = await getWrappedNativeTokenAddress(poolConfig);
    const impl = await deployOpenseaDownpaymentBuyAdapterImpl(verify);
    const openseaConfig = getParamPerNetwork(poolConfig.OPENSEA, network);
    const aaveConfig = getParamPerNetwork(poolConfig.AAVE, network);

    const initEncodedData = impl.interface.encodeFunctionData("initialize", [
      100,
      addressesProvider.address,
      aaveConfig.addressesProvider,
      openseaConfig.exchange,
      weth,
      (await getBendCollectorProxy()).address,
    ]);
    const proxy = await deployBendUpgradeableProxy(
      eContractid.OpenseaDownpaymentBuyAdapter,
      proxyAdmin.address,
      impl.address,
      initEncodedData,
      verify
    );

    console.log("proxy %s, implementation %s", proxy.address, impl.address);
    console.log("Finished  deployment");
  });

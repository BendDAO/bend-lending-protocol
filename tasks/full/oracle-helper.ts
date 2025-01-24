import { task } from "hardhat/config";
import {
  getContractAddressInDb,
  insertContractAddressInDb,
  tryGetContractAddressInDb,
} from "../../helpers/contracts-helpers";
import { deployBendUpgradeableProxy, deployChainlinkAggregatorHelper } from "../../helpers/contracts-deployments";
import { eNetwork, eContractid } from "../../helpers/types";
import { waitForTx, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import {
  getBendProxyAdminById,
  getBendUpgradeableProxy,
  getChainlinkAggregatorHelper,
  getChainlinkAggregatorHelperImpl,
  getLendPoolAddressesProvider,
} from "../../helpers/contracts-getters";
import { BendUpgradeableProxy, ChainlinkAggregatorHelper } from "../../types";

task("dev:deploy-aggregator-helper", "Deploy aggregator helper for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    try {
      await DRE.run("set-DRE");
      await DRE.run("compile");

      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);

      const addressProvider = await getLendPoolAddressesProvider();
      const aggHelperAddress = await tryGetContractAddressInDb(eContractid.ChainlinkAggregatorHelper);

      const proxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminPool);
      const proxyOwnerAddress = await proxyAdmin.owner();

      const aggHelperImpl = await deployChainlinkAggregatorHelper([], verify);
      //const aggHelperImpl = await getChainlinkAggregatorHelperImpl();
      const initEncodedData = aggHelperImpl.interface.encodeFunctionData("initialize", [addressProvider.address]);

      let aggHelper: ChainlinkAggregatorHelper;
      let aggHelperProxy: BendUpgradeableProxy;

      if (aggHelperAddress != undefined && notFalsyOrZeroAddress(aggHelperAddress)) {
        console.log("Upgrading exist aggregator helper proxy to new implementation...");

        await insertContractAddressInDb(eContractid.ChainlinkAggregatorHelper, aggHelperAddress);

        aggHelperProxy = await getBendUpgradeableProxy(aggHelperAddress);
        // only proxy admin can do upgrading
        const ownerSigner = DRE.ethers.provider.getSigner(proxyOwnerAddress);
        await waitForTx(await proxyAdmin.connect(ownerSigner).upgrade(aggHelperProxy.address, aggHelperImpl.address));

        aggHelper = await getChainlinkAggregatorHelper(aggHelperProxy.address);
      } else {
        console.log("Deploying new aggregator helper proxy & implementation...");

        aggHelperProxy = await deployBendUpgradeableProxy(
          eContractid.ChainlinkAggregatorHelper,
          proxyAdmin.address,
          aggHelperImpl.address,
          initEncodedData,
          verify
        );

        aggHelper = await getChainlinkAggregatorHelper(aggHelperProxy.address);
      }

      console.log("Aggregator Helper: proxy %s, implementation %s", aggHelper.address, aggHelperImpl.address);
    } catch (error) {
      throw error;
    }
  });

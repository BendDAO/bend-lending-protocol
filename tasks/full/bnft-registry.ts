import { task } from "hardhat/config";
import { waitForTx, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import {
  deployBNFTRegistry,
  deployBendUpgradeableProxy,
  deployGenericBNFTImpl,
} from "../../helpers/contracts-deployments";
import {
  getLendPoolAddressesProvider,
  getBNFTRegistryProxy,
  getBendUpgradeableProxy,
  getBendProxyAdminById,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { BNFTRegistry, BendUpgradeableProxy } from "../../types";

task("full:deploy-bnft-registry", "Deploy bnft registry for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const network = <eNetwork>DRE.network.name;

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const proxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminBNFT);
    const proxyOwnerAddress = await proxyAdmin.owner();

    const bnftGenericImpl = await deployGenericBNFTImpl(verify);

    const bnftRegistryImpl = await deployBNFTRegistry(verify);
    const initEncodedData = bnftRegistryImpl.interface.encodeFunctionData("initialize", [
      bnftGenericImpl.address,
      poolConfig.BNftNamePrefix,
      poolConfig.BNftSymbolPrefix,
    ]);

    let bnftRegistry: BNFTRegistry;
    let bnftRegistryProxy: BendUpgradeableProxy;

    let bnftRegistryProxyAddress = getParamPerNetwork(poolConfig.BNFTRegistry, network);
    if (bnftRegistryProxyAddress == undefined || !notFalsyOrZeroAddress(bnftRegistryProxyAddress)) {
      console.log("Deploying new bnft registry proxy & implementation...");

      bnftRegistryProxy = await deployBendUpgradeableProxy(
        eContractid.BNFTRegistry,
        proxyAdmin.address,
        bnftRegistryImpl.address,
        initEncodedData,
        verify
      );

      bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxy.address);
    } else {
      console.log("Upgrading exist bnft registry proxy to new implementation...");
      await insertContractAddressInDb(eContractid.BNFTRegistry, bnftRegistryProxyAddress);

      bnftRegistryProxy = await getBendUpgradeableProxy(bnftRegistryProxyAddress);

      // only proxy admin can do upgrading
      const ownerSigner = DRE.ethers.provider.getSigner(proxyOwnerAddress);
      await waitForTx(
        await proxyAdmin.connect(ownerSigner).upgrade(bnftRegistryProxy.address, bnftRegistryImpl.address)
      );

      bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxy.address);
    }

    await waitForTx(await addressesProvider.setBNFTRegistry(bnftRegistry.address));

    console.log("BNFT Registry: proxy %s, implementation %s", bnftRegistry.address, bnftRegistryImpl.address);
  });

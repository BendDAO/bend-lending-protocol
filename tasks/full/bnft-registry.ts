import { task } from "hardhat/config";
import { waitForTx, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployBNFTRegistry, deployInitializableAdminProxy } from "../../helpers/contracts-deployments";
import { getFirstSigner, getBNFTRegistryProxy, getInitializableAdminProxy } from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { BNFTRegistry, InitializableAdminProxy } from "../../types";

task("full:deploy-bnft-registry", "Deploy bnft registry for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const network = <eNetwork>DRE.network.name;
    const signer = await getFirstSigner();
    const admin = await signer.getAddress();

    const poolConfig = loadPoolConfig(pool);

    const bnftRegistryImpl = await deployBNFTRegistry(verify);
    const initEncodedData = bnftRegistryImpl.interface.encodeFunctionData("initialize", [
      poolConfig.BNftNamePrefix,
      poolConfig.BNftSymbolPrefix,
    ]);

    let bnftRegistry: BNFTRegistry;
    let bnftRegistryProxy: InitializableAdminProxy;

    let bnftRegistryProxyAddress = getParamPerNetwork(poolConfig.BNFTRegistry, network);
    if (bnftRegistryProxyAddress == undefined || !notFalsyOrZeroAddress(bnftRegistryProxyAddress)) {
      console.log("\tDeploying new bnft registry proxy & implementation...");

      bnftRegistryProxy = await deployInitializableAdminProxy(eContractid.BNFTRegistry, admin, verify);

      await waitForTx(await bnftRegistryProxy.initialize(bnftRegistryImpl.address, initEncodedData));
    } else {
      console.log("\tUpgrading exist bnft registry proxy to new implementation...");

      bnftRegistryProxy = await getInitializableAdminProxy(bnftRegistryProxyAddress);
      await waitForTx(await bnftRegistryProxy.upgradeTo(bnftRegistryImpl.address));
    }

    bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxy.address);

    await waitForTx(await bnftRegistry.transferOwnership(admin));
  });

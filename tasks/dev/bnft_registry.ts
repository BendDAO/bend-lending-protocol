import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/misc-utils";
import { eContractid, tEthereumAddress, BendPools } from "../../helpers/types";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployBNFTRegistry, deployInitializableAdminProxy } from "../../helpers/contracts-deployments";
import {
  getBendProxyAdmin,
  getBNFTRegistryProxy,
  getFirstSigner,
  getSecondSigner,
} from "../../helpers/contracts-getters";

task("dev:deploy-bnft-registry", "Deploy bnft registry for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const proxyAdmin = await getBendProxyAdmin();

    const poolConfig = loadPoolConfig(pool);

    const bnftRegistryImpl = await deployBNFTRegistry(verify);

    const initEncodedData = bnftRegistryImpl.interface.encodeFunctionData("initialize", [
      poolConfig.BNftNamePrefix,
      poolConfig.BNftSymbolPrefix,
    ]);

    const bnftRegistryProxy = await deployInitializableAdminProxy(eContractid.BNFTRegistry, proxyAdmin.address, verify);
    await waitForTx(await bnftRegistryProxy.initialize(bnftRegistryImpl.address, initEncodedData));

    const bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxy.address);
  });

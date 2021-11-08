import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/misc-utils";
import { eContractid, tEthereumAddress, BendPools } from "../../helpers/types";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import {
  deployBNFTRegistry,
  deployGenericBNFTImpl,
  deployBendUpgradeableProxy,
} from "../../helpers/contracts-deployments";
import { getLendPoolAddressesProvider, getBendProxyAdmin, getBNFTRegistryProxy } from "../../helpers/contracts-getters";

task("dev:deploy-bnft-registry", "Deploy bnft registry for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const addressesProvider = await getLendPoolAddressesProvider();

    const proxyAdmin = await getBendProxyAdmin(await addressesProvider.getProxyAdmin());

    const poolConfig = loadPoolConfig(pool);

    const bnftGenericImpl = await deployGenericBNFTImpl(verify);

    const bnftRegistryImpl = await deployBNFTRegistry(verify);

    const initEncodedData = bnftRegistryImpl.interface.encodeFunctionData("initialize", [
      bnftGenericImpl.address,
      poolConfig.BNftNamePrefix,
      poolConfig.BNftSymbolPrefix,
    ]);

    const bnftRegistryProxy = await deployBendUpgradeableProxy(
      eContractid.BNFTRegistry,
      proxyAdmin.address,
      bnftRegistryImpl.address,
      initEncodedData,
      verify
    );

    const bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxy.address);

    await waitForTx(await addressesProvider.setBNFTRegistry(bnftRegistry.address));
  });

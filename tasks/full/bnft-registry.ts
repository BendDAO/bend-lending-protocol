import { task } from "hardhat/config";
import { waitForTx, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployBNFTRegistry, deployInitializableAdminProxy } from "../../helpers/contracts-deployments";
import { getBNFTRegistryProxy } from "../../helpers/contracts-getters";
import { getEthersSigners, getParamPerNetwork } from "../../helpers/contracts-helpers";

task("full:deploy-bnft-registry", "Deploy bnft registry for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const network = <eNetwork>DRE.network.name;

    const admin = await (await getEthersSigners())[1].getAddress();

    const poolConfig = loadPoolConfig(pool);

    let bnftRegistryImplAddress = getParamPerNetwork(poolConfig.BNFTRegistry, network);
    if (!notFalsyOrZeroAddress(bnftRegistryImplAddress)) {
      console.log("\tDeploying new bnft registry implementation...");
      const bnftRegistryImpl = await deployBNFTRegistry(verify);
      bnftRegistryImplAddress = bnftRegistryImpl.address;
    }

    const bnftRegistryImpl = await deployBNFTRegistry(verify);

    const initEncodedData = bnftRegistryImpl.interface.encodeFunctionData("initialize", [
      poolConfig.BNftNamePrefix,
      poolConfig.BNftSymbolPrefix,
    ]);

    const bnftRegistryProxy = await deployInitializableAdminProxy(eContractid.BNFTRegistry, admin, verify);
    await waitForTx(await bnftRegistryProxy.initialize(bnftRegistryImpl.address, initEncodedData));

    const bnftRegistry = await getBNFTRegistryProxy(bnftRegistryProxy.address);

    await waitForTx(await bnftRegistry.transferOwnership(admin));
  });

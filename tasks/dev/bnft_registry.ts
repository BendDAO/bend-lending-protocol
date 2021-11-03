import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/misc-utils";
import { TokenContractId, NftContractId, eContractid, tEthereumAddress, BendPools } from "../../helpers/types";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployBNFTRegistry, deployInitializableAdminProxy } from "../../helpers/contracts-deployments";
import { getBNFTRegistryProxy } from "../../helpers/contracts-getters";
import { getEthersSigners } from "../../helpers/contracts-helpers";

task("dev:deploy-bnft-registry", "Deploy bnft registry for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const admin = await (await getEthersSigners())[1].getAddress();

    const poolConfig = loadPoolConfig(pool);

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

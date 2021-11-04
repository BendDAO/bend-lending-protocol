import { task } from "hardhat/config";
import { waitForTx } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getBNFTRegistryProxy } from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { ZERO_ADDRESS } from "../../helpers/constants";
import { deployGenericBNFTImpl } from "../../helpers/contracts-deployments";

task("full:deploy-bnft-tokens", "Deploy bnft tokens for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const network = <eNetwork>DRE.network.name;

    const poolConfig = loadPoolConfig(pool);

    const bnftRegistryProxy = await getBNFTRegistryProxy();

    const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);

    const bnftGenericImpl = await deployGenericBNFTImpl(verify);

    for (const [assetSymbol, assetAddress] of Object.entries(nftsAssets) as [string, string][]) {
      const bnftAddresses = await bnftRegistryProxy.getBNFTAddresses(assetAddress);
      if (bnftAddresses.bNftProxy != undefined && bnftAddresses.bNftProxy != ZERO_ADDRESS) {
        console.log("\tDeploying new %s implementation...", assetSymbol);
        await waitForTx(await bnftRegistryProxy.createBNFT(assetAddress, []));
      } else {
        console.log("\tUpgrading exist %s implementation...", assetSymbol);
        await waitForTx(await bnftRegistryProxy.upgradeBNFTWithImpl(assetAddress, bnftGenericImpl.address, []));
      }
    }
  });

import { task } from "hardhat/config";
import { waitForTx, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eNetwork, eContractid } from "../../helpers/types";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getPoolOwnerSigner, getBNFTRegistryProxy } from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { ZERO_ADDRESS } from "../../helpers/constants";
import { deployGenericBNFTImpl } from "../../helpers/contracts-deployments";
import { BNFTRegistry } from "../../types";

task("full:deploy-bnft-tokens", "Deploy bnft tokens for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    const network = <eNetwork>DRE.network.name;
    const ownerSigner = await getPoolOwnerSigner();

    const poolConfig = loadPoolConfig(pool);

    let bnftRegistryProxy: BNFTRegistry;
    // try to get from config
    let bnftRegistryProxyAddress = getParamPerNetwork(poolConfig.BNFTRegistry, network);
    if (bnftRegistryProxyAddress != undefined && notFalsyOrZeroAddress(bnftRegistryProxyAddress)) {
      bnftRegistryProxy = await getBNFTRegistryProxy(bnftRegistryProxyAddress);
    } else {
      // get from db
      bnftRegistryProxy = await getBNFTRegistryProxy();
    }

    const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);

    const bnftGenericImpl = await deployGenericBNFTImpl(verify);

    for (const [assetSymbol, assetAddress] of Object.entries(nftsAssets) as [string, string][]) {
      let bnftAddresses = await bnftRegistryProxy.getBNFTAddresses(assetAddress);
      if (bnftAddresses.bNftProxy == undefined || !notFalsyOrZeroAddress(bnftAddresses.bNftProxy)) {
        console.log("Deploying new BNFT implementation for %s...", assetSymbol);
        await waitForTx(await bnftRegistryProxy.createBNFT(assetAddress, []));
      } else {
        console.log("Upgrading exist BNFT implementation for %s", assetSymbol);
        await waitForTx(
          await bnftRegistryProxy.connect(ownerSigner).upgradeBNFTWithImpl(assetAddress, bnftGenericImpl.address, [])
        );
      }
      bnftAddresses = await bnftRegistryProxy.getBNFTAddresses(assetAddress);
      console.log(
        "BNFT %s: asset.address:%s, proxy.address: %s, implementation.address: %s",
        assetSymbol,
        assetAddress,
        bnftAddresses.bNftProxy,
        bnftAddresses.bNftImpl
      );
    }
  });

import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import {
  getBNFT,
  getLendPoolAddressesProvider,
  getBendUpgradeableProxy,
  getBNFTRegistryProxy,
  getBNFTRegistryImpl,
  getLendPool,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork, verifyContract } from "../../helpers/contracts-helpers";
import { eContractid, eNetwork, ICommonConfiguration, IReserveParams } from "../../helpers/types";

task("verify:nfts", "Verify nfts contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, all, pool }, localDRE) => {
    await localDRE.run("set-DRE");
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const { NftsAssets, NftsConfig } = poolConfig as ICommonConfiguration;

    const addressesProvider = await getLendPoolAddressesProvider();

    const lendPoolProxy = await getLendPool(await addressesProvider.getLendPool());

    const bnftRegistryAddress = await addressesProvider.getBNFTRegistry();
    const bnftRegistryProxy = await getBendUpgradeableProxy(bnftRegistryAddress);
    const bnftRegistryImpl = await getBNFTRegistryImpl();
    const bnftRegistry = await getBNFTRegistryProxy(bnftRegistryAddress);

    const bnftGenericImpl = await getBNFT(await bnftRegistry.bNftGenericImpl());

    // BNFTRegistry proxy
    console.log("\n- Verifying BNFT Registry Proxy...\n");
    await verifyContract(eContractid.BendUpgradeableProxy, bnftRegistryProxy, [
      bnftRegistryImpl.address,
      addressesProvider.address,
      bnftRegistryImpl.interface.encodeFunctionData("initialize", [
        bnftGenericImpl.address,
        poolConfig.Mocks.BNftNamePrefix,
        poolConfig.Mocks.BNftSymbolPrefix,
      ]),
    ]);

    // BNFT generic implementation
    console.log("\n- Verifying BNFT Generic Implementation...\n");
    await verifyContract(eContractid.BNFT, bnftGenericImpl, []);

    const configs = Object.entries(NftsConfig) as [string, IReserveParams][];
    for (const entry of Object.entries(getParamPerNetwork(NftsAssets, network))) {
      const [token, tokenAddress] = entry;
      console.log(`- Verifying ${token} token related contracts`);

      const tokenConfig = configs.find(([symbol]) => symbol === token);
      if (!tokenConfig) {
        throw `NftsConfig not found for ${token} token`;
      }

      const { bNftAddress } = await lendPoolProxy.getNftData(tokenAddress);
      //const { bNftProxy, bNftImpl } = await bnftRegistry.getBNFTAddresses(tokenAddress);

      // BNFT proxy for each nft asset
      console.log("\n- Verifying BNFT Proxy...\n");
      await verifyContract(eContractid.BendUpgradeableProxy, await getBendUpgradeableProxy(bNftAddress), [
        bnftRegistry.address,
      ]);
    }
  });

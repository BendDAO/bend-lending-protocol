import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import { ZERO_ADDRESS } from "../../helpers/constants";
import {
  getAddressById,
  getBNFT,
  getFirstSigner,
  getLendPoolAddressesProvider,
  getProxy,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork, verifyContract } from "../../helpers/contracts-helpers";
import { eContractid, eNetwork, ICommonConfiguration, IReserveParams } from "../../helpers/types";
import { LendPoolFactory, BNFTRegistryFactory } from "../../types";

task("verify:nfts", "Verify nfts contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, all, pool }, localDRE) => {
    await localDRE.run("set-DRE");
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const { NftsAssets, NftsConfig } = poolConfig as ICommonConfiguration;

    const addressesProvider = await getLendPoolAddressesProvider();

    const lendPoolProxy = LendPoolFactory.connect(await addressesProvider.getLendPool(), await getFirstSigner());

    const bnftRegistry = BNFTRegistryFactory.connect(await addressesProvider.getBNFTRegistry(), await getFirstSigner());

    const configs = Object.entries(NftsConfig) as [string, IReserveParams][];
    for (const entry of Object.entries(getParamPerNetwork(NftsAssets, network))) {
      const [token, tokenAddress] = entry;
      console.log(`- Verifying ${token} token related contracts`);
      const { bNftAddress } = await lendPoolProxy.getNftData(tokenAddress);

      const tokenConfig = configs.find(([symbol]) => symbol === token);
      if (!tokenConfig) {
        throw `NftsConfig not found for ${token} token`;
      }

      // Proxy bNFT
      console.log("\n- Verifying BNFT proxy...\n");
      await verifyContract(eContractid.InitializableAdminProxy, await getProxy(bNftAddress), [bnftRegistry.address]);

      const bNFT = await getAddressById(`b${token}`);
      if (bNFT) {
        console.log("\n- Verifying BNFT...\n");
        await verifyContract(eContractid.BNFT, await getBNFT(bNFT), [
          bnftRegistry.address,
          tokenAddress,
          bnftRegistry.namePrefix() + " " + token,
          bnftRegistry.symbolPrefix() + " " + token,
          [],
        ]);
      } else {
        console.error(`Skipping BNFT verify for ${token}. Missing address at JSON DB.`);
      }
    }
  });

import { task } from "hardhat/config";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { deployNFTOracle } from "../../helpers/contracts-deployments";
import { ICommonConfiguration, eNetwork, SymbolMap } from "../../helpers/types";
import { waitForTx, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig, getGenesisPoolAdmin } from "../../helpers/configuration";
import { getNFTOracle, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { NFTOracle } from "../../types";

task("full:deploy-oracle-nft", "Deploy nft oracle for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    try {
      await DRE.run("set-DRE");
      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {
        ProtocolGlobalParams: { UsdAddress },
        NftsAssets,
      } = poolConfig as ICommonConfiguration;

      const addressesProvider = await getLendPoolAddressesProvider();
      const admin = await getGenesisPoolAdmin(poolConfig);
      const nftOracleAddress = getParamPerNetwork(poolConfig.NFTOracle, network);
      const nftsAssets = await getParamPerNetwork(NftsAssets, network);

      const tokens = Object.entries(nftsAssets).map(([tokenSymbol, tokenAddress]) => {
        return tokenAddress;
      }) as string[];

      let nftOracle: NFTOracle;

      if (notFalsyOrZeroAddress(nftOracleAddress)) {
        nftOracle = await getNFTOracle(nftOracleAddress);
        await waitForTx(await nftOracle.setAssets(tokens));
      } else {
        nftOracle = await deployNFTOracle(verify);
        await waitForTx(await nftOracle.setAssets(tokens));
      }

      console.log("NFT Oracle: %s", nftOracle.address);

      // Register the proxy oracle on the addressesProvider
      await waitForTx(await addressesProvider.setNFTOracle(nftOracle.address));
    } catch (error) {
      throw error;
    }
  });

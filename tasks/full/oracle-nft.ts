import { task } from "hardhat/config";
import { getParamPerNetwork, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { deployBendUpgradeableProxy, deployNFTOracle } from "../../helpers/contracts-deployments";
import { ICommonConfiguration, eNetwork, eContractid } from "../../helpers/types";
import { waitForTx, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig, getGenesisPoolAdmin } from "../../helpers/configuration";
import {
  getNFTOracle,
  getLendPoolAddressesProvider,
  getBendUpgradeableProxy,
  getBendProxyAdminById,
} from "../../helpers/contracts-getters";
import { NFTOracle, BendUpgradeableProxy } from "../../types";

task("full:deploy-oracle-nft", "Deploy nft oracle for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addFlag("skipOracle", "Skip deploy oracles")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, skipOracle, pool }, DRE) => {
    try {
      await DRE.run("set-DRE");
      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const { NftsAssets } = poolConfig as ICommonConfiguration;

      const addressesProvider = await getLendPoolAddressesProvider();
      const nftOracleAddress = getParamPerNetwork(poolConfig.NFTOracle, network);

      if (skipOracle) {
        if (nftOracleAddress == undefined || !notFalsyOrZeroAddress(nftOracleAddress)) {
          throw Error("Invalid NFT Oracle address in pool config");
        }
        console.log("Reuse existed nft oracle proxy:", nftOracleAddress);
        await waitForTx(await addressesProvider.setNFTOracle(nftOracleAddress));
        return;
      }

      const poolAdmin = await getGenesisPoolAdmin(poolConfig);
      const proxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminPool);
      const proxyOwnerAddress = await proxyAdmin.owner();

      const nftsAssets = getParamPerNetwork(NftsAssets, network);

      const tokens = Object.entries(nftsAssets).map(([tokenSymbol, tokenAddress]) => {
        return tokenAddress;
      }) as string[];

      const nftOracleImpl = await deployNFTOracle(verify);
      const initEncodedData = nftOracleImpl.interface.encodeFunctionData("initialize", [poolAdmin]);

      let nftOracle: NFTOracle;
      let nftOracleProxy: BendUpgradeableProxy;

      if (nftOracleAddress != undefined && notFalsyOrZeroAddress(nftOracleAddress)) {
        console.log("Upgrading exist nft oracle proxy to new implementation...");

        await insertContractAddressInDb(eContractid.NFTOracle, nftOracleAddress);

        nftOracleProxy = await getBendUpgradeableProxy(nftOracleAddress);

        // only proxy admin can do upgrading
        const ownerSigner = DRE.ethers.provider.getSigner(proxyOwnerAddress);
        await waitForTx(await proxyAdmin.connect(ownerSigner).upgrade(nftOracleProxy.address, nftOracleImpl.address));

        nftOracle = await getNFTOracle(nftOracleProxy.address);
      } else {
        console.log("Deploying new nft oracle proxy & implementation...");

        nftOracleProxy = await deployBendUpgradeableProxy(
          eContractid.NFTOracle,
          proxyAdmin.address,
          nftOracleImpl.address,
          initEncodedData,
          verify
        );

        nftOracle = await getNFTOracle(nftOracleProxy.address);

        const poolAdminSigner = DRE.ethers.provider.getSigner(poolAdmin);
        await waitForTx(await nftOracle.connect(poolAdminSigner).setAssets(tokens));
      }

      // Register the proxy oracle on the addressesProvider
      await waitForTx(await addressesProvider.setNFTOracle(nftOracle.address));

      console.log("NFT Oracle: proxy %s, implementation %s", nftOracle.address, nftOracleImpl.address);
    } catch (error) {
      throw error;
    }
  });

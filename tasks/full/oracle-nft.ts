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
import { BigNumber as BN } from "ethers";

task("full:deploy-oracle-nft", "Deploy nft oracle for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("skipOracle", "Skip deploy oracles")
  .addFlag("skipProvider", "Skip set oracles to address provider")
  .addOptionalParam("feedAdmin", "Address of price feed")
  .setAction(async ({ verify, pool, skipOracle, skipProvider, feedAdmin }, DRE) => {
    try {
      await DRE.run("set-DRE");
      await DRE.run("compile");

      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const { NftsAssets } = poolConfig as ICommonConfiguration;

      const nftOracleAddress = getParamPerNetwork(poolConfig.NFTOracle, network);

      if (skipOracle) {
        if (nftOracleAddress == undefined || !notFalsyOrZeroAddress(nftOracleAddress)) {
          throw Error("Invalid NFT Oracle address in pool config");
        }
        console.log("Reuse existed nft oracle proxy:", nftOracleAddress);
        const addressesProvider = await getLendPoolAddressesProvider();
        await waitForTx(await addressesProvider.setNFTOracle(nftOracleAddress));
        return;
      }

      const proxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminPool);
      if (proxyAdmin == undefined || !notFalsyOrZeroAddress(proxyAdmin.address)) {
        throw Error("Invalid pool proxy admin in config");
      }
      const proxyAdminOwnerAddress = await proxyAdmin.owner();
      const proxyAdminOwnerSigner = DRE.ethers.provider.getSigner(proxyAdminOwnerAddress);

      if (feedAdmin == undefined || !notFalsyOrZeroAddress(feedAdmin)) {
        feedAdmin = await getGenesisPoolAdmin(poolConfig);
      }

      const nftsAssets = getParamPerNetwork(NftsAssets, network);

      const tokens = Object.entries(nftsAssets).map(([tokenSymbol, tokenAddress]) => {
        return tokenAddress;
      }) as string[];

      const nftOracleImpl = await deployNFTOracle(verify);
      const initEncodedData = nftOracleImpl.interface.encodeFunctionData("initialize", [
        feedAdmin,
        BN.from(2).mul(BN.from(10).pow(17)), //2e17
        BN.from(1).mul(BN.from(10).pow(17)), //1e17
        1800,
        600,
        21600,
      ]);

      let nftOracle: NFTOracle;
      let nftOracleProxy: BendUpgradeableProxy;

      if (nftOracleAddress != undefined && notFalsyOrZeroAddress(nftOracleAddress)) {
        console.log("Upgrading exist nft oracle proxy to new implementation...");

        await insertContractAddressInDb(eContractid.NFTOracle, nftOracleAddress);

        nftOracleProxy = await getBendUpgradeableProxy(nftOracleAddress);

        // only proxy admin can do upgrading
        await waitForTx(
          await proxyAdmin.connect(proxyAdminOwnerSigner).upgrade(nftOracleProxy.address, nftOracleImpl.address)
        );

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

        // only oracle owner can add assets
        const oracleOwnerAddress = await nftOracle.owner();
        const oracleOwnerSigner = DRE.ethers.provider.getSigner(oracleOwnerAddress);
        await waitForTx(await nftOracle.connect(oracleOwnerSigner).setAssets(tokens));
      }

      // Register the proxy oracle on the addressesProvider
      if (!skipProvider) {
        const addressesProvider = await getLendPoolAddressesProvider();
        await waitForTx(await addressesProvider.setNFTOracle(nftOracle.address));
      }

      console.log("NFT Oracle: proxy %s, implementation %s", nftOracle.address, nftOracleImpl.address);
    } catch (error) {
      throw error;
    }
  });

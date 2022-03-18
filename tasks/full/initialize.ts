import { task } from "hardhat/config";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { loadPoolConfig, ConfigNames, getTreasuryAddress } from "../../helpers/configuration";
import { getWETHGateway, getPunkGateway } from "../../helpers/contracts-getters";
import { eNetwork, ICommonConfiguration } from "../../helpers/types";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import {
  initReservesByHelper,
  configureReservesByHelper,
  initNftsByHelper,
  configureNftsByHelper,
} from "../../helpers/init-helpers";
import { exit } from "process";
import { getLendPoolAddressesProvider } from "../../helpers/contracts-getters";

task("full:initialize-lend-pool", "Initialize lend pool configuration.")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    try {
      await localBRE.run("set-DRE");
      const network = <eNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);

      const addressesProvider = await getLendPoolAddressesProvider();

      const admin = await addressesProvider.getPoolAdmin();

      const treasuryAddress = await getTreasuryAddress(poolConfig);

      //////////////////////////////////////////////////////////////////////////
      console.log("Init & Config Reserve assets");
      const reserveAssets = getParamPerNetwork(poolConfig.ReserveAssets, network);
      if (!reserveAssets) {
        throw "Reserve assets is undefined. Check ReserveAssets configuration at config directory";
      }

      await initReservesByHelper(
        poolConfig.ReservesConfig,
        reserveAssets,
        poolConfig.BTokenNamePrefix,
        poolConfig.BTokenSymbolPrefix,
        poolConfig.DebtTokenNamePrefix,
        poolConfig.DebtTokenSymbolPrefix,
        admin,
        treasuryAddress,
        pool,
        verify
      );
      await configureReservesByHelper(poolConfig.ReservesConfig, reserveAssets, admin);

      //////////////////////////////////////////////////////////////////////////
      console.log("Init & Config NFT assets");
      const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);
      if (!nftsAssets) {
        throw "NFT assets is undefined. Check NftsAssets configuration at config directory";
      }

      await initNftsByHelper(poolConfig.NftsConfig, nftsAssets, admin, pool, verify);
      await configureNftsByHelper(poolConfig.NftsConfig, nftsAssets, admin);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

task("full:initialize-gateway", "Initialize gateway configuration.")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    try {
      await localBRE.run("set-DRE");
      const network = <eNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);

      const reserveAssets = getParamPerNetwork(poolConfig.ReserveAssets, network);
      if (!reserveAssets) {
        throw "Reserve assets is undefined. Check ReserveAssets configuration at config directory";
      }

      const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);
      if (!nftsAssets) {
        throw "NFT assets is undefined. Check NftsAssets configuration at config directory";
      }

      const wethGateway = await getWETHGateway();
      let nftAddresses: string[] = [];
      for (const [assetSymbol, assetAddress] of Object.entries(nftsAssets) as [string, string][]) {
        nftAddresses.push(assetAddress);
      }
      console.log("WETHGateway: authorizeLendPoolNFT:", nftAddresses);
      await waitForTx(await wethGateway.authorizeLendPoolNFT(nftAddresses));

      const punkGateway = await getPunkGateway();
      let reserveAddresses: string[] = [];
      for (const [assetSymbol, assetAddress] of Object.entries(reserveAssets) as [string, string][]) {
        reserveAddresses.push(assetAddress);
      }
      console.log("PunkGateway: authorizeLendPoolERC20:", reserveAddresses);
      await waitForTx(await punkGateway.authorizeLendPoolERC20(reserveAddresses));
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

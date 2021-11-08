import { task } from "hardhat/config";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import {
  deployBendProtocolDataProvider,
  deployWalletBalancerProvider,
  //deployUiPoolDataProvider,
  authorizeWETHGateway,
  authorizeWETHGatewayNFT,
  authorizePunkGateway,
  authorizePunkGatewayERC20,
} from "../../helpers/contracts-deployments";
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

      const incentivesController = getParamPerNetwork(poolConfig.IncentivesController, network);
      const addressesProvider = await getLendPoolAddressesProvider();

      const admin = await addressesProvider.getPoolAdmin();

      const treasuryAddress = await getTreasuryAddress(poolConfig);

      //////////////////////////////////////////////////////////////////////////
      // Init & Config Reserve assets
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
        incentivesController,
        pool,
        verify
      );
      await configureReservesByHelper(poolConfig.ReservesConfig, reserveAssets, admin);

      //////////////////////////////////////////////////////////////////////////
      // Init & Config NFT assets
      const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);
      if (!nftsAssets) {
        throw "NFT assets is undefined. Check NftsAssets configuration at config directory";
      }

      await initNftsByHelper(
        poolConfig.NftsConfig,
        nftsAssets,
        poolConfig.BNftNamePrefix,
        poolConfig.BNftSymbolPrefix,
        admin,
        pool,
        verify
      );
      await configureNftsByHelper(poolConfig.NftsConfig, nftsAssets, admin);

      //////////////////////////////////////////////////////////////////////////
      // Deploy wallet & data & ui provider for backend
      const reserveOracle = await addressesProvider.getReserveOracle();
      const nftOracle = await addressesProvider.getNFTOracle();

      const walletBalanceProvider = await deployWalletBalancerProvider(verify);
      console.log("WalletBalancerProvider deployed at:", walletBalanceProvider.address);

      // this contract is not support upgrade, just deploy new contract
      const bendProtocolDataProvider = await deployBendProtocolDataProvider(addressesProvider.address, verify);
      console.log("BendProtocolDataProvider deployed at:", bendProtocolDataProvider.address);

      /*
      const uiPoolDataProvider = await deployUiPoolDataProvider(
        [incentivesController, reserveOracle, nftOracle],
        verify
      );
      console.log('UiPoolDataProvider deployed at:', uiPoolDataProvider.address);
      */

      //////////////////////////////////////////////////////////////////////////
      // Init & Config Gateways
      const lendPoolAddress = await addressesProvider.getLendPool();

      let wethGatewayAddress = getParamPerNetwork(poolConfig.WethGateway, network);
      if (!notFalsyOrZeroAddress(wethGatewayAddress)) {
        wethGatewayAddress = (await getWETHGateway()).address;
      }
      await authorizeWETHGateway(wethGatewayAddress, lendPoolAddress);
      for (const [assetSymbol, assetAddress] of Object.entries(nftsAssets) as [string, string][]) {
        await authorizeWETHGatewayNFT(wethGatewayAddress, lendPoolAddress, assetAddress);
      }

      let punkGatewayAddress = getParamPerNetwork(poolConfig.PunkGateway, network);
      if (!notFalsyOrZeroAddress(punkGatewayAddress)) {
        punkGatewayAddress = (await getPunkGateway()).address;
      }
      await authorizePunkGateway(punkGatewayAddress, lendPoolAddress, wethGatewayAddress);
      for (const [assetSymbol, assetAddress] of Object.entries(reserveAssets) as [string, string][]) {
        await authorizePunkGatewayERC20(punkGatewayAddress, lendPoolAddress, assetAddress);
      }
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

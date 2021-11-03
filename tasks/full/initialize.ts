import { task } from "hardhat/config";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import {
  deployWalletBalancerProvider,
  authorizeWETHGateway,
  //deployUiPoolDataProvider,
} from "../../helpers/contracts-deployments";
import { loadPoolConfig, ConfigNames, getTreasuryAddress } from "../../helpers/configuration";
import { getWETHGateway } from "../../helpers/contracts-getters";
import { eNetwork, ICommonConfiguration } from "../../helpers/types";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { initReservesByHelper, configureReservesByHelper } from "../../helpers/init-helpers";
import { exit } from "process";
import { getBendProtocolDataProvider, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { ZERO_ADDRESS } from "../../helpers/constants";

task("full:initialize-lend-pool", "Initialize lend pool configuration.")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    try {
      await localBRE.run("set-DRE");
      const network = <eNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const { BTokenNamePrefix, BTokenSymbolPrefix, ReserveAssets, ReservesConfig, WethGateway, IncentivesController } =
        poolConfig as ICommonConfiguration;

      //////////////////////////////////////////////////////////////////////////
      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
      const incentivesController = await getParamPerNetwork(IncentivesController, network);
      const addressesProvider = await getLendPoolAddressesProvider();

      const dataProvider = await getBendProtocolDataProvider();

      const admin = await addressesProvider.getPoolAdmin();
      const reserveOracle = await addressesProvider.getReserveOracle();

      if (!reserveAssets) {
        throw "Reserve assets is undefined. Check ReserveAssets configuration at config directory";
      }

      const treasuryAddress = await getTreasuryAddress(poolConfig);

      await initReservesByHelper(
        ReservesConfig,
        reserveAssets,
        BTokenNamePrefix,
        BTokenSymbolPrefix,
        admin,
        treasuryAddress,
        incentivesController,
        pool,
        verify
      );
      await configureReservesByHelper(ReservesConfig, reserveAssets, dataProvider, admin);

      //////////////////////////////////////////////////////////////////////////
      const bendProtocolDataProvider = await getBendProtocolDataProvider();
      await waitForTx(
        await addressesProvider.setAddress(
          "0x0100000000000000000000000000000000000000000000000000000000000000",
          bendProtocolDataProvider.address
        )
      );

      await deployWalletBalancerProvider(verify);

      /*
      const uiPoolDataProvider = await deployUiPoolDataProvider(
        [incentivesController, oracle],
        verify
      );
      console.log('UiPoolDataProvider deployed at:', uiPoolDataProvider.address);
      */

      //////////////////////////////////////////////////////////////////////////
      const lendPoolAddress = await addressesProvider.getLendPool();

      let gateWay = getParamPerNetwork(WethGateway, network);
      if (!notFalsyOrZeroAddress(gateWay)) {
        gateWay = (await getWETHGateway()).address;
      }
      await authorizeWETHGateway(gateWay, lendPoolAddress);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

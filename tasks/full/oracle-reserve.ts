import { task } from "hardhat/config";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { deployReserveOracle } from "../../helpers/contracts-deployments";
import { ICommonConfiguration, eNetwork, SymbolMap } from "../../helpers/types";
import { waitForTx, notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig, getGenesisPoolAdmin } from "../../helpers/configuration";
import {
  getReserveOracle,
  getLendPoolAddressesProvider,
  getPairsTokenAggregator,
} from "../../helpers/contracts-getters";
import { ReserveOracle } from "../../types";

task("full:deploy-oracle-reserve", "Deploy reserve oracle for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    try {
      await DRE.run("set-DRE");
      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const { ReserveAssets, ReserveAggregator } = poolConfig as ICommonConfiguration;

      const addressesProvider = await getLendPoolAddressesProvider();
      const admin = await getGenesisPoolAdmin(poolConfig);
      const reserveOracleAddress = getParamPerNetwork(poolConfig.ReserveOracle, network);
      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
      const reserveAggregators = await getParamPerNetwork(ReserveAggregator, network);

      const [tokens, aggregators] = getPairsTokenAggregator(
        reserveAssets,
        reserveAggregators,
        poolConfig.OracleQuoteCurrency
      );

      let reserveOracle: ReserveOracle;

      if (notFalsyOrZeroAddress(reserveOracleAddress)) {
        reserveOracle = await getReserveOracle(reserveOracleAddress);
        await waitForTx(await reserveOracle.setAggregators(tokens, aggregators));
      } else {
        reserveOracle = await deployReserveOracle([], verify);
        await waitForTx(await reserveOracle.setAggregators(tokens, aggregators));
      }

      console.log("Reserve Oracle: %s", reserveOracle.address);

      // Register the proxy oracle on the addressesProvider
      await waitForTx(await addressesProvider.setReserveOracle(reserveOracle.address));
    } catch (error) {
      throw error;
    }
  });

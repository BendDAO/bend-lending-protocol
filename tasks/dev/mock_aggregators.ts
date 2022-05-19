import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import {
  deployAllReservesMockAggregatorsInPoolConfig,
  deployChainlinkMockAggregator,
} from "../../helpers/oracles-helpers";

task("dev:deploy-all-mock-aggregators", "Deploy all mock aggregators for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const poolConfig = loadPoolConfig(pool);

    const allAggregatorsAddresses = await deployAllReservesMockAggregatorsInPoolConfig(poolConfig, verify);

    console.log("allAggregatorsAddresses:", allAggregatorsAddresses);
  });

task("dev:deploy-mock-aggregator", "Deploy one mock aggregator for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("name", "token name")
  .addParam("decimals", "token decimals")
  .addParam("price", "init price")
  .setAction(async ({ verify, pool, name, decimals, price }, localBRE) => {
    await localBRE.run("set-DRE");

    const poolConfig = loadPoolConfig(pool);

    const mockAgg = await deployChainlinkMockAggregator(name, decimals, price, verify);

    console.log("Aggregator address:", mockAgg.address);
  });

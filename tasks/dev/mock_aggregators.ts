import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployAllReservesMockAggregatorsInPoolConfig } from "../../helpers/oracles-helpers";

task("dev:deploy-mock-aggregators", "Deploy mock aggregators for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const poolConfig = loadPoolConfig(pool);

    const allAggregatorsAddresses = await deployAllReservesMockAggregatorsInPoolConfig(poolConfig, verify);

    console.log("allAggregatorsAddresses:", allAggregatorsAddresses);
  });

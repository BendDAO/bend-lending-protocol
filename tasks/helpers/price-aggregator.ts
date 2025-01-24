import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { eContractid, eNetwork } from "../../helpers/types";
import { deployWstETHPriceAggregator } from "../../helpers/contracts-deployments";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { getEthersSignerByAddress } from "../../helpers/contracts-helpers";

task("helpers:deploy:WstETHPriceAggregator", "Add and config new price aggregator")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("stethagg", "Address of stETH-ETH aggregator contract")
  .addParam("wsteth", "Address of wstETH token contract")
  .setAction(async ({ verify, pool, stethagg, wsteth }, DRE) => {
    await DRE.run("set-DRE");
    await DRE.run("compile");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    const aggregator = await deployWstETHPriceAggregator(stethagg, wsteth, verify);
    console.log("Aggregator address:", aggregator.address);
  });

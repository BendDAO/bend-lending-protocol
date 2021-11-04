import { task } from "hardhat/config";
import { eEthereumNetwork } from "../../helpers/types";
import * as marketConfigs from "../../markets/bend";
import * as reserveConfigs from "../../markets/bend/reservesConfigs";
import { getLendPoolAddressesProvider } from "./../../helpers/contracts-getters";
import { chooseBTokenDeployment, deployInterestRate } from "./../../helpers/contracts-deployments";
import { setDRE } from "../../helpers/misc-utils";

const LEND_POOL_ADDRESS_PROVIDER = {
  main: "",
  rinkeby: "",
};

const isSymbolValid = (symbol: string, network: eEthereumNetwork) =>
  Object.keys(reserveConfigs).includes("strategy" + symbol) &&
  marketConfigs.BendConfig.ReserveAssets[network][symbol] &&
  marketConfigs.BendConfig.ReservesConfig[symbol] === reserveConfigs["strategy" + symbol];

task("external:deploy-new-reserve", "Deploy new BToken, Risk Parameters")
  .addParam("symbol", `Reserve symbol, needs to have configuration ready`)
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify, symbol }, localBRE) => {
    const network = localBRE.network.name;
    if (!isSymbolValid(symbol, network as eEthereumNetwork)) {
      throw new Error(
        `
WRONG RESERVE ASSET SETUP:
        The symbol ${symbol} has no reserve config and/or reserve asset setup.
        update /markets/bend/index.ts and add the asset address for ${network} network
        update /markets/bend/reservesConfigs.ts and add parameters for ${symbol}
        `
      );
    }
    setDRE(localBRE);

    const addressProvider = await getLendPoolAddressesProvider(LEND_POOL_ADDRESS_PROVIDER[network]);

    const strategyParams = reserveConfigs["strategy" + symbol];
    const deployCustomBToken = chooseBTokenDeployment(strategyParams.bTokenImpl);
    const bToken = await deployCustomBToken(verify);

    const rates = await deployInterestRate(
      [
        addressProvider.address,
        strategyParams.strategy.optimalUtilizationRate,
        strategyParams.strategy.baseVariableBorrowRate,
        strategyParams.strategy.variableRateSlope1,
        strategyParams.strategy.variableRateSlope2,
      ],
      verify
    );

    console.log(`
    New Reserve asset deployed on ${network}:
    Reserve Implementation for b${symbol} address: ${bToken.address}
    Interest Rate Implementation for ${symbol} address: ${rates.address}
    `);
  });

import { task } from "hardhat/config";
import { eEthereumNetwork } from "../../helpers/types";
import * as marketConfigs from "../../markets/bend";
import * as reserveConfigs from "../../markets/bend/reservesConfigs";
import { getBNFTRegistryProxy, getLendPoolAddressesProvider } from "./../../helpers/contracts-getters";
import { chooseBNFTDeployment } from "./../../helpers/contracts-deployments";
import { setDRE } from "../../helpers/misc-utils";

const BNFT_REGISTRY = {
  main: "",
  rinkeby: "",
};

const isSymbolValid = (symbol: string, network: eEthereumNetwork) =>
  Object.keys(reserveConfigs).includes("strategy" + symbol) &&
  marketConfigs.BendConfig.NftsAssets[network][symbol] &&
  marketConfigs.BendConfig.NftsConfig[symbol] === reserveConfigs["strategy" + symbol];

task("external:deploy-new-nft", "Deploy new BNFT, Risk Parameters")
  .addParam("symbol", `nft symbol, needs to have configuration ready`)
  .addFlag("verify", "Verify contracts at Etherscan")
  .setAction(async ({ verify, symbol }, localBRE) => {
    const network = localBRE.network.name;
    if (!isSymbolValid(symbol, network as eEthereumNetwork)) {
      throw new Error(
        `
WRONG NFT ASSET SETUP:
        The symbol ${symbol} has no nft config and/or nft asset setup.
        update /markets/bend/index.ts and add the asset address for ${network} network
        update /markets/bend/reservesConfigs.ts and add parameters for ${symbol}
        `
      );
    }
    setDRE(localBRE);

    const strategyParams = reserveConfigs["strategy" + symbol];

    const deployCustomBNFT = chooseBNFTDeployment(strategyParams.bNftImpl);

    const bNFT = await deployCustomBNFT(verify);

    console.log(`
    New NFT asset deployed on ${network}:
    BNFT Implementation for b${symbol} address: ${bNFT.address}
    `);
  });

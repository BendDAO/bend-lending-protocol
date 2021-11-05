import { task } from "hardhat/config";
import {
  loadPoolConfig,
  ConfigNames,
  getWrappedPunkTokenAddress,
  getCryptoPunksMarketAddress,
} from "../../helpers/configuration";
import { deployPunkGateway } from "../../helpers/contracts-deployments";

task(`full:deploy-punk-gateway`, `Deploys the PunkGateway contract`)
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", `Verify contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    if (!localBRE.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }

    const poolConfig = loadPoolConfig(pool);
    const punk = await getCryptoPunksMarketAddress(poolConfig);
    console.log("CryptoPunksMarket.address", punk);
    const wpunk = await getWrappedPunkTokenAddress(poolConfig, punk);
    console.log("WPUNKS.address", wpunk);

    const punkGateWay = await deployPunkGateway([punk, wpunk], verify);
    console.log("PunkGateway.address", punkGateWay.address);
    console.log("Finished PunkGateway deployment");
  });

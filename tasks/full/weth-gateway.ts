import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames, getWrappedNativeTokenAddress } from "../../helpers/configuration";
import { deployWETHGateway } from "../../helpers/contracts-deployments";

task(`full:deploy-weth-gateway`, `Deploys the WETHGateway contract`)
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", `Verify contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    if (!localBRE.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }

    const poolConfig = loadPoolConfig(pool);
    const weth = await getWrappedNativeTokenAddress(poolConfig);
    console.log("WETH.address", weth);

    const wethGateWay = await deployWETHGateway([weth], verify);
    console.log("WETHGateway.address", wethGateWay.address);
    console.log("Finished WETHGateway deployment");
  });

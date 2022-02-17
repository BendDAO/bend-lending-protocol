import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames, getWrappedNativeTokenAddress } from "../../helpers/configuration";
import { ADDRESS_ID_WETH_GATEWAY } from "../../helpers/constants";
import { deployWETHGateway } from "../../helpers/contracts-deployments";
import { getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { waitForTx } from "../../helpers/misc-utils";

task(`full:deploy-weth-gateway`, `Deploys the WETHGateway contract`)
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", `Verify contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    if (!localBRE.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const weth = await getWrappedNativeTokenAddress(poolConfig);
    console.log("WETH.address", weth);

    // this contract is not support upgrade, just deploy new contract
    const wethGateWay = await deployWETHGateway([addressesProvider.address, weth], verify);
    console.log("WETHGateway.address", wethGateWay.address);

    await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_WETH_GATEWAY, wethGateWay.address));
    console.log("Finished WETHGateway deployment");
  });

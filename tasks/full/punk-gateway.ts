import { task } from "hardhat/config";
import {
  loadPoolConfig,
  ConfigNames,
  getWrappedPunkTokenAddress,
  getCryptoPunksMarketAddress,
} from "../../helpers/configuration";
import { ADDRESS_ID_PUNK_GATEWAY } from "../../helpers/constants";
import { deployPunkGateway } from "../../helpers/contracts-deployments";
import { getLendPoolAddressesProvider, getWETHGateway } from "../../helpers/contracts-getters";
import { waitForTx } from "../../helpers/misc-utils";

task(`full:deploy-punk-gateway`, `Deploys the PunkGateway contract`)
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", `Verify contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    if (!localBRE.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();
    const wethGateWay = await getWETHGateway();

    const punk = await getCryptoPunksMarketAddress(poolConfig);
    console.log("CryptoPunksMarket.address", punk);

    const wpunk = await getWrappedPunkTokenAddress(poolConfig, punk);
    console.log("WPUNKS.address", wpunk);

    // this contract is not support upgrade, just deploy new contract
    const punkGateWay = await deployPunkGateway([addressesProvider.address, wethGateWay.address, punk, wpunk], verify);
    console.log("PunkGateway.address", punkGateWay.address);

    await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_PUNK_GATEWAY, punkGateWay.address));
    console.log("Finished PunkGateway deployment");
  });

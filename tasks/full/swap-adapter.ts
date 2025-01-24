import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import { deployBendUpgradeableProxy, deployUniswapV3DebtSwapAdapter } from "../../helpers/contracts-deployments";
import {
  getBendProxyAdminById,
  getBendUpgradeableProxy,
  getLendPoolAddressesProvider,
  getUniswapV3DebtSwapAdapter,
  getUniswapV3DebtSwapAdapterImpl,
} from "../../helpers/contracts-getters";
import { insertContractAddressInDb, tryGetContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork } from "../../helpers/types";
import { BendUpgradeableProxy, UniswapV3DebtSwapAdapter } from "../../types";

task(`full:deploy-uniswapv3-debtswap-adapter`, `Deploys the UniswapV3DebtSwapAdapter contract`)
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", `Verify contract via Etherscan API.`)
  .addParam("aaveAddressProvider", "The AAVE v2 address provider address")
  .addParam("swapRouter", "The Uniswap V3 swap router address")
  .setAction(async ({ verify, pool, aaveAddressProvider, swapRouter }, DRE) => {
    await DRE.run("set-DRE");
    await DRE.run("compile");

    if (!DRE.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const proxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminWTL);
    if (proxyAdmin == undefined || !notFalsyOrZeroAddress(proxyAdmin.address)) {
      throw Error("Invalid common proxy admin in config");
    }
    const proxyAdminOwnerAddress = await proxyAdmin.owner();
    const proxyAdminOwnerSigner = DRE.ethers.provider.getSigner(proxyAdminOwnerAddress);

    const swapAdapterId = eContractid.UniswapV3DebtSwapAdapter;
    // try find the existing proxy address first
    const swapAdapterAddress = await tryGetContractAddressInDb(swapAdapterId);

    console.log(`Deploying new ${swapAdapterId} implementation...`);
    const swapAdapterImpl = await deployUniswapV3DebtSwapAdapter(verify);

    const initEncodedData = swapAdapterImpl.interface.encodeFunctionData("initialize", [
      aaveAddressProvider,
      addressesProvider.address,
      swapRouter,
    ]);

    let swapAdapter: UniswapV3DebtSwapAdapter;
    let swapAdapterProxy: BendUpgradeableProxy;

    if (swapAdapterAddress != undefined && notFalsyOrZeroAddress(swapAdapterAddress)) {
      console.log(`Upgrading exist ${swapAdapterId} proxy to new implementation...`);

      await insertContractAddressInDb(swapAdapterId, swapAdapterAddress);
      swapAdapterProxy = await getBendUpgradeableProxy(swapAdapterAddress);

      // only proxy admin can do upgrading
      await waitForTx(
        await proxyAdmin.connect(proxyAdminOwnerSigner).upgrade(swapAdapterProxy.address, swapAdapterImpl.address)
      );

      swapAdapter = await getUniswapV3DebtSwapAdapter(swapAdapterProxy.address);
    } else {
      console.log(`Deploying new ${swapAdapterId} proxy with implementation...`);
      swapAdapterProxy = await deployBendUpgradeableProxy(
        swapAdapterId,
        proxyAdmin.address,
        swapAdapterImpl.address,
        initEncodedData,
        verify
      );

      swapAdapter = await getUniswapV3DebtSwapAdapter(swapAdapterProxy.address);
    }

    console.log(`${swapAdapterId}: proxy ${swapAdapter.address}, implementation ${swapAdapterImpl.address}`);

    console.log(`Finished ${swapAdapterId} deployment`);
  });

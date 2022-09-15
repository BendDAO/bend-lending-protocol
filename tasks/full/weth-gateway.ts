import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames, getWrappedNativeTokenAddress } from "../../helpers/configuration";
import { ADDRESS_ID_WETH_GATEWAY } from "../../helpers/constants";
import { deployBendUpgradeableProxy, deployWETHGateway } from "../../helpers/contracts-deployments";
import {
  getBendProxyAdminById,
  getBendUpgradeableProxy,
  getLendPoolAddressesProvider,
  getWETHGateway,
} from "../../helpers/contracts-getters";
import { insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork } from "../../helpers/types";
import { BendUpgradeableProxy, WETHGateway } from "../../types";

task(`full:deploy-weth-gateway`, `Deploys the WETHGateway contract`)
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", `Verify contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");
    await DRE.run("compile");

    if (!DRE.network.config.chainId) {
      throw new Error("INVALID_CHAIN_ID");
    }

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const proxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminPool);
    if (proxyAdmin == undefined || !notFalsyOrZeroAddress(proxyAdmin.address)) {
      throw Error("Invalid pool proxy admin in config");
    }
    const proxyAdminOwnerAddress = await proxyAdmin.owner();
    const proxyAdminOwnerSigner = DRE.ethers.provider.getSigner(proxyAdminOwnerAddress);

    const weth = await getWrappedNativeTokenAddress(poolConfig);
    console.log("WETH.address", weth);

    const wethGatewayImpl = await deployWETHGateway(verify);
    const initEncodedData = wethGatewayImpl.interface.encodeFunctionData("initialize", [
      addressesProvider.address,
      weth,
    ]);

    let wethGateWay: WETHGateway;
    let wethGatewayProxy: BendUpgradeableProxy;

    const wethGatewayAddress = undefined; //await addressesProvider.getAddress(ADDRESS_ID_WETH_GATEWAY);

    if (wethGatewayAddress != undefined && notFalsyOrZeroAddress(wethGatewayAddress)) {
      console.log("Upgrading exist WETHGateway proxy to new implementation...");

      await insertContractAddressInDb(eContractid.WETHGateway, wethGatewayAddress);
      wethGatewayProxy = await getBendUpgradeableProxy(wethGatewayAddress);

      // only proxy admin can do upgrading
      await waitForTx(
        await proxyAdmin.connect(proxyAdminOwnerSigner).upgrade(wethGatewayProxy.address, wethGatewayImpl.address)
      );

      wethGateWay = await getWETHGateway(wethGatewayProxy.address);
    } else {
      console.log("Deploying new WETHGateway proxy & implementation...");
      const wethGatewayProxy = await deployBendUpgradeableProxy(
        eContractid.WETHGateway,
        proxyAdmin.address,
        wethGatewayImpl.address,
        initEncodedData,
        verify
      );

      wethGateWay = await getWETHGateway(wethGatewayProxy.address);
    }

    await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_WETH_GATEWAY, wethGateWay.address));

    console.log("WETHGateway: proxy %s, implementation %s", wethGateWay.address, wethGatewayImpl.address);
    console.log("Finished WETHGateway deployment");
  });

task("full:wethgateway-authorize-caller-whitelist", "Initialize gateway configuration.")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("caller", "Address of whitelist")
  .addParam("flag", "Flag of whitelist, 0-1")
  .setAction(async ({ pool, caller, flag }, localBRE) => {
    await localBRE.run("set-DRE");
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const wethGateway = await getWETHGateway();

    console.log("WETHGateway:", wethGateway.address);
    await waitForTx(await wethGateway.authorizeCallerWhitelist([caller], flag));
  });

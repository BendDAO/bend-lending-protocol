import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import { deployBendUpgradeableProxy, deployWrapperGateway } from "../../helpers/contracts-deployments";
import {
  getBendProxyAdminById,
  getBendUpgradeableProxy,
  getLendPoolAddressesProvider,
  getWETHGateway,
  getWrapperGateway,
} from "../../helpers/contracts-getters";
import { insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork } from "../../helpers/types";
import { BendUpgradeableProxy, WrapperGateway } from "../../types";

task(`full:deploy-wrapper-gateway`, `Deploys the WrapperGateway contract`)
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", `Verify contract via Etherscan API.`)
  .addParam("gatewayid", "The wrapper gateway id")
  .addParam("underlying", "The underlying token address")
  .addParam("wrapper", "The wrapper token address")
  .setAction(async ({ verify, pool, gatewayid, underlying, wrapper }, DRE) => {
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

    const wethGateWay = await getWETHGateway();
    console.log("wethGateWay.address", wethGateWay.address);
    console.log("underlying.address", underlying);
    console.log("wrapper.address", wrapper);

    // this contract is not support upgrade, just deploy new contract
    console.log(`Deploying new ${gatewayid} implementation...`);
    const wrapperGateWayImpl = await deployWrapperGateway(gatewayid, verify);
    const initEncodedData = wrapperGateWayImpl.interface.encodeFunctionData("initialize", [
      addressesProvider.address,
      wethGateWay.address,
      underlying,
      wrapper,
    ]);

    let wrapperGateWay: WrapperGateway;
    let wrapperGatewayProxy: BendUpgradeableProxy;

    const wrapperGatewayAddress = undefined; //await addressesProvider.getAddress(ADDRESS_ID_XXX_GATEWAY);

    if (wrapperGatewayAddress != undefined && notFalsyOrZeroAddress(wrapperGatewayAddress)) {
      console.log(`Upgrading exist ${gatewayid} proxy to new implementation...`);

      await insertContractAddressInDb(gatewayid, wrapperGatewayAddress);
      wrapperGatewayProxy = await getBendUpgradeableProxy(wrapperGatewayAddress);

      // only proxy admin can do upgrading
      await waitForTx(
        await proxyAdmin.connect(proxyAdminOwnerSigner).upgrade(wrapperGatewayProxy.address, wrapperGateWayImpl.address)
      );

      wrapperGateWay = await getWrapperGateway(gatewayid, wrapperGatewayProxy.address);
    } else {
      console.log(`Deploying new ${gatewayid} proxy with implementation...`);
      const wrapperGatewayProxy = await deployBendUpgradeableProxy(
        gatewayid,
        proxyAdmin.address,
        wrapperGateWayImpl.address,
        initEncodedData,
        verify
      );

      wrapperGateWay = await getWrapperGateway(gatewayid, wrapperGatewayProxy.address);
    }

    //await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_XXX_GATEWAY, wrapperGateWay.address));

    console.log(`${gatewayid}: proxy ${wrapperGateWay.address}, implementation ${wrapperGateWayImpl.address}`);

    console.log(`Finished ${gatewayid} deployment`);
  });

task("full:wrapper-authorize-caller-whitelist", "Initialize gateway configuration.")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("id", "The wrapper gateway id")
  .addParam("caller", "Address of whitelist")
  .addParam("flag", "Flag of whitelist, 0-1")
  .setAction(async ({ pool, id, caller, flag }, localBRE) => {
    await localBRE.run("set-DRE");
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const wrapperGateWay = await getWrapperGateway(id);

    console.log(`${id}: ${wrapperGateWay.address}`);
    await waitForTx(await wrapperGateWay.authorizeCallerWhitelist([caller], flag));
  });

task("full:new-wrapper-gateway-impl", "New gateway impl.")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("id", "The wrapper gateway id")
  .addFlag("upgrade", "Upgrade contract")
  .setAction(async ({ pool, id, upgrade }, localBRE) => {
    await localBRE.run("set-DRE");
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const gatewayProxy = await getWrapperGateway(id);

    const gatewayImpl = await deployWrapperGateway(id, true);
    console.log(`${id}: proxy: ${gatewayProxy.address}, impl: ${gatewayImpl.address}`);

    if (upgrade) {
      await localBRE.run("dev:upgrade-implementation", {
        pool: pool,
        id,
        proxy: gatewayProxy,
        impl: gatewayImpl.address,
        admin: eContractid.BendProxyAdminWTL,
      });
    }
  });

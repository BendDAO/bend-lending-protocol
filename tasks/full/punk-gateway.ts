import { task } from "hardhat/config";
import {
  loadPoolConfig,
  ConfigNames,
  getWrappedPunkTokenAddress,
  getCryptoPunksMarketAddress,
} from "../../helpers/configuration";
import { ADDRESS_ID_PUNK_GATEWAY } from "../../helpers/constants";
import { deployBendUpgradeableProxy, deployPunkGateway } from "../../helpers/contracts-deployments";
import {
  getBendProxyAdminById,
  getBendUpgradeableProxy,
  getLendPoolAddressesProvider,
  getPunkGateway,
  getWETHGateway,
} from "../../helpers/contracts-getters";
import { insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { eContractid, eNetwork } from "../../helpers/types";
import { BendUpgradeableProxy, PunkGateway } from "../../types";

task(`full:deploy-punk-gateway`, `Deploys the PunkGateway contract`)
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

    const wethGateWay = await getWETHGateway();
    console.log("wethGateWay.address", wethGateWay.address);

    const punk = await getCryptoPunksMarketAddress(poolConfig);
    console.log("CryptoPunksMarket.address", punk);

    const wpunk = await getWrappedPunkTokenAddress(poolConfig, punk);
    console.log("WPUNKS.address", wpunk);

    // this contract is not support upgrade, just deploy new contract
    const punkGateWayImpl = await deployPunkGateway(verify);
    const initEncodedData = punkGateWayImpl.interface.encodeFunctionData("initialize", [
      addressesProvider.address,
      wethGateWay.address,
      punk,
      wpunk,
    ]);

    let punkGateWay: PunkGateway;
    let punkGatewayProxy: BendUpgradeableProxy;

    const punkGatewayAddress = undefined; //await addressesProvider.getAddress(ADDRESS_ID_PUNK_GATEWAY);

    if (punkGatewayAddress != undefined && notFalsyOrZeroAddress(punkGatewayAddress)) {
      console.log("Upgrading exist PunkGateway proxy to new implementation...");

      await insertContractAddressInDb(eContractid.PunkGateway, punkGatewayAddress);
      punkGatewayProxy = await getBendUpgradeableProxy(punkGatewayAddress);

      // only proxy admin can do upgrading
      await waitForTx(
        await proxyAdmin.connect(proxyAdminOwnerSigner).upgrade(punkGatewayProxy.address, punkGateWayImpl.address)
      );

      punkGateWay = await getPunkGateway(punkGatewayProxy.address);
    } else {
      console.log("Deploying new PunkGateway proxy & implementation...");
      const punkGatewayProxy = await deployBendUpgradeableProxy(
        eContractid.PunkGateway,
        proxyAdmin.address,
        punkGateWayImpl.address,
        initEncodedData,
        verify
      );

      punkGateWay = await getPunkGateway(punkGatewayProxy.address);
    }

    await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_PUNK_GATEWAY, punkGateWay.address));

    console.log("PunkGateway: proxy %s, implementation %s", punkGateWay.address, punkGateWayImpl.address);

    console.log("Finished PunkGateway deployment");
  });

task("full:punkgateway-authorize-caller-whitelist", "Initialize gateway configuration.")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("caller", "Address of whitelist")
  .addParam("flag", "Flag of whitelist, 0-1")
  .setAction(async ({ pool, caller, flag }, localBRE) => {
    await localBRE.run("set-DRE");
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const punkGateway = await getPunkGateway();

    console.log("PunkGateway:", punkGateway.address);
    await waitForTx(await punkGateway.authorizeCallerWhitelist([caller], flag));
  });

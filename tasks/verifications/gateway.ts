import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import { getBendProxyAdminById, getWrapperGateway } from "../../helpers/contracts-getters";
import { getParamPerNetwork, verifyContract } from "../../helpers/contracts-helpers";
import { eContractid, eNetwork } from "../../helpers/types";

task("verify:WrapperGateway", "Verify WrapperGateway contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("gatewayid", "The wrapper gateway id")
  .setAction(async ({ gatewayid, pool }, localDRE) => {
    await localDRE.run("set-DRE");
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    const proxyAdminWTL = await getBendProxyAdminById(eContractid.BendProxyAdminWTL);

    // Impl
    console.log(`\n- Verifying ${gatewayid} Impl...\n`);
    const implId = gatewayid + "Impl";
    const gatewayImpl = await getWrapperGateway(implId);
    console.log(`gatewayImpl: ${gatewayImpl.address}`);
    await verifyContract(implId, gatewayImpl, []);

    // Proxy
    console.log(`\n- Verifying ${gatewayid} Proxy...\n`);
    const gatewayProxy = await getWrapperGateway(gatewayid);
    console.log(`gatewayProxy: ${gatewayProxy.address}`);
    const addressesProvider = await gatewayProxy.addressProvider();
    const wethGateway = await gatewayProxy.wethGateway();
    const underlying = await gatewayProxy.underlying();
    const wrappedToken = await gatewayProxy.wrappedToken();
    await verifyContract(eContractid.BendUpgradeableProxy, gatewayProxy, [
      gatewayImpl.address,
      proxyAdminWTL.address,
      gatewayImpl.interface.encodeFunctionData("initialize", [
        addressesProvider,
        wethGateway,
        underlying,
        wrappedToken,
      ]),
    ]);
  });

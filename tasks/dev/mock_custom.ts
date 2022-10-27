import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { deployMockLoanRepaidInterceptor } from "../../helpers/contracts-deployments";
import { getLendPoolAddressesProvider } from "../../helpers/contracts-getters";

task("dev:deploy-mock-interceptor", "Deploy mock interceptor for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const mockInterceptor = await deployMockLoanRepaidInterceptor(addressesProvider.address, verify);

    console.log("MockLoanRepaidInterceptor:", mockInterceptor.address);
  });

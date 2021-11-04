import { task } from "hardhat/config";
import { getParamPerNetwork, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import {
  deployBTokenImplementations,
  deployBTokensAndBNFTsHelper,
  deployLendPool,
  deployLendPoolLoan,
  deployLendPoolConfigurator,
} from "../../helpers/contracts-deployments";
import { eContractid, eNetwork } from "../../helpers/types";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import {
  getLendPoolAddressesProvider,
  getLendPool,
  getLendPoolLoanProxy,
  getLendPoolConfiguratorProxy,
} from "../../helpers/contracts-getters";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { loadPoolConfig, ConfigNames, getGenesisPoolAdmin, getEmergencyAdmin } from "../../helpers/configuration";

task("full:deploy-lend-pool", "Deploy lend pool for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE: HardhatRuntimeEnvironment) => {
    try {
      await DRE.run("set-DRE");
      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const addressesProvider = await getLendPoolAddressesProvider();

      const { LendPool, LendPoolLoan, LendPoolConfigurator } = poolConfig;

      //////////////////////////////////////////////////////////////////////////
      // Reuse/deploy lend pool implementation
      let lendPoolImplAddress = getParamPerNetwork(LendPool, network);
      if (!notFalsyOrZeroAddress(lendPoolImplAddress)) {
        console.log("\tDeploying new lend pool implementation & libraries...");
        const lendPoolImpl = await deployLendPool(verify);
        lendPoolImplAddress = lendPoolImpl.address;
      }
      console.log("\tSetting lend pool implementation with address:", lendPoolImplAddress);
      // Set lending pool impl to Address provider
      await waitForTx(await addressesProvider.setLendPoolImpl(lendPoolImplAddress));

      const address = await addressesProvider.getLendPool();
      const lendPoolProxy = await getLendPool(address);

      await insertContractAddressInDb(eContractid.LendPool, lendPoolProxy.address);

      //////////////////////////////////////////////////////////////////////////
      // Reuse/deploy lend pool loan
      let lendPoolLoanImplAddress = getParamPerNetwork(LendPoolLoan, network);
      if (!notFalsyOrZeroAddress(lendPoolLoanImplAddress)) {
        console.log("\tDeploying new loan implementation...");
        const lendPoolLoanImpl = await deployLendPoolLoan(verify);
        lendPoolLoanImplAddress = lendPoolLoanImpl.address;
      }
      console.log("\tSetting lend pool loan implementation with address:", lendPoolLoanImplAddress);
      // Set lend pool conf impl to Address Provider
      await waitForTx(await addressesProvider.setLendPoolLoanImpl(lendPoolLoanImplAddress));

      const lendPoolLoanProxy = await getLendPoolLoanProxy(await addressesProvider.getLendPoolLoan());

      await insertContractAddressInDb(eContractid.LendPoolLoan, lendPoolLoanProxy.address);

      //////////////////////////////////////////////////////////////////////////
      // Reuse/deploy lend pool configurator
      let lendPoolConfiguratorImplAddress = getParamPerNetwork(LendPoolConfigurator, network);
      if (!notFalsyOrZeroAddress(lendPoolConfiguratorImplAddress)) {
        console.log("\tDeploying new configurator implementation...");
        const lendPoolConfiguratorImpl = await deployLendPoolConfigurator(verify);
        lendPoolConfiguratorImplAddress = lendPoolConfiguratorImpl.address;
      }
      console.log("\tSetting lend pool configurator implementation with address:", lendPoolConfiguratorImplAddress);
      // Set lend pool conf impl to Address Provider
      await waitForTx(await addressesProvider.setLendPoolConfiguratorImpl(lendPoolConfiguratorImplAddress));

      const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
        await addressesProvider.getLendPoolConfigurator()
      );

      await insertContractAddressInDb(eContractid.LendPoolConfigurator, lendPoolConfiguratorProxy.address);

      //////////////////////////////////////////////////////////////////////////
      const admin = await DRE.ethers.getSigner(await getEmergencyAdmin(poolConfig));
      // Pause market during deployment
      await waitForTx(await lendPoolConfiguratorProxy.connect(admin).setPoolPause(true));

      //////////////////////////////////////////////////////////////////////////
      // Deploy deployment helpers
      await deployBTokensAndBNFTsHelper(
        [lendPoolProxy.address, addressesProvider.address, lendPoolConfiguratorProxy.address],
        verify
      );

      await deployBTokenImplementations(pool, poolConfig.ReservesConfig, verify);
    } catch (error) {
      throw error;
    }
  });

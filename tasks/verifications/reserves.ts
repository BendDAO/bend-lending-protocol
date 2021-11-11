import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import {
  getAddressById,
  getBToken,
  getDebtToken,
  getInterestRate,
  getLendPoolAddressesProvider,
  getBendUpgradeableProxy,
  getLendPool,
  getLendPoolConfiguratorProxy,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork, verifyContract } from "../../helpers/contracts-helpers";
import { eContractid, eNetwork, ICommonConfiguration, IReserveParams } from "../../helpers/types";

task("verify:reserves", "Verify reserves contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, all, pool }, localDRE) => {
    await localDRE.run("set-DRE");
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveAssets, ReservesConfig } = poolConfig as ICommonConfiguration;

    const addressesProvider = await getLendPoolAddressesProvider();
    const lendPoolProxy = await getLendPool(await addressesProvider.getLendPool());

    const lendPoolConfigurator = await getLendPoolConfiguratorProxy(await addressesProvider.getLendPoolConfigurator());

    const configs = Object.entries(ReservesConfig) as [string, IReserveParams][];
    for (const entry of Object.entries(getParamPerNetwork(ReserveAssets, network))) {
      const [token, tokenAddress] = entry;
      console.log(`- Verifying ${token} token related contracts`);
      const tokenConfig = configs.find(([symbol]) => symbol === token);
      if (!tokenConfig) {
        throw `ReservesConfig not found for ${token} token`;
      }

      const { bTokenAddress, debtTokenAddress, interestRateAddress } = await lendPoolProxy.getReserveData(tokenAddress);

      const { optimalUtilizationRate, baseVariableBorrowRate, variableRateSlope1, variableRateSlope2 } =
        tokenConfig[1].strategy;

      // Proxy bToken
      console.log("\n- Verifying bToken proxy...\n");
      await verifyContract(eContractid.BendUpgradeableProxy, await getBendUpgradeableProxy(bTokenAddress), [
        lendPoolConfigurator.address,
      ]);

      // Proxy debtToken
      console.log("\n- Verifying debtToken proxy...\n");
      await verifyContract(eContractid.BendUpgradeableProxy, await getBendUpgradeableProxy(debtTokenAddress), [
        lendPoolConfigurator.address,
      ]);

      // Interes Rate
      console.log(`\n- Verifying Interes rate...\n`);
      await verifyContract(eContractid.InterestRate, await getInterestRate(interestRateAddress), [
        addressesProvider.address,
        optimalUtilizationRate,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
      ]);

      // Generic bToken implementation
      const bToken = await getAddressById(`b${token}`);
      if (bToken) {
        console.log("\n- Verifying bToken implementation...\n");
        await verifyContract(eContractid.BToken, await getBToken(bToken), []);
      } else {
        console.error(`Skipping bToken verify for ${token}. Missing address at JSON DB.`);
      }

      // Generic bToken implementation
      const debtToken = await getAddressById(`bDebt${token}`);
      if (debtToken) {
        console.log("\n- Verifying debtToken implementation...\n");
        await verifyContract(eContractid.BToken, await getDebtToken(debtToken), []);
      } else {
        console.error(`Skipping debtToken verify for ${token}. Missing address at JSON DB.`);
      }
    }
  });

import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames, getTreasuryAddress } from "../../helpers/configuration";
import { ZERO_ADDRESS } from "../../helpers/constants";
import {
  getAddressById,
  getBToken,
  getDebtToken,
  getFirstSigner,
  getInterestRate,
  getLendPoolAddressesProvider,
  getProxy,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork, verifyContract } from "../../helpers/contracts-helpers";
import { eContractid, eNetwork, ICommonConfiguration, IReserveParams } from "../../helpers/types";
import { LendPoolConfiguratorFactory, LendPoolFactory } from "../../types";

task("verify:reserves", "Verify reserves contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, all, pool }, localDRE) => {
    await localDRE.run("set-DRE");
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveAssets, ReservesConfig } = poolConfig as ICommonConfiguration;
    const treasuryAddress = await getTreasuryAddress(poolConfig);

    const addressesProvider = await getLendPoolAddressesProvider();
    const lendPoolProxy = LendPoolFactory.connect(await addressesProvider.getLendPool(), await getFirstSigner());

    const lendPoolConfigurator = LendPoolConfiguratorFactory.connect(
      await addressesProvider.getLendPoolConfigurator(),
      await getFirstSigner()
    );

    const configs = Object.entries(ReservesConfig) as [string, IReserveParams][];
    for (const entry of Object.entries(getParamPerNetwork(ReserveAssets, network))) {
      const [token, tokenAddress] = entry;
      console.log(`- Verifying ${token} token related contracts`);
      const { bTokenAddress, interestRateAddress } = await lendPoolProxy.getReserveData(tokenAddress);

      const tokenConfig = configs.find(([symbol]) => symbol === token);
      if (!tokenConfig) {
        throw `ReservesConfig not found for ${token} token`;
      }

      const { optimalUtilizationRate, baseVariableBorrowRate, variableRateSlope1, variableRateSlope2 } =
        tokenConfig[1].strategy;

      // Proxy bToken
      console.log("\n- Verifying bToken proxy...\n");
      await verifyContract(eContractid.InitializableAdminProxy, await getProxy(bTokenAddress), [
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

      const bToken = await getAddressById(`b${token}`);
      if (bToken) {
        console.log("\n- Verifying bToken...\n");
        await verifyContract(eContractid.BToken, await getBToken(bToken), [
          lendPoolProxy.address,
          tokenAddress,
          treasuryAddress,
          poolConfig.BTokenNamePrefix + " " + token,
          poolConfig.BTokenSymbolPrefix + token,
          ZERO_ADDRESS,
        ]);
      } else {
        console.error(`Skipping bToken verify for ${token}. Missing address at JSON DB.`);
      }

      const debtToken = await getAddressById(`bDebt${token}`);
      if (debtToken) {
        console.log("\n- Verifying debtToken...\n");
        await verifyContract(eContractid.BToken, await getDebtToken(debtToken), [
          lendPoolProxy.address,
          tokenAddress,
          poolConfig.DebtTokenNamePrefix + " " + token,
          poolConfig.DebtTokenSymbolPrefix + token,
          ZERO_ADDRESS,
        ]);
      } else {
        console.error(`Skipping debtToken verify for ${token}. Missing address at JSON DB.`);
      }
    }
  });

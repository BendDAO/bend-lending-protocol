import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames } from "../../helpers/configuration";
import {
  getBToken,
  getDebtToken,
  getInterestRate,
  getLendPoolAddressesProvider,
  getBendUpgradeableProxy,
  getLendPool,
  getLendPoolConfiguratorProxy,
  getUIPoolDataProvider,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork, verifyContract } from "../../helpers/contracts-helpers";
import { eContractid, eNetwork, ICommonConfiguration, IReserveParams } from "../../helpers/types";

task("verify:reserves", "Verify reserves contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, localDRE) => {
    await localDRE.run("set-DRE");
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveAssets, ReservesConfig } = poolConfig as ICommonConfiguration;

    const addressesProvider = await getLendPoolAddressesProvider();
    const lendPoolProxy = await getLendPool(await addressesProvider.getLendPool());

    const lendPoolConfigurator = await getLendPoolConfiguratorProxy(await addressesProvider.getLendPoolConfigurator());

    // Generic bToken implementation
    const bTokenImpl = await getBToken();
    console.log("\n- Verifying BToken implementation...\n");
    await verifyContract(eContractid.BToken, bTokenImpl, []);

    // Generic bToken implementation
    console.log("\n- Verifying DebtToken implementation...\n");
    const debtTokenImpl = await getDebtToken();
    await verifyContract(eContractid.DebtToken, debtTokenImpl, []);

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

      const bTokenContract = await getBToken(bTokenAddress);

      // Proxy bToken
      console.log("\n- Verifying bToken proxy...\n");
      const bTokenInitEncodeData = bTokenImpl.interface.encodeFunctionData("initialize", [
        addressesProvider.address,
        await bTokenContract.RESERVE_TREASURY_ADDRESS(),
        await bTokenContract.UNDERLYING_ASSET_ADDRESS(),
        await bTokenContract.decimals(),
        await bTokenContract.name(),
        await bTokenContract.symbol(),
      ]);
      await verifyContract(eContractid.BendUpgradeableProxy, await getBendUpgradeableProxy(bTokenAddress), [
        bTokenImpl.address,
        lendPoolConfigurator.address,
        bTokenInitEncodeData,
      ]);

      // Proxy debtToken
      const debtTokenInitEncodeData = debtTokenImpl.interface.encodeFunctionData("initialize", [
        addressesProvider.address,
        await bTokenContract.UNDERLYING_ASSET_ADDRESS(),
        await bTokenContract.decimals(),
        await bTokenContract.name(),
        await bTokenContract.symbol(),
      ]);
      console.log("\n- Verifying debtToken proxy...\n");
      await verifyContract(eContractid.BendUpgradeableProxy, await getBendUpgradeableProxy(debtTokenAddress), [
        debtTokenImpl.address,
        lendPoolConfigurator.address,
        debtTokenInitEncodeData,
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
    }
  });

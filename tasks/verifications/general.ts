import { task } from "hardhat/config";
import {
  loadPoolConfig,
  ConfigNames,
  getTreasuryAddress,
  getWrappedNativeTokenAddress,
  getWrappedPunkTokenAddress,
} from "../../helpers/configuration";
import { ZERO_ADDRESS } from "../../helpers/constants";
import {
  getBendProtocolDataProvider,
  getAddressById,
  getLendPoolImpl,
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolLoanImpl,
  getLendPoolLoanProxy,
  getLendPoolConfiguratorImpl,
  getLendPoolConfiguratorProxy,
  getProxy,
  getWalletProvider,
  getWETHGateway,
  getPunkGateway,
} from "../../helpers/contracts-getters";
import { verifyContract, getParamPerNetwork } from "../../helpers/contracts-helpers";
import { notFalsyOrZeroAddress } from "../../helpers/misc-utils";
import { eContractid, eNetwork, ICommonConfiguration } from "../../helpers/types";

task("verify:general", "Verify general contracts at Etherscan")
  .addFlag("all", "Verify all contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ all, pool }, localDRE) => {
    await localDRE.run("set-DRE");
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const {
      ReserveAssets,
      ReservesConfig,
      ProviderRegistry,
      MarketId,
      LendPoolLoan,
      LendPoolConfigurator,
      LendPool,
      WethGateway,
      CryptoPunksMarket,
      PunkGateway,
    } = poolConfig as ICommonConfiguration;
    const treasuryAddress = await getTreasuryAddress(poolConfig);

    const registryAddress = getParamPerNetwork(ProviderRegistry, network);
    const addressesProvider = await getLendPoolAddressesProvider();
    const lendPoolAddress = await addressesProvider.getLendPool();
    const lendPoolConfiguratorAddress = await addressesProvider.getLendPoolConfigurator();
    const lendPoolLoanAddress = await addressesProvider.getLendPoolLoan();

    const lendPoolProxy = await getProxy(lendPoolAddress);
    const lendPoolConfiguratorProxy = await getProxy(lendPoolConfiguratorAddress);
    const lendPoolLoanProxy = await getProxy(lendPoolLoanAddress);

    const punkAddress = getParamPerNetwork(CryptoPunksMarket, network);

    if (all) {
      const lendPoolImplAddress = getParamPerNetwork(LendPool, network);
      const lendPoolImpl = notFalsyOrZeroAddress(lendPoolImplAddress)
        ? await getLendPoolImpl(lendPoolImplAddress)
        : await getLendPoolImpl();

      const lendPoolConfiguratorImplAddress = getParamPerNetwork(LendPoolConfigurator, network);
      const lendPoolConfiguratorImpl = notFalsyOrZeroAddress(lendPoolConfiguratorImplAddress)
        ? await getLendPoolConfiguratorImpl(lendPoolConfiguratorImplAddress)
        : await getLendPoolConfiguratorImpl();

      const lendPoolLoanImplAddress = getParamPerNetwork(LendPoolLoan, network);
      const lendPoolLoanImpl = notFalsyOrZeroAddress(lendPoolLoanImplAddress)
        ? await getLendPoolLoanImpl(lendPoolLoanImplAddress)
        : await getLendPoolLoanImpl();

      const dataProvider = await getBendProtocolDataProvider();
      const walletProvider = await getWalletProvider();

      const wethGatewayAddress = getParamPerNetwork(WethGateway, network);
      const wethGateway = notFalsyOrZeroAddress(wethGatewayAddress)
        ? await getWETHGateway(wethGatewayAddress)
        : await getWETHGateway();

      const punkGatewayAddress = getParamPerNetwork(PunkGateway, network);
      const punkGateway = notFalsyOrZeroAddress(punkGatewayAddress)
        ? await getPunkGateway(punkGatewayAddress)
        : await getPunkGateway();

      // Address Provider
      console.log("\n- Verifying address provider...\n");
      await verifyContract(eContractid.LendPoolAddressesProvider, addressesProvider, [MarketId]);

      // Lend Pool implementation
      console.log("\n- Verifying LendPool Implementation...\n");
      await verifyContract(eContractid.LendPool, lendPoolImpl, []);

      // Lend Pool Configurator implementation
      console.log("\n- Verifying LendPool Configurator Implementation...\n");
      await verifyContract(eContractid.LendPoolConfigurator, lendPoolConfiguratorImpl, []);

      // Lend Pool Loan Manager implementation
      console.log("\n- Verifying LendPool Loan Manager Implementation...\n");
      await verifyContract(eContractid.LendPoolLoan, lendPoolLoanImpl, []);

      // Data Provider
      console.log("\n- Verifying Data Provider...\n");
      await verifyContract(eContractid.BendProtocolDataProvider, dataProvider, [addressesProvider.address]);

      // Wallet balance provider
      console.log("\n- Verifying Wallet Balance Provider...\n");
      await verifyContract(eContractid.WalletBalanceProvider, walletProvider, []);

      // WETHGateway
      console.log("\n- Verifying WETHGateway...\n");
      await verifyContract(eContractid.WETHGateway, wethGateway, [await getWrappedNativeTokenAddress(poolConfig)]);

      // PunkGateway
      console.log("\n- Verifying PunkGateway...\n");
      await verifyContract(eContractid.PunkGateway, punkGateway, [
        await getWrappedPunkTokenAddress(poolConfig, punkAddress),
      ]);
    }

    // Lend Pool proxy
    console.log("\n- Verifying Lend Pool Proxy...\n");
    await verifyContract(eContractid.InitializableAdminProxy, lendPoolProxy, [addressesProvider.address]);

    // LendPool Conf proxy
    console.log("\n- Verifying Lend Pool Configurator Proxy...\n");
    await verifyContract(eContractid.InitializableAdminProxy, lendPoolConfiguratorProxy, [addressesProvider.address]);

    // LendPool loan manager
    console.log("\n- Verifying Lend Pool Loan Manager Proxy...\n");
    await verifyContract(eContractid.InitializableAdminProxy, lendPoolLoanProxy, [addressesProvider.address]);

    console.log("Finished verifications.");
  });

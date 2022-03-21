import { task } from "hardhat/config";
import { loadPoolConfig, ConfigNames, getWrappedNativeTokenAddress } from "../../helpers/configuration";
import {
  getBendProtocolDataProvider,
  getLendPoolImpl,
  getLendPoolAddressesProvider,
  getLendPoolLoanImpl,
  getLendPoolConfiguratorImpl,
  getBendUpgradeableProxy,
  getWalletProvider,
  getWETHGateway,
  getPunkGateway,
  getUIPoolDataProvider,
  getLendPoolAddressesProviderRegistry,
  getBendCollectorProxy,
  getBendCollectorImpl,
  getBendProxyAdminById,
  getReserveOracleImpl,
  getNFTOracle,
  getNFTOracleImpl,
  getLendPoolLiquidator,
  getWETHGatewayImpl,
  getPunkGatewayImpl,
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
    const { MarketId, CryptoPunksMarket, WrappedPunkToken } = poolConfig as ICommonConfiguration;

    const bendCollectorImpl = await getBendCollectorImpl();

    const providerRegistry = await getLendPoolAddressesProviderRegistry();
    const addressesProvider = await getLendPoolAddressesProvider();

    const lendPoolAddress = await addressesProvider.getLendPool();
    const lendPoolConfiguratorAddress = await addressesProvider.getLendPoolConfigurator();
    const lendPoolLoanAddress = await addressesProvider.getLendPoolLoan();

    const lendPoolProxy = await getBendUpgradeableProxy(lendPoolAddress);
    const lendPoolConfiguratorProxy = await getBendUpgradeableProxy(lendPoolConfiguratorAddress);
    const lendPoolLoanProxy = await getBendUpgradeableProxy(lendPoolLoanAddress);

    const punkAddress = getParamPerNetwork(CryptoPunksMarket, network);
    const wpunkAddress = getParamPerNetwork(WrappedPunkToken, network);

    const wethGateway = await getWETHGateway();
    const punkGateway = await getPunkGateway();

    const lendPoolImpl = await getLendPoolImpl();
    const lendPoolConfiguratorImpl = await getLendPoolConfiguratorImpl();
    const lendPoolLoanImpl = await getLendPoolLoanImpl();
    const lendPoolLoanLiq = await getLendPoolLiquidator();

    const reserveOracleImpl = await getReserveOracleImpl();
    const nftOracleImpl = await getNFTOracleImpl();

    const wethGatewayImpl = await getWETHGatewayImpl();
    const punkGatewayImpl = await getPunkGatewayImpl();

    const proxyAdminFund = await getBendProxyAdminById(eContractid.BendProxyAdminFund);
    await verifyContract(eContractid.BendProxyAdminFund, proxyAdminFund, []);

    const proxyAdminPool = await getBendProxyAdminById(eContractid.BendProxyAdminPool);
    await verifyContract(eContractid.BendProxyAdminPool, proxyAdminPool, []);

    if (all) {
      const dataProvider = await getBendProtocolDataProvider();
      const walletProvider = await getWalletProvider();
      const uiProvider = await getUIPoolDataProvider();

      // BendCollector
      console.log("\n- Verifying Collector...\n");
      await verifyContract(eContractid.BendCollectorImpl, bendCollectorImpl, []);

      // Address Provider
      console.log("\n- Verifying provider registry...\n");
      await verifyContract(eContractid.LendPoolAddressesProviderRegistry, providerRegistry, []);

      console.log("\n- Verifying address provider...\n");
      await verifyContract(eContractid.LendPoolAddressesProvider, addressesProvider, [MarketId]);

      // Lend Pool implementation
      console.log("\n- Verifying LendPool Implementation...\n");
      await verifyContract(eContractid.LendPoolImpl, lendPoolImpl, []);

      // Lend Pool Configurator implementation
      console.log("\n- Verifying LendPool Configurator Implementation...\n");
      await verifyContract(eContractid.LendPoolConfiguratorImpl, lendPoolConfiguratorImpl, []);

      // Lend Pool Loan Manager implementation
      console.log("\n- Verifying LendPool Loan Implementation...\n");
      await verifyContract(eContractid.LendPoolLoanImpl, lendPoolLoanImpl, []);

      console.log("\n- Verifying LendPool Liquidator Implementation...\n");
      await verifyContract(eContractid.LendPoolLiquidator, lendPoolLoanLiq, []);

      // Bend Data Provider
      console.log("\n- Verifying Bend Data Provider...\n");
      await verifyContract(eContractid.BendProtocolDataProvider, dataProvider, [addressesProvider.address]);

      // Wallet balance provider
      console.log("\n- Verifying Wallet Balance Provider...\n");
      await verifyContract(eContractid.WalletBalanceProvider, walletProvider, []);

      // UI data provider
      console.log("\n- Verifying UI Data Provider...\n");
      await verifyContract(eContractid.UIPoolDataProvider, uiProvider, [
        await addressesProvider.getReserveOracle(),
        await addressesProvider.getNFTOracle(),
      ]);

      console.log("\n- Verifying ReserveOracle...\n");
      await verifyContract(eContractid.ReserveOracleImpl, reserveOracleImpl, []);

      console.log("\n- Verifying NFTOracle...\n");
      await verifyContract(eContractid.NFTOracleImpl, nftOracleImpl, []);

      // WETHGateway
      console.log("\n- Verifying WETHGateway...\n");
      await verifyContract(eContractid.WETHGatewayImpl, wethGatewayImpl, []);

      // PunkGateway
      console.log("\n- Verifying PunkGateway...\n");
      await verifyContract(eContractid.PunkGatewayImpl, punkGatewayImpl, []);
    }

    // BendCollector Proxy
    console.log("\n- Verifying Collector...\n");
    const bendCollectorProxy = await getBendCollectorProxy();
    const collectorProxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminFund);
    await verifyContract(eContractid.BendCollector, bendCollectorProxy, [
      bendCollectorImpl.address,
      collectorProxyAdmin.address,
      bendCollectorImpl.interface.encodeFunctionData("initialize"),
    ]);

    // Lend Pool proxy
    console.log("\n- Verifying Lend Pool Proxy...\n");
    await verifyContract(eContractid.BendUpgradeableProxy, lendPoolProxy, [
      lendPoolImpl.address,
      addressesProvider.address,
      lendPoolImpl.interface.encodeFunctionData("initialize", [addressesProvider.address]),
    ]);

    // LendPool Conf proxy
    console.log("\n- Verifying Lend Pool Configurator Proxy...\n");
    await verifyContract(eContractid.BendUpgradeableProxy, lendPoolConfiguratorProxy, [
      lendPoolConfiguratorImpl.address,
      addressesProvider.address,
      lendPoolConfiguratorImpl.interface.encodeFunctionData("initialize", [addressesProvider.address]),
    ]);

    // LendPool loan manager
    console.log("\n- Verifying Lend Pool Loan Manager Proxy...\n");
    await verifyContract(eContractid.BendUpgradeableProxy, lendPoolLoanProxy, [
      lendPoolLoanImpl.address,
      addressesProvider.address,
      lendPoolLoanImpl.interface.encodeFunctionData("initialize", [addressesProvider.address]),
    ]);

    // WETHGateway
    console.log("\n- Verifying WETHGateway Proxy...\n");
    await verifyContract(eContractid.BendUpgradeableProxy, wethGateway, [
      wethGatewayImpl.address,
      proxyAdminPool.address,
      wethGatewayImpl.interface.encodeFunctionData("initialize", [
        addressesProvider.address,
        await getWrappedNativeTokenAddress(poolConfig),
      ]),
    ]);

    // PunkGateway
    console.log("\n- Verifying PunkGateway Proxy...\n");
    await verifyContract(eContractid.BendUpgradeableProxy, punkGateway, [
      punkGatewayImpl.address,
      proxyAdminPool.address,
      punkGatewayImpl.interface.encodeFunctionData("initialize", [
        addressesProvider.address,
        wethGateway.address,
        punkAddress,
        wpunkAddress,
      ]),
    ]);

    console.log("Finished verifications.");
  });

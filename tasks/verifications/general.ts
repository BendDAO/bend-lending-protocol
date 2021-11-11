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
    const { MarketId, WethGateway, CryptoPunksMarket, WrappedPunkToken, PunkGateway } =
      poolConfig as ICommonConfiguration;

    const addressesProvider = await getLendPoolAddressesProvider();

    const lendPoolAddress = await addressesProvider.getLendPool();
    const lendPoolConfiguratorAddress = await addressesProvider.getLendPoolConfigurator();
    const lendPoolLoanAddress = await addressesProvider.getLendPoolLoan();

    const lendPoolProxy = await getBendUpgradeableProxy(lendPoolAddress);
    const lendPoolConfiguratorProxy = await getBendUpgradeableProxy(lendPoolConfiguratorAddress);
    const lendPoolLoanProxy = await getBendUpgradeableProxy(lendPoolLoanAddress);

    const punkAddress = getParamPerNetwork(CryptoPunksMarket, network);
    const wpunkAddress = getParamPerNetwork(WrappedPunkToken, network);

    const lendPoolImpl = await getLendPoolImpl();
    const lendPoolConfiguratorImpl = await getLendPoolConfiguratorImpl();
    const lendPoolLoanImpl = await getLendPoolLoanImpl();

    if (all) {
      const dataProvider = await getBendProtocolDataProvider();
      const walletProvider = await getWalletProvider();
      const uiProvider = await getUIPoolDataProvider();

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

      // WETHGateway
      console.log("\n- Verifying WETHGateway...\n");
      await verifyContract(eContractid.WETHGateway, wethGateway, [
        addressesProvider.address,
        await getWrappedNativeTokenAddress(poolConfig),
      ]);

      // PunkGateway
      console.log("\n- Verifying PunkGateway...\n");
      await verifyContract(eContractid.PunkGateway, punkGateway, [
        addressesProvider.address,
        wethGateway.address,
        punkAddress,
        wpunkAddress,
      ]);
    }

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

    console.log("Finished verifications.");
  });

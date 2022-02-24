import { task } from "hardhat/config";
import {
  ConfigNames,
  getCryptoPunksMarketAddress,
  getWrappedNativeTokenAddress,
  getWrappedPunkTokenAddress,
  loadPoolConfig,
} from "../../helpers/configuration";
import {
  getBendProtocolDataProvider,
  getDeploySigner,
  getLendPoolAddressesProvider,
  getPunkGateway,
  getUIPoolDataProvider,
  getWalletProvider,
  getWETHGateway,
} from "../../helpers/contracts-getters";
import { eContractid, eNetwork } from "../../helpers/types";
import {
  deployLendPool,
  deployLendPoolLoan,
  deployLendPoolLiquidator,
  deployReserveOracle,
  deployNFTOracle,
  deployBendLibraries,
  getBendLibraries,
  deployLendPoolConfigurator,
  deployUiPoolDataProvider,
  deployWalletBalancerProvider,
  deployBendProtocolDataProvider,
  deployPunkGateway,
  deployWETHGateway,
} from "../../helpers/contracts-deployments";
import { waitForTx } from "../../helpers/misc-utils";
import { getEthersSignerByAddress, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { ADDRESS_ID_PUNK_GATEWAY, ADDRESS_ID_WETH_GATEWAY } from "../../helpers/constants";
import { ethers } from "hardhat";

task("dev:deploy-new-implementation", "Deploy new implementation")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", "Verify contracts at Etherscan")
  .addFlag("setAddressProvider", "Set contract implementation in address provider")
  .addParam("contract", "Contract name")
  .setAction(async ({ verify, pool, setAddressProvider, contract }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProviderRaw = await getLendPoolAddressesProvider();
    const providerOwnerSigner = await getEthersSignerByAddress(await addressesProviderRaw.owner());
    const addressesProvider = addressesProviderRaw.connect(providerOwnerSigner);

    if (contract == "LendPool" || contract == "LendPoolLiquidator") {
      await deployBendLibraries(verify);
      const bendLibs = await getBendLibraries(verify);
      console.log("Bend Libraries address:", bendLibs);

      const lendPoolImpl = await deployLendPool(verify);
      console.log("LendPool implementation address:", lendPoolImpl.address);

      const lendPoolLiqImpl = await deployLendPoolLiquidator(verify);
      console.log("LendPoolLiquidator implementation address:", lendPoolLiqImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setLendPoolImpl(lendPoolImpl.address, []));
        await waitForTx(await addressesProvider.setLendPoolLiquidator(lendPoolLiqImpl.address));
      }
      await insertContractAddressInDb(eContractid.LendPool, await addressesProvider.getLendPool());
      await insertContractAddressInDb(eContractid.LendPoolLiquidator, await addressesProvider.getLendPoolLiquidator());
    }

    if (contract == "LendPoolConfigurator") {
      const lendPoolCfgImpl = await deployLendPoolConfigurator(verify);
      console.log("LendPoolConfigurator implementation address:", lendPoolCfgImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setLendPoolConfiguratorImpl(lendPoolCfgImpl.address, []));
      }
      await insertContractAddressInDb(
        eContractid.LendPoolConfigurator,
        await addressesProvider.getLendPoolConfigurator()
      );
    }

    if (contract == "LendPoolLoan") {
      const lendPoolLoanImpl = await deployLendPoolLoan(verify);
      console.log("LendPoolLoan implementation address:", lendPoolLoanImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setLendPoolLoanImpl(lendPoolLoanImpl.address, []));
      }
      await insertContractAddressInDb(eContractid.LendPoolLoan, await addressesProvider.getLendPoolLoan());
    }

    if (contract == "ReserveOracle") {
      const reserveOracleImpl = await deployReserveOracle(verify);
      console.log("ReserveOracle implementation address:", reserveOracleImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setReserveOracle(reserveOracleImpl.address));
      }
      await insertContractAddressInDb(eContractid.ReserveOracle, await addressesProvider.getReserveOracle());
    }

    if (contract == "NFTOracle") {
      const nftOracleImpl = await deployNFTOracle(verify);
      console.log("NFTOracle implementation address:", nftOracleImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setNFTOracle(nftOracleImpl.address));
      }
      await insertContractAddressInDb(eContractid.NFTOracle, await addressesProvider.getNFTOracle());
    }

    if (contract == "WETHGateway") {
      const wethAddress = await getWrappedNativeTokenAddress(poolConfig);
      console.log("WETH.address", wethAddress);

      const wethGatewayImpl = await deployWETHGateway([addressesProvider.address, wethAddress], verify);
      console.log("WETHGateway implementation address:", wethGatewayImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_WETH_GATEWAY, wethGatewayImpl.address));
      }
    }

    if (contract == "PunkGateway") {
      const wethGateWay = await getWETHGateway();
      console.log("WETHGateway.address", wethGateWay.address);

      const punkAddress = await getCryptoPunksMarketAddress(poolConfig);
      console.log("CryptoPunksMarket.address", punkAddress);

      const wpunkAddress = await getWrappedPunkTokenAddress(poolConfig, punkAddress);
      console.log("WPUNKS.address", wpunkAddress);

      const punkGatewayImpl = await deployPunkGateway(
        [addressesProvider.address, wethGateWay.address, punkAddress, wpunkAddress],
        verify
      );
      console.log("PunkGateway implementation address:", punkGatewayImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_PUNK_GATEWAY, punkGatewayImpl.address));
      }
    }

    if (contract == "BendProtocolDataProvider") {
      const contractImpl = await deployBendProtocolDataProvider(addressesProvider.address, verify);
      console.log("BendProtocolDataProvider implementation address:", contractImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setBendDataProvider(contractImpl.address));
      }
    }

    if (contract == "UiPoolDataProvider") {
      const contractImpl = await deployUiPoolDataProvider(
        await addressesProvider.getReserveOracle(),
        await addressesProvider.getNFTOracle(),
        verify
      );
      console.log("UiPoolDataProvider implementation address:", contractImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setUIDataProvider(contractImpl.address));
      }
    }

    if (contract == "WalletBalancerProvider") {
      const contractImpl = await deployWalletBalancerProvider(verify);
      console.log("WalletBalancerProvider implementation address:", contractImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setWalletBalanceProvider(contractImpl.address));
      }
    }
  });

task("dev:update-implementation-to-address-provider", "Update implementation to address provider")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProviderRaw = await getLendPoolAddressesProvider();
    const providerOwnerSigner = await getEthersSignerByAddress(await addressesProviderRaw.owner());
    const addressesProvider = addressesProviderRaw.connect(providerOwnerSigner);

    {
      const wethGatewayImpl = await getWETHGateway();
      await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_WETH_GATEWAY, wethGatewayImpl.address));
    }

    {
      const punkGatewayImpl = await getPunkGateway();
      await waitForTx(await addressesProvider.setAddress(ADDRESS_ID_PUNK_GATEWAY, punkGatewayImpl.address));
    }

    {
      const bendProviderImpl = await getBendProtocolDataProvider();
      await waitForTx(await addressesProvider.setBendDataProvider(bendProviderImpl.address));
    }

    {
      const uiProviderImpl = await getUIPoolDataProvider();
      await waitForTx(await addressesProvider.setUIDataProvider(uiProviderImpl.address));
    }

    {
      const walletProviderImpl = await getWalletProvider();
      await waitForTx(await addressesProvider.setWalletBalanceProvider(walletProviderImpl.address));
    }
  });

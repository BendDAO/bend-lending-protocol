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
  getBendProxyAdminByAddress,
  getBendProxyAdminById,
  getBendUpgradeableProxy,
  getDeploySigner,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
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
  deployBTokensAndBNFTsHelper,
  deployInterestRate,
  deployGenericDebtToken,
  deployBendCollector,
} from "../../helpers/contracts-deployments";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { getEthersSignerByAddress, insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { ethers } from "hardhat";
import { ADDRESS_ID_PUNK_GATEWAY, ADDRESS_ID_WETH_GATEWAY, oneRay } from "../../helpers/constants";
import { BytesLike } from "ethers";
import BigNumber from "bignumber.js";

task("dev:deploy-new-implementation", "Deploy new implementation")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("contract", "Contract name")
  .addFlag("upgrade", "Upgrade contract")
  .setAction(async ({ verify, pool, contract, upgrade }, DRE) => {
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

      if (upgrade) {
        await waitForTx(await addressesProvider.setLendPoolImpl(lendPoolImpl.address, []));
        await waitForTx(await addressesProvider.setLendPoolLiquidator(lendPoolLiqImpl.address));
      }
      await insertContractAddressInDb(eContractid.LendPool, await addressesProvider.getLendPool());
      await insertContractAddressInDb(eContractid.LendPoolLiquidator, await addressesProvider.getLendPoolLiquidator());
    }

    if (contract == "LendPoolConfigurator") {
      const lendPoolCfgImpl = await deployLendPoolConfigurator(verify);
      console.log("LendPoolConfigurator implementation address:", lendPoolCfgImpl.address);

      if (upgrade) {
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

      if (upgrade) {
        await waitForTx(await addressesProvider.setLendPoolLoanImpl(lendPoolLoanImpl.address, []));
      }
      await insertContractAddressInDb(eContractid.LendPoolLoan, await addressesProvider.getLendPoolLoan());
    }

    if (contract == "ReserveOracle") {
      const reserveOracleImpl = await deployReserveOracle(verify);
      console.log("ReserveOracle implementation address:", reserveOracleImpl.address);

      const proxyAddress = await addressesProvider.getReserveOracle();
      await insertContractAddressInDb(eContractid.ReserveOracle, proxyAddress);

      if (upgrade) {
        await DRE.run("dev:upgrade-implementation", {
          pool: pool,
          contract,
          proxy: proxyAddress,
          impl: reserveOracleImpl.address,
        });
      }
    }

    if (contract == "NFTOracle") {
      const nftOracleImpl = await deployNFTOracle(verify);
      console.log("NFTOracle implementation address:", nftOracleImpl.address);

      const proxyAddress = await addressesProvider.getNFTOracle();
      await insertContractAddressInDb(eContractid.NFTOracle, proxyAddress);

      if (upgrade) {
        await DRE.run("dev:upgrade-implementation", {
          pool: pool,
          contract,
          proxy: proxyAddress,
          impl: nftOracleImpl.address,
        });
      }
    }

    if (contract == "WETHGateway") {
      const wethAddress = await getWrappedNativeTokenAddress(poolConfig);
      console.log("WETH.address", wethAddress);

      const wethGatewayImpl = await deployWETHGateway(verify);
      console.log("WETHGateway implementation address:", wethGatewayImpl.address);

      const proxyAddress = await addressesProvider.getAddress(ADDRESS_ID_WETH_GATEWAY);
      await insertContractAddressInDb(eContractid.WETHGateway, proxyAddress);

      if (upgrade) {
        await DRE.run("dev:upgrade-implementation", {
          pool: pool,
          contract,
          proxy: proxyAddress,
          impl: wethGatewayImpl.address,
        });
      }
    }

    if (contract == "PunkGateway") {
      const wethGateWay = await getWETHGateway();
      console.log("WETHGateway.address", wethGateWay.address);

      const punkAddress = await getCryptoPunksMarketAddress(poolConfig);
      console.log("CryptoPunksMarket.address", punkAddress);

      const wpunkAddress = await getWrappedPunkTokenAddress(poolConfig, punkAddress);
      console.log("WPUNKS.address", wpunkAddress);

      const punkGatewayImpl = await deployPunkGateway(verify);
      console.log("PunkGateway implementation address:", punkGatewayImpl.address);

      const proxyAddress = await addressesProvider.getAddress(ADDRESS_ID_PUNK_GATEWAY);
      await insertContractAddressInDb(eContractid.PunkGateway, proxyAddress);

      if (upgrade) {
        await DRE.run("dev:upgrade-implementation", {
          pool: pool,
          contract,
          proxy: proxyAddress,
          impl: punkGatewayImpl.address,
        });
      }
    }

    if (contract == "BendProtocolDataProvider") {
      const contractImpl = await deployBendProtocolDataProvider(addressesProvider.address, verify);
      console.log("BendProtocolDataProvider implementation address:", contractImpl.address);

      if (upgrade) {
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

      if (upgrade) {
        await waitForTx(await addressesProvider.setUIDataProvider(contractImpl.address));
      }
    }

    if (contract == "WalletBalancerProvider") {
      const contractImpl = await deployWalletBalancerProvider(verify);
      console.log("WalletBalancerProvider implementation address:", contractImpl.address);

      if (upgrade) {
        await waitForTx(await addressesProvider.setWalletBalanceProvider(contractImpl.address));
      }
    }

    if (contract == "BTokensAndBNFTsHelper") {
      const contractImpl = await deployBTokensAndBNFTsHelper([addressesProvider.address], verify);
      console.log("BTokensAndBNFTsHelper implementation address:", contractImpl.address);
    }

    if (contract == "BendCollector") {
      const contractImpl = await deployBendCollector([], verify);
      console.log("BendCollector implementation address:", contractImpl.address);
    }
  });

task("dev:deploy-new-interest-rate", "Deploy new interest rate implementation")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("optUtilRate", "Optimal Utilization Rate, 0-1, 0.65")
  .addParam("baseRate", "Optimal Utilization Rate, 0-1, 0.03")
  .addParam("rateSlope1", "Variable Rate Slope1, 0-1, 0.08")
  .addParam("rateSlope2", "Variable Rate Slope2, 0-1, 1.0")
  .setAction(async ({ verify, pool, optUtilRate, baseRate, rateSlope1, rateSlope2 }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProviderRaw = await getLendPoolAddressesProvider();
    const providerOwnerSigner = await getEthersSignerByAddress(await addressesProviderRaw.owner());
    const addressesProvider = addressesProviderRaw.connect(providerOwnerSigner);

    /*

export const rateStrategyWETH: IInterestRateStrategyParams = {
  name: "rateStrategyWETH",
  optimalUtilizationRate: new BigNumber(0.65).multipliedBy(oneRay).toFixed(),
  baseVariableBorrowRate: new BigNumber(0.03).multipliedBy(oneRay).toFixed(),
  variableRateSlope1: new BigNumber(0.08).multipliedBy(oneRay).toFixed(),
  variableRateSlope2: new BigNumber(1).multipliedBy(oneRay).toFixed(),
}
    */

    const optUtilRateInRay = new BigNumber(optUtilRate).multipliedBy(oneRay).toFixed();
    const baseRateInRay = new BigNumber(baseRate).multipliedBy(oneRay).toFixed();
    const rateSlope1InRay = new BigNumber(rateSlope1).multipliedBy(oneRay).toFixed();
    const rateSlope2InRay = new BigNumber(rateSlope2).multipliedBy(oneRay).toFixed();

    const rateInstance = await deployInterestRate(
      [addressesProvider.address, optUtilRateInRay, baseRateInRay, rateSlope1InRay, rateSlope2InRay],
      verify
    );
    console.log("InterestRate implementation address:", rateInstance.address);
  });

task("dev:upgrade-implementation", "Update implementation to address provider")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("contract", "Contract name")
  .addParam("proxy", "Contract proxy address")
  .addParam("impl", "Contract implementation address")
  .setAction(async ({ pool, contract, proxy, impl }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    const bendProxy = await getBendUpgradeableProxy(proxy);

    const proxyAdmin = await getBendProxyAdminById(eContractid.BendProxyAdminPool);
    if (proxyAdmin == undefined || !notFalsyOrZeroAddress(proxyAdmin.address)) {
      throw Error("Invalid pool proxy admin in config");
    }
    const proxyAdminOwnerAddress = await proxyAdmin.owner();
    const proxyAdminOwnerSigner = DRE.ethers.provider.getSigner(proxyAdminOwnerAddress);
    console.log("ProxyAdmin:", proxyAdmin.address, "Owner:", proxyAdminOwnerAddress);

    // only proxy admin can do upgrading
    await waitForTx(await proxyAdmin.connect(proxyAdminOwnerSigner).upgrade(bendProxy.address, impl));

    await insertContractAddressInDb(eContractid[contract], proxy);
  });

task("dev:upgrade-all-debtokens", "Update implementation to debt token")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProviderRaw = await getLendPoolAddressesProvider();
    const poolAdminAddress = await addressesProviderRaw.getPoolAdmin();
    const poolAdminSigner = await getEthersSignerByAddress(poolAdminAddress);
    console.log(addressesProviderRaw.address, poolAdminAddress);

    const lendPoolConfigurator = await getLendPoolConfiguratorProxy(
      await addressesProviderRaw.getLendPoolConfigurator()
    );
    const protocolDataProvider = await getBendProtocolDataProvider(await addressesProviderRaw.getBendDataProvider());

    const debtTokenImpl = await deployGenericDebtToken(verify);
    console.log("DebtToken implementation:", debtTokenImpl.address);

    const allReserves = await protocolDataProvider.getAllReservesTokenDatas();
    for (const reserve of allReserves) {
      console.log("Reserve Tokens:", reserve.tokenSymbol, reserve.tokenAddress, reserve.debtTokenAddress);
      const input: {
        asset: string;
        implementation: string;
        encodedCallData: BytesLike;
      } = {
        asset: reserve.tokenAddress,
        implementation: debtTokenImpl.address,
        encodedCallData: [],
      };
      await waitForTx(await lendPoolConfigurator.connect(poolAdminSigner).updateDebtToken(input));
    }
  });

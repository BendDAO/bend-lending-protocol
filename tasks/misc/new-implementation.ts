import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getFirstSigner, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { eNetwork } from "../../helpers/types";
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
} from "../../helpers/contracts-deployments";
import { waitForTx } from "../../helpers/misc-utils";
import { getEthersSignerByAddress } from "../../helpers/contracts-helpers";

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
    }

    if (contract == "LendPoolConfigurator") {
      const lendPoolCfgImpl = await deployLendPoolConfigurator(verify);
      console.log("LendPoolConfigurator implementation address:", lendPoolCfgImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setLendPoolConfiguratorImpl(lendPoolCfgImpl.address, []));
      }
    }

    if (contract == "LendPoolLoan") {
      const lendPoolLoanImpl = await deployLendPoolLoan(verify);
      console.log("LendPoolLoan implementation address:", lendPoolLoanImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setLendPoolLoanImpl(lendPoolLoanImpl.address, []));
      }
    }

    if (contract == "ReserveOracle") {
      const reserveOracleImpl = await deployReserveOracle(verify);
      console.log("ReserveOracle implementation address:", reserveOracleImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setReserveOracle(reserveOracleImpl.address));
      }
    }

    if (contract == "NFTOracle") {
      const nftOracleImpl = await deployNFTOracle(verify);
      console.log("NFTOracle implementation address:", nftOracleImpl.address);

      if (setAddressProvider) {
        await waitForTx(await addressesProvider.setNFTOracle(nftOracleImpl.address));
      }
    }

    if (contract == "UiPoolDataProvider") {
      const nftOracleImpl = await deployUiPoolDataProvider(
        await addressesProvider.getReserveOracle(),
        await addressesProvider.getNFTOracle(),
        verify
      );
      console.log("UiPoolDataProvider implementation address:", nftOracleImpl.address);
    }

    if (contract == "BendProtocolDataProvider") {
      const nftOracleImpl = await deployBendProtocolDataProvider(addressesProvider.address, verify);
      console.log("WalletBalancerProvider implementation address:", nftOracleImpl.address);
    }

    if (contract == "WalletBalancerProvider") {
      const nftOracleImpl = await deployWalletBalancerProvider(verify);
      console.log("WalletBalancerProvider implementation address:", nftOracleImpl.address);
    }
  });

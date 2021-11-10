import { task } from "hardhat/config";
import { formatEther } from "ethers/lib/utils";
import {
  deployBendProtocolDataProvider,
  deployUiPoolDataProvider,
  deployWalletBalancerProvider,
} from "../../helpers/contracts-deployments";
import { notFalsyOrZeroAddress, waitForTx } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getFirstSigner, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { eNetwork } from "../../helpers/types";

task("full:deploy-data-provider", "Deploy data provider for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag("wallet", "")
  .addFlag("protocol", "")
  .addFlag("ui", "")
  .setAction(async ({ verify, wallet, protocol, ui }, DRE) => {
    await DRE.run("set-DRE");
    const addressesProvider = await getLendPoolAddressesProvider();

    // this contract is not support upgrade, just deploy new contract
    const reserveOracle = await addressesProvider.getReserveOracle();
    const nftOracle = await addressesProvider.getNFTOracle();

    if (wallet) {
      const walletBalanceProvider = await deployWalletBalancerProvider(verify);
      console.log("WalletBalancerProvider deployed at:", walletBalanceProvider.address);
    }

    // this contract is not support upgrade, just deploy new contract
    if (protocol) {
      const bendProtocolDataProvider = await deployBendProtocolDataProvider(addressesProvider.address, verify);
      console.log("BendProtocolDataProvider deployed at:", bendProtocolDataProvider.address);
    }

    // this contract is not support upgrade, just deploy new contract
    if (ui) {
      const uiPoolDataProvider = await deployUiPoolDataProvider(reserveOracle, nftOracle, verify);
      console.log("UiPoolDataProvider deployed at:", uiPoolDataProvider.address);
    }
  });

import { task } from "hardhat/config";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getFirstSigner, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";
import { eNetwork } from "../../helpers/types";
import {
  deployBNFTRegistry,
  deployGenericBNFTImpl,
  deployLendPool,
  deployLendPoolLoan,
  deployReserveOracle,
  deployNFTOracle,
} from "../../helpers/contracts-deployments";

task("dev:deploy-new-implementation", "Deploy new implementation")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("contract", "Contract name")
  .setAction(async ({ verify, pool, contract }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    if (contract == "BNFTRegistry") {
      const bnftRegistryImpl = await deployBNFTRegistry(verify);
      console.log("BNFTRegistry implementation address:", bnftRegistryImpl.address);
    }

    if (contract == "BNFT") {
      const bnftGenericImpl = await deployGenericBNFTImpl(verify);
      console.log("BNFT implementation address:", bnftGenericImpl.address);
    }

    if (contract == "LendPool") {
      const lendPoolImpl = await deployLendPool(verify);
      console.log("LendPool implementation address:", lendPoolImpl.address);
    }

    if (contract == "LendPoolLoan") {
      const lendPoolLoanImpl = await deployLendPoolLoan(verify);
      console.log("LendPoolLoan implementation address:", lendPoolLoanImpl.address);
    }

    if (contract == "ReserveOracle") {
      const reserveOracleImpl = await deployReserveOracle(verify);
      console.log("ReserveOracle implementation address:", reserveOracleImpl.address);
    }

    if (contract == "NFTOracle") {
      const nftOracleImpl = await deployNFTOracle(verify);
      console.log("NFTOracle implementation address:", nftOracleImpl.address);
    }
  });

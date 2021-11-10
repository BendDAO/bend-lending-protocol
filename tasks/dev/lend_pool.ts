import { task } from "hardhat/config";
import {
  deployBTokenImplementations,
  deployBNFTImplementations,
  deployBTokensAndBNFTsHelper,
  deployLendPool,
  deployLendPoolConfigurator,
  deployLendPoolLoan,
} from "../../helpers/contracts-deployments";
import { eContractid } from "../../helpers/types";
import { waitForTx } from "../../helpers/misc-utils";
import {
  getBNFTRegistryProxy,
  getLendPoolAddressesProvider,
  getLendPool,
  getLendPoolConfiguratorProxy,
  getLendPoolLoanProxy,
} from "../../helpers/contracts-getters";
import { insertContractAddressInDb } from "../../helpers/contracts-helpers";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";

task("dev:deploy-lend-pool", "Deploy lend pool for dev enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");
    const addressesProvider = await getLendPoolAddressesProvider();
    const poolConfig = loadPoolConfig(pool);

    const bnftRegistryProxy = await getBNFTRegistryProxy();
    addressesProvider.setBNFTRegistry(bnftRegistryProxy.address);

    ////////////////////////////////////////////////////////////////////////////
    // deploy lend pool
    const lendPoolImpl = await deployLendPool(verify);

    // Set lend pool impl to Address Provider
    await waitForTx(await addressesProvider.setLendPoolImpl(lendPoolImpl.address));

    const address = await addressesProvider.getLendPool();
    const lendPoolProxy = await getLendPool(address);

    await insertContractAddressInDb(eContractid.LendPool, lendPoolProxy.address);

    ////////////////////////////////////////////////////////////////////////////
    // deploy lend pool configurator
    const lendPoolConfiguratorImpl = await deployLendPoolConfigurator(verify);

    // Set lend pool conf impl to Address Provider
    await waitForTx(await addressesProvider.setLendPoolConfiguratorImpl(lendPoolConfiguratorImpl.address));

    const lendPoolConfiguratorProxy = await getLendPoolConfiguratorProxy(
      await addressesProvider.getLendPoolConfigurator()
    );
    await insertContractAddressInDb(eContractid.LendPoolConfigurator, lendPoolConfiguratorProxy.address);

    ////////////////////////////////////////////////////////////////////////////
    // deploy lend pool loan
    const lendPoolLoanImpl = await deployLendPoolLoan(verify);

    // Set lend pool conf impl to Address Provider
    await waitForTx(await addressesProvider.setLendPoolLoanImpl(lendPoolLoanImpl.address));

    const lendPoolLoanProxy = await getLendPoolLoanProxy(await addressesProvider.getLendPoolLoan());
    await insertContractAddressInDb(eContractid.LendPoolLoan, lendPoolLoanProxy.address);

    ////////////////////////////////////////////////////////////////////////////
    // Deploy deployment helpers
    await deployBTokensAndBNFTsHelper(
      [lendPoolProxy.address, addressesProvider.address, lendPoolConfiguratorProxy.address],
      verify
    );

    // Generic BNFT Implementation at here
    await deployBTokenImplementations(pool, poolConfig.ReservesConfig, verify);

    // Generic BNFT Implementation in BNFT step, not here
    //await deployBNFTImplementations(pool, poolConfig.NftsConfig, verify);
  });

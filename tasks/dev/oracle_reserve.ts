import { task } from "hardhat/config";
import { deployReserveOracle } from "../../helpers/contracts-deployments";
import { deployAllChainlinkMockAggregators, setAggregatorsInReserveOracle } from "../../helpers/oracles-helpers";
import { tEthereumAddress } from "../../helpers/types";
import { waitForTx } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getAllMockedTokens, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";

task("dev:deploy-oracle-reserve", "Deploy reserve oracle for dev environment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);

    const addressesProvider = await getLendPoolAddressesProvider();

    const allTokenDecimals = Object.entries(poolConfig.ReservesConfig).reduce(
      (accum: { [tokenSymbol: string]: string }, [tokenSymbol, tokenConfig]) => ({
        ...accum,
        [tokenSymbol]: tokenConfig.reserveDecimals,
      }),
      {}
    );

    const mockTokens = await getAllMockedTokens();
    const allTokenAddresses = Object.entries(mockTokens).reduce(
      (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
        ...accum,
        [tokenSymbol]: tokenContract.address,
      }),
      {}
    );

    const mockAggregators = await deployAllChainlinkMockAggregators(
      allTokenDecimals,
      poolConfig.Mocks.AllAssetsInitialPrices,
      verify
    );

    const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
      (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
        ...accum,
        [tokenSymbol]: aggregator.address,
      }),
      {}
    );

    const reserveOracleImpl = await deployReserveOracle([], verify);
    await waitForTx(await reserveOracleImpl.initialize(mockTokens.WETH.address));
    await waitForTx(await addressesProvider.setReserveOracle(reserveOracleImpl.address));
    await setAggregatorsInReserveOracle(allTokenAddresses, allAggregatorsAddresses, reserveOracleImpl);
  });

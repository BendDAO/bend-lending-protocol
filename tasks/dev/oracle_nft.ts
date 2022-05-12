import { task } from "hardhat/config";
import { deployNFTOracle } from "../../helpers/contracts-deployments";
import { addAssetsInNFTOracle, setPricesInNFTOracle } from "../../helpers/oracles-helpers";
import { tEthereumAddress } from "../../helpers/types";
import { waitForTx } from "../../helpers/misc-utils";
import { ConfigNames, loadPoolConfig } from "../../helpers/configuration";
import { getAllMockedNfts, getLendPoolAddressesProvider } from "../../helpers/contracts-getters";

task("dev:deploy-oracle-nft", "Deploy nft oracle for dev environment")
  .addFlag("verify", "Verify contracts at Etherscan")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run("set-DRE");
    const poolConfig = loadPoolConfig(pool);

    const addressesProvider = await getLendPoolAddressesProvider();

    const mockNfts = await getAllMockedNfts();

    const allNftAddresses = Object.entries(mockNfts).reduce(
      (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
        ...accum,
        [tokenSymbol]: tokenContract.address,
      }),
      {}
    );

    const allNftPrices = Object.entries(poolConfig.Mocks.AllNftsInitialPrices).reduce(
      (accum: { [tokenSymbol: string]: string }, [tokenSymbol, tokenPrice]) => ({
        ...accum,
        [tokenSymbol]: tokenPrice,
      }),
      {}
    );

    const nftOracleImpl = await deployNFTOracle(verify);
    await waitForTx(
      await nftOracleImpl.initialize(await addressesProvider.getPoolAdmin(), 2e17, 1e17, 1800, 600, 1800)
    );
    await waitForTx(await addressesProvider.setNFTOracle(nftOracleImpl.address));
    await addAssetsInNFTOracle(allNftAddresses, nftOracleImpl);
    await setPricesInNFTOracle(allNftPrices, allNftAddresses, nftOracleImpl);
  });

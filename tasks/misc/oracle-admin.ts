import { task } from "hardhat/config";
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from "../../helpers/configuration";
import { MOCK_NFT_AGGREGATORS_PRICES, USD_ADDRESS } from "../../helpers/constants";
import {
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
  getNFTOracle,
  getReserveOracle,
} from "../../helpers/contracts-getters";
import { getParamPerNetwork } from "../../helpers/contracts-helpers";
import { getNowTimeInSeconds, waitForTx } from "../../helpers/misc-utils";
import { eNetwork } from "../../helpers/types";

task("oracle-amdin:set-price-feed-admin", "Doing oracle admin task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("feedAdmin", "Address of price feed")
  .setAction(async ({ pool, feedAdmin }, DRE) => {
    await DRE.run("set-DRE");

    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const nftOracleProxy = await getNFTOracle(await addressesProvider.getNFTOracle());

    console.log("Current PriceFeedAdmin:", await nftOracleProxy.priceFeedAdmin());

    await waitForTx(await nftOracleProxy.setPriceFeedAdmin(feedAdmin));
    console.log("New PriceFeedAdmin:", await nftOracleProxy.priceFeedAdmin());
  });

task("oracle-amdin:feed-init-nft-price", "Doing oracle admin task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const nftOracleProxy = await getNFTOracle(await addressesProvider.getNFTOracle());
    const latestTime = await getNowTimeInSeconds();
    const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);

    await waitForTx(
      await nftOracleProxy.setAssetData(nftsAssets["WPUNKS"], MOCK_NFT_AGGREGATORS_PRICES["WPUNKS"], latestTime, 1)
    );
    await waitForTx(
      await nftOracleProxy.setAssetData(nftsAssets["BAYC"], MOCK_NFT_AGGREGATORS_PRICES["BAYC"], latestTime, 1)
    );
  });

task("oracle-amdin:add-usd-eth-asset", "Doing oracle admin task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const oracle = await getReserveOracle(await addressesProvider.getReserveOracle());
    const owwnerAddress = await oracle.owner();
    const ownerSigner = DRE.ethers.provider.getSigner(owwnerAddress);

    const aggregators = getParamPerNetwork(poolConfig.ReserveAggregators, network);

    await waitForTx(await oracle.connect(ownerSigner).addAggregator(USD_ADDRESS, aggregators["USD"]));

    const price = await oracle.getAssetPrice(USD_ADDRESS);
    console.log("ETH-USD price:", price.toString());
  });

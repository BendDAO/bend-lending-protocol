import { task } from "hardhat/config";
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from "../../helpers/configuration";
import { MOCK_NFT_AGGREGATORS_PRICES, USD_ADDRESS } from "../../helpers/constants";
import { deployBendUpgradeableProxy, deployNFTOracle } from "../../helpers/contracts-deployments";
import {
  getIErc721Detailed,
  getLendPool,
  getLendPoolAddressesProvider,
  getLendPoolConfiguratorProxy,
  getNFTOracle,
  getReserveOracle,
} from "../../helpers/contracts-getters";
import { getEthersSignerByAddress, getParamPerNetwork } from "../../helpers/contracts-helpers";
import { getNowTimeInSeconds, waitForTx } from "../../helpers/misc-utils";
import { eNetwork } from "../../helpers/types";

task("oracle-admin:set-oracle-proxy", "Doing oracle admin task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("type", "Type of Oracle, 1-NFT, 2-Reserve")
  .addParam("proxy", "Address of NFT Oracle proxy contract")
  .setAction(async ({ pool, type, proxy }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();
    const ownerSigner = await getEthersSignerByAddress(await addressesProvider.owner());

    if (type == 1) {
      await waitForTx(await addressesProvider.connect(ownerSigner).setNFTOracle(proxy));
    } else if (type == 2) {
      await waitForTx(await addressesProvider.connect(ownerSigner).setReserveOracle(proxy));
    } else {
      throw Error("invalid type");
    }

    console.log("OK");
  });

task("oracle-admin:set-nft-assets", "Set new nft asset to oracle")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addParam("assets", "Address list of underlying nft asset contract")
  .setAction(async ({ pool, assets }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);

    const nftOracle = await getNFTOracle();
    const ownerSigner = await getEthersSignerByAddress(await nftOracle.owner());

    const assetsArray = new String(assets).split(",");

    for (const asset of assetsArray) {
      const isExisted = await nftOracle.nftPriceFeedMap(asset);
      if (isExisted) {
        throw Error(`Asset ${asset} existed in oracle already`);
      }

      const nftContract = await getIErc721Detailed(asset);
      const nftSymbol = await nftContract.symbol();
      if (nftSymbol.length <= 0) {
        throw Error(`Asset ${asset} has no symbol`);
      }
    }

    await waitForTx(await nftOracle.connect(ownerSigner).setAssets(assetsArray));

    console.log("OK");
  });

task("oracle-admin:set-price-feed-admin", "Doing oracle admin task")
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

task("oracle-admin:feed-init-nft-price", "Doing oracle admin task")
  .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ pool }, DRE) => {
    await DRE.run("set-DRE");

    const network = DRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getLendPoolAddressesProvider();

    const nftOracleProxy = await getNFTOracle(await addressesProvider.getNFTOracle());
    const latestTime = await getNowTimeInSeconds();
    const nftsAssets = getParamPerNetwork(poolConfig.NftsAssets, network);

    const feedAdminAddress = await nftOracleProxy.priceFeedAdmin();
    const feedAdminSigner = await getEthersSignerByAddress(feedAdminAddress);

    for (const nftSymbol of Object.keys(nftsAssets)) {
      const price = MOCK_NFT_AGGREGATORS_PRICES[nftSymbol];
      console.log(`setAssetData:(${nftSymbol}, ${price})`);
      await waitForTx(await nftOracleProxy.connect(feedAdminSigner).setAssetData(nftsAssets[nftSymbol], price));
    }
  });

task("oracle-admin:add-usd-eth-asset", "Doing oracle admin task")
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

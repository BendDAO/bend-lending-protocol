import { ethers } from "ethers";
import { tEthereumAddress, iAssetAggregatorBase, SymbolMap, PoolConfiguration } from "./types";

import { ReserveOracle } from "../types/ReserveOracle";
import { NFTOracle } from "../types/NFTOracle";
import { MockChainlinkOracle } from "../types/MockChainlinkOracle";
import { deployMockChainlinkOracle } from "./contracts-deployments";
import { getNowTimeInSeconds, waitForTx } from "./misc-utils";
import { getAllMockedTokens } from "./contracts-getters";
import { MOCK_USD_PRICE, USD_ADDRESS } from "./constants";

export const setPricesInChainlinkMockAggregator = async (
  prices: SymbolMap<string>,
  assetsAddresses: SymbolMap<tEthereumAddress>,
  reserveAggregatorInstance: MockChainlinkOracle
) => {
  for (const [assetSymbol, price] of Object.entries(prices) as [string, string][]) {
    const assetAddressIndex = Object.keys(assetsAddresses).findIndex((value) => value === assetSymbol);
    const [, assetAddress] = (Object.entries(assetsAddresses) as [string, string][])[assetAddressIndex];
    await reserveAggregatorInstance.mockAddAnswer("1", price, "1", "1", "1");
  }
};

export const setAggregatorsInReserveOracle = async (
  allAssetsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  priceOracleInstance: ReserveOracle
) => {
  for (const [assetSymbol, assetAddress] of Object.entries(allAssetsAddresses) as [string, tEthereumAddress][]) {
    const aggAddressIndex = Object.keys(aggregatorsAddresses).findIndex((value) => value === assetSymbol);
    if (aggAddressIndex < 0) {
      throw Error(`can not find aggregator for ${assetSymbol}`);
    }
    const [, aggAddress] = (Object.entries(aggregatorsAddresses) as [string, tEthereumAddress][])[aggAddressIndex];
    //console.log("assetSymbol", assetSymbol, "assetAddress", assetAddress, "aggAddress", aggAddress);
    const assetBytes32 = ethers.utils.zeroPad(ethers.utils.arrayify(assetAddress), 32);
    //console.log("assetBytes32", assetBytes32);
    console.log("setAggregatorsInReserveOracle", assetSymbol, assetAddress, aggAddress);
    await waitForTx(await priceOracleInstance.addAggregator(assetAddress, aggAddress));
  }
};

export const addAssetsInNFTOracle = async (
  assetsAddresses: SymbolMap<tEthereumAddress>,
  nftOracleInstance: NFTOracle
) => {
  for (const [assetSymbol, assetAddress] of Object.entries(assetsAddresses) as [string, tEthereumAddress][]) {
    console.log("addAssetsInNFTOracle", assetSymbol, assetAddress);
    await waitForTx(await nftOracleInstance.addAsset(assetAddress));
  }
};

export const setPricesInNFTOracle = async (
  prices: SymbolMap<string>,
  assetsAddresses: SymbolMap<tEthereumAddress>,
  nftOracleInstance: NFTOracle
) => {
  for (const [assetSymbol, assetAddress] of Object.entries(assetsAddresses) as [string, string][]) {
    const priceIndex = Object.keys(prices).findIndex((value) => value === assetSymbol);
    if (priceIndex == undefined) {
      console.log("can not find price for asset", assetSymbol, assetAddress);
      continue;
    }
    const [, price] = (Object.entries(prices) as [string, string][])[priceIndex];
    console.log("setPricesInNFTOracle", assetSymbol, assetAddress, price);
    await waitForTx(await nftOracleInstance.setAssetData(assetAddress, price));
  }
};

export const deployAllChainlinkMockAggregators = async (
  allTokenDecimals: { [tokenSymbol: string]: string },
  initialPrices: iAssetAggregatorBase<string>,
  verify?: boolean
) => {
  const aggregators: { [tokenSymbol: string]: MockChainlinkOracle } = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    if (tokenContractName !== "ETH") {
      const priceIndex = Object.keys(initialPrices).findIndex((value) => value === tokenContractName);
      if (priceIndex < 0) {
        throw Error(`can not find price for ${tokenContractName}`);
      }
      const [, price] = (Object.entries(initialPrices) as [string, string][])[priceIndex];

      //all reserves price must be ETH based, so aggregtaor decimals is 18
      //const decimals = allTokenDecimals[tokenContractName];
      const decimals = "18";

      aggregators[tokenContractName] = await deployChainlinkMockAggregator(tokenContractName, decimals, price, verify);
    }
  }
  return aggregators;
};

export const deployChainlinkMockAggregator = async (
  tokenName: string,
  tokenDecimal: string,
  initialPrice: string,
  verify?: boolean
) => {
  const latestTime = await getNowTimeInSeconds();
  const aggregator = await deployMockChainlinkOracle(tokenDecimal, verify);
  console.log("ChainlinkMockAggregator,", tokenName, aggregator.address, initialPrice, tokenDecimal);
  await aggregator.mockAddAnswer(1, initialPrice, latestTime, latestTime, "1");
  return aggregator;
};

export const deployAllReservesMockAggregatorsInPoolConfig = async (poolConfig: PoolConfiguration, verify?: boolean) => {
  const allTokenDecimals = Object.entries(poolConfig.ReservesConfig).reduce(
    (accum: { [tokenSymbol: string]: string }, [tokenSymbol, tokenConfig]) => ({
      ...accum,
      [tokenSymbol]: tokenConfig.reserveDecimals,
    }),
    {}
  );

  const mockAggregators = await deployAllChainlinkMockAggregators(
    allTokenDecimals,
    poolConfig.Mocks.AllAssetsInitialPrices,
    verify
  );
  const usdMockAggregator = await deployChainlinkMockAggregator("USD", "8", MOCK_USD_PRICE);

  const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
      ...accum,
      [tokenSymbol]: aggregator.address,
    }),
    {
      USD: usdMockAggregator.address,
    }
  );

  return allAggregatorsAddresses;
};

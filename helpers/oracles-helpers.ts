import { ethers } from "ethers";
import {
  tEthereumAddress,
  iAssetBase,
  iAssetAggregatorBase,
  iNftBase,
  iNftAggregatorBase,
  SymbolMap,
} from "./types";

import { ReserveOracle } from "../types/ReserveOracle";
import { NFTOracle } from "../types/NFTOracle";
import { BendOracle } from "../types/BendOracle";
import { ChainlinkMock } from "../types/ChainlinkMock";
import { deployChainlinkMock } from "./contracts-deployments";
import { chunk, waitForTx } from "./misc-utils";
import { ChainlinkMockFactory } from "../types";

export const setPricesInChainlinkMockAggregator = async (
  prices: SymbolMap<string>,
  assetsAddresses: SymbolMap<tEthereumAddress>,
  reserveAggregatorInstance: ChainlinkMock
) => {
  for (const [assetSymbol, price] of Object.entries(prices) as [
    string,
    string
  ][]) {
    const assetAddressIndex = Object.keys(assetsAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, assetAddress] = (
      Object.entries(assetsAddresses) as [string, string][]
    )[assetAddressIndex];
    await reserveAggregatorInstance.mockAddAnswer("1", price, "1", "1", "1");
  }
};

export const setAggregatorsInReserveOracle = async (
  allAssetsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  priceOracleInstance: ReserveOracle
) => {
  for (const [assetSymbol, assetAddress] of Object.entries(
    allAssetsAddresses
  ) as [string, tEthereumAddress][]) {
    const aggAddressIndex = Object.keys(aggregatorsAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, aggAddress] = (
      Object.entries(aggregatorsAddresses) as [string, tEthereumAddress][]
    )[aggAddressIndex];
    //console.log("assetSymbol", assetSymbol, "assetAddress", assetAddress, "aggAddress", aggAddress);
    const assetBytes32 = ethers.utils.zeroPad(
      ethers.utils.arrayify(assetAddress),
      32
    );
    //console.log("assetBytes32", assetBytes32);
    console.log(
      "setAggregatorsInReserveOracle",
      assetSymbol,
      assetAddress,
      aggAddress
    );
    await waitForTx(
      await priceOracleInstance.addAggregator(assetAddress, aggAddress)
    );
  }
};

export const addAssetsInNFTOracle = async (
  assetsAddresses: SymbolMap<tEthereumAddress>,
  nftOracleInstance: NFTOracle
) => {
  for (const [assetSymbol, assetAddress] of Object.entries(assetsAddresses) as [
    string,
    tEthereumAddress
  ][]) {
    console.log("addAssetsInNFTOracle", assetSymbol, assetAddress);
    await waitForTx(await nftOracleInstance.addAsset(assetAddress));
  }
};

export const setPricesInNFTOracle = async (
  prices: SymbolMap<string>,
  assetsAddresses: SymbolMap<tEthereumAddress>,
  nftOracleInstance: NFTOracle
) => {
  for (const [assetSymbol, price] of Object.entries(prices) as [
    string,
    string
  ][]) {
    const assetAddressIndex = Object.keys(assetsAddresses).findIndex(
      (value) => value === assetSymbol
    );
    const [, assetAddress] = (
      Object.entries(assetsAddresses) as [string, string][]
    )[assetAddressIndex];
    console.log("setPricesInNFTOracle", assetSymbol, assetAddress, price);
    await waitForTx(
      await nftOracleInstance.setAssetData(
        assetAddress,
        price,
        "1444004400",
        "10001"
      )
    );
  }
};

export const setAssetContractsInBendOracle = async (
  allAssetsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  oracleContract: tEthereumAddress,
  bendOracleInstance: BendOracle
) => {
  for (const [assetSymbol, assetAddress] of Object.entries(
    allAssetsAddresses
  ) as [string, tEthereumAddress][]) {
    console.log("setAssetContractsInBendOracle", assetSymbol, assetAddress);
    await waitForTx(
      await bendOracleInstance.setOracleContract(assetAddress, oracleContract)
    );
  }
};

export const deployAllChainlinkMockAggregators = async (
  allTokenDecimals: { [tokenSymbol: string]: string },
  initialPrices: iAssetAggregatorBase<string>,
  verify?: boolean
) => {
  const aggregators: { [tokenSymbol: string]: ChainlinkMock } = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    if (tokenContractName !== "ETH") {
      const priceIndex = Object.keys(initialPrices).findIndex(
        (value) => value === tokenContractName
      );
      const [, price] = (Object.entries(initialPrices) as [string, string][])[
        priceIndex
      ];
      aggregators[tokenContractName] = await deployChainlinkMock(
        allTokenDecimals[tokenContractName],
        verify
      );
      console.log(
        "ChainlinkMockAggregator,",
        tokenContractName,
        aggregators[tokenContractName].address,
        price,
        allTokenDecimals[tokenContractName]
      );
      await aggregators[tokenContractName].mockAddAnswer(
        "1",
        price,
        "1",
        "1",
        "1"
      );
    }
  }
  return aggregators;
};

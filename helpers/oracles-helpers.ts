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
import { MockAggregator } from "../types/MockAggregator";
import { deployMockReserveAggregator } from "./contracts-deployments";
import { chunk, waitForTx } from "./misc-utils";

export const setInitialAssetPricesInOracle = async (
  prices: iAssetBase<tEthereumAddress>,
  assetsAddresses: iAssetBase<tEthereumAddress>,
  priceOracleInstance: ReserveOracle
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
    await waitForTx(
      await priceOracleInstance.setAssetPrice(assetAddress, price)
    );
  }
};

export const setAssetPricesInOracle = async (
  prices: SymbolMap<string>,
  assetsAddresses: SymbolMap<tEthereumAddress>,
  priceOracleInstance: ReserveOracle
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
    await waitForTx(
      await priceOracleInstance.setAssetPrice(assetAddress, price)
    );
  }
};

export const setReserveAggregatorsInOracle = async (
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
    await waitForTx(
      await priceOracleInstance.addAggregator(assetAddress, aggAddress)
    );
  }
};

export const setNftAggregatorsInOracle = async (
  allAssetsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  priceOracleInstance: NFTOracle
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
    // await waitForTx(
    //   await priceOracleInstance.addAggregator(assetAddress, aggAddress)
    // );
  }
};

export const deployMockReserveAggregators = async (
  initialPrices: SymbolMap<string>,
  verify?: boolean
) => {
  const aggregators: { [tokenSymbol: string]: MockAggregator } = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    if (tokenContractName !== "ETH") {
      const priceIndex = Object.keys(initialPrices).findIndex(
        (value) => value === tokenContractName
      );
      const [, price] = (Object.entries(initialPrices) as [string, string][])[
        priceIndex
      ];
      aggregators[tokenContractName] = await deployMockReserveAggregator(
        price,
        verify
      );
    }
  }
  return aggregators;
};

export const deployAllMockReserveAggregators = async (
  initialPrices: iAssetAggregatorBase<string>,
  verify?: boolean
) => {
  const aggregators: { [tokenSymbol: string]: MockAggregator } = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    if (tokenContractName !== "ETH") {
      const priceIndex = Object.keys(initialPrices).findIndex(
        (value) => value === tokenContractName
      );
      const [, price] = (Object.entries(initialPrices) as [string, string][])[
        priceIndex
      ];
      aggregators[tokenContractName] = await deployMockReserveAggregator(
        price,
        verify
      );
    }
  }
  return aggregators;
};

export const deployAllMockNftAggregators = async (
  initialPrices: iNftAggregatorBase<string>,
  verify?: boolean
) => {
  const aggregators: { [tokenSymbol: string]: MockAggregator } = {};
  for (const tokenContractName of Object.keys(initialPrices)) {
    const priceIndex = Object.keys(initialPrices).findIndex(
      (value) => value === tokenContractName
    );
    const [, price] = (Object.entries(initialPrices) as [string, string][])[
      priceIndex
    ];
    aggregators[tokenContractName] = await deployMockReserveAggregator(
      price,
      verify
    );
  }
  return aggregators;
};

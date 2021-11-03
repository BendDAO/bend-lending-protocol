import { tEthereumAddress } from "./types";
import { MockChainlinkOracle } from "../types/MockChainlinkOracle";
import { MockTokenMap, MockNftMap } from "./contracts-helpers";

export const getAllTokenAddresses = (mockTokens: MockTokenMap) =>
  Object.entries(mockTokens).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {}
  );

export const getAllNftAddresses = (mockNfts: MockNftMap) =>
  Object.entries(mockNfts).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
      ...accum,
      [tokenSymbol]: tokenContract.address,
    }),
    {}
  );

export const getAllAggregatorsAddresses = (mockAggregators: { [tokenSymbol: string]: MockChainlinkOracle }) =>
  Object.entries(mockAggregators).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
      ...accum,
      [tokenSymbol]: aggregator.address,
    }),
    {}
  );

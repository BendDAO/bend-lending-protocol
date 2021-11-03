import { tEthereumAddress } from "./types";
import { ChainlinkMock } from "../types/ChainlinkMock";
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

export const getAllAggregatorsAddresses = (mockAggregators: { [tokenSymbol: string]: ChainlinkMock }) =>
  Object.entries(mockAggregators).reduce(
    (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
      ...accum,
      [tokenSymbol]: aggregator.address,
    }),
    {}
  );

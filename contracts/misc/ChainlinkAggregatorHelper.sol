// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IReserveOracle} from "../interfaces/IReserveOracle.sol";

/*
  @dev Helper contract for reserve oracle subgraph services
 */
contract ChainlinkAggregatorHelper is Initializable, OwnableUpgradeable {
  event ReserveAggregatorUpdated(address indexed reserve, address indexed aggregator);
  event ReserveAggregatorRemoved(address indexed reserve, address indexed aggregator);

  address public addressProvider;
  mapping(address => address) public reserveAggregators;

  function initialize(address addressProvider_) external initializer {
    __Ownable_init();

    addressProvider = addressProvider_;
  }

  /*
    @dev update reserve (internal) aggregator for subgraph services
    * @param reserve The address of the reserve
    * @param aggregator The address of the internal aggregator
   */
  function updateReserveAggregator(address reserve, address aggregator) external onlyOwner {
    ILendPoolAddressesProvider provider = ILendPoolAddressesProvider(addressProvider);
    IReserveOracle oracle = IReserveOracle(provider.getReserveOracle());

    AggregatorV3Interface curAggProxy = oracle.priceFeedMap(reserve);
    require(address(curAggProxy) != address(0), "ChainlinkAggregatorHelper: reserve not exist");
    require(address(curAggProxy) != aggregator, "ChainlinkAggregatorHelper: aggregator is proxy");

    require(reserveAggregators[reserve] != aggregator, "ChainlinkAggregatorHelper: aggregator is same");
    reserveAggregators[reserve] = aggregator;
    emit ReserveAggregatorUpdated(reserve, aggregator);
  }

  /*
    @dev remove reserve (internal) aggregator for subgraph services
    * @param reserve The address of the reserve
    * @param aggregator The address of the internal aggregator
   */
  function removeReserveAggregator(address reserve) external onlyOwner {
    address aggregator = reserveAggregators[reserve];
    require(aggregator != address(0), "ChainlinkAggregatorHelper: aggregator is zero");

    delete reserveAggregators[reserve];
    emit ReserveAggregatorRemoved(reserve, aggregator);
  }
}

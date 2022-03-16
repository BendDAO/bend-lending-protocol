// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IReserveOracleGetter} from "../interfaces/IReserveOracleGetter.sol";
import {BlockContext} from "../utils/BlockContext.sol";

contract ReserveOracle is IReserveOracleGetter, OwnableUpgradeable, BlockContext {
  uint256 private constant TOKEN_DIGIT = 10**18;

  event AggregatorAdded(address currencyKey, address aggregator);
  event AggregatorRemoved(address currencyKey, address aggregator);

  // key by currency symbol, eg USDT
  mapping(address => AggregatorV3Interface) public priceFeedMap;
  address[] public priceFeedKeys;

  address public weth;

  function initialize(address _weth) public initializer {
    __Ownable_init();
    weth = _weth;
  }

  function setAggregators(address[] calldata _priceFeedKeys, address[] calldata _aggregators) external onlyOwner {
    require(_priceFeedKeys.length == _aggregators.length, "ReserveOracle: INCONSISTENT_PARAMS_LENGTH");
    for (uint256 i = 0; i < _priceFeedKeys.length; i++) {
      _addAggregator(_priceFeedKeys[i], _aggregators[i]);
    }
  }

  function addAggregator(address _priceFeedKey, address _aggregator) external onlyOwner {
    _addAggregator(_priceFeedKey, _aggregator);
  }

  function _addAggregator(address _priceFeedKey, address _aggregator) internal {
    requireNonEmptyAddress(_priceFeedKey);
    requireNonEmptyAddress(_aggregator);
    if (address(priceFeedMap[_priceFeedKey]) == address(0)) {
      priceFeedKeys.push(_priceFeedKey);
    }
    priceFeedMap[_priceFeedKey] = AggregatorV3Interface(_aggregator);
    emit AggregatorAdded(_priceFeedKey, address(_aggregator));
  }

  function removeAggregator(address _priceFeedKey) external onlyOwner {
    address aggregator = address(priceFeedMap[_priceFeedKey]);
    requireNonEmptyAddress(aggregator);
    delete priceFeedMap[_priceFeedKey];

    uint256 length = priceFeedKeys.length;
    for (uint256 i = 0; i < length; i++) {
      if (priceFeedKeys[i] == _priceFeedKey) {
        // if the removal item is the last one, just `pop`
        if (i != length - 1) {
          priceFeedKeys[i] = priceFeedKeys[length - 1];
        }
        priceFeedKeys.pop();
        emit AggregatorRemoved(_priceFeedKey, aggregator);
        break;
      }
    }
  }

  function getAggregator(address _priceFeedKey) public view returns (AggregatorV3Interface) {
    return priceFeedMap[_priceFeedKey];
  }

  function getAssetPrice(address _priceFeedKey) external view override returns (uint256) {
    if (_priceFeedKey == weth) {
      return 1 ether;
    }
    require(isExistedKey(_priceFeedKey), "ReserveOracle: key not existed");
    AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);

    (, int256 _price, , , ) = aggregator.latestRoundData();
    require(_price >= 0, "ReserveOracle: negative answer");
    uint8 decimals = aggregator.decimals();

    return formatDecimals(uint256(_price), decimals);
  }

  function getLatestTimestamp(address _priceFeedKey) public view returns (uint256) {
    AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
    requireNonEmptyAddress(address(aggregator));

    (, , , uint256 timestamp, ) = aggregator.latestRoundData();

    return timestamp;
  }

  function getTwapPrice(address _priceFeedKey, uint256 _interval) external view override returns (uint256) {
    require(isExistedKey(_priceFeedKey), "ReserveOracle: key not existed");
    require(_interval != 0, "ReserveOracle: interval can't be 0");

    AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
    (uint80 roundId, int256 _price, , uint256 timestamp, ) = aggregator.latestRoundData();
    require(_price >= 0, "ReserveOracle: negative answer");
    uint8 decimals = aggregator.decimals();

    uint256 latestPrice = formatDecimals(uint256(_price), decimals);

    require(roundId >= 0, "ReserveOracle: Not enough history");
    uint256 latestTimestamp = timestamp;
    uint256 baseTimestamp = _blockTimestamp() - _interval;
    // if latest updated timestamp is earlier than target timestamp, return the latest price.
    if (latestTimestamp < baseTimestamp || roundId == 0) {
      return latestPrice;
    }

    // rounds are like snapshots, latestRound means the latest price snapshot. follow chainlink naming
    uint256 cumulativeTime = _blockTimestamp() - latestTimestamp;
    uint256 previousTimestamp = latestTimestamp;
    uint256 weightedPrice = latestPrice * cumulativeTime;
    while (true) {
      if (roundId == 0) {
        // if cumulative time is less than requested interval, return current twap price
        return weightedPrice / cumulativeTime;
      }

      roundId = roundId - 1;
      // get current round timestamp and price
      (, int256 _priceTemp, , uint256 currentTimestamp, ) = aggregator.getRoundData(roundId);
      require(_priceTemp >= 0, "ReserveOracle: negative answer");

      uint256 price = formatDecimals(uint256(_priceTemp), decimals);

      // check if current round timestamp is earlier than target timestamp
      if (currentTimestamp <= baseTimestamp) {
        // weighted time period will be (target timestamp - previous timestamp). For example,
        // now is 1000, _interval is 100, then target timestamp is 900. If timestamp of current round is 970,
        // and timestamp of NEXT round is 880, then the weighted time period will be (970 - 900) = 70,
        // instead of (970 - 880)
        weightedPrice = weightedPrice + (price * (previousTimestamp - baseTimestamp));
        break;
      }

      uint256 timeFraction = previousTimestamp - currentTimestamp;
      weightedPrice = weightedPrice + (price * timeFraction);
      cumulativeTime = cumulativeTime + timeFraction;
      previousTimestamp = currentTimestamp;
    }
    return weightedPrice / _interval;
  }

  function isExistedKey(address _priceFeedKey) private view returns (bool) {
    uint256 length = priceFeedKeys.length;
    for (uint256 i = 0; i < length; i++) {
      if (priceFeedKeys[i] == _priceFeedKey) {
        return true;
      }
    }
    return false;
  }

  function requireNonEmptyAddress(address _addr) internal pure {
    require(_addr != address(0), "ReserveOracle: empty address");
  }

  function formatDecimals(uint256 _price, uint8 _decimals) internal pure returns (uint256) {
    return (_price * TOKEN_DIGIT) / (10**uint256(_decimals));
  }

  function getPriceFeedLength() public view returns (uint256 length) {
    return priceFeedKeys.length;
  }
}

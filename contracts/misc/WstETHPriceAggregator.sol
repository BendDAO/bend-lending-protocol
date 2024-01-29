// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {AggregatorInterface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorInterface.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {AggregatorV2V3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV2V3Interface.sol";

import "../interfaces/IWstETH.sol";

import {Errors} from "../libraries/helpers/Errors.sol";

/**
 * @title wstETH price aggregator
 * @notice A custom price aggregator that calculates the price for wstETH / ETH
 */
contract WstETHPriceAggregator is AggregatorV2V3Interface {
  /// @notice Version of the price feed
  uint256 private constant _version = 1;

  /// @notice Description of the price feed
  string private constant _description = "wstETH / ETH";

  /// @notice Chainlink stETH / ETH price feed
  address public stETHtoETHPriceAggregator;

  /// @notice Number of decimals for the stETH / ETH price feed
  uint8 public stETHtoETHPriceAggregatorDecimals;

  /// @notice WstETH contract address
  address public wstETH;

  /// @notice Scale for WstETH contract
  int256 private _wstETHScale;

  constructor(address stETHtoETHPriceAggregator_, address wstETH_) {
    stETHtoETHPriceAggregator = stETHtoETHPriceAggregator_;
    stETHtoETHPriceAggregatorDecimals = AggregatorV3Interface(stETHtoETHPriceAggregator_).decimals();
    wstETH = wstETH_;

    // Note: Safe to convert directly to an int256 because wstETH.decimals == 18
    _wstETHScale = int256(10**IWstETH(wstETH).decimals());

    require(stETHtoETHPriceAggregatorDecimals == 18, Errors.RC_INVALID_DECIMALS);
  }

  function signed256(uint256 n) internal pure returns (int256) {
    require(n <= uint256(type(int256).max), Errors.MATH_NUMBER_OVERFLOW);
    return int256(n);
  }

  // AggregatorInterface

  function latestAnswer() external view override returns (int256) {
    int256 stETHPrice = AggregatorInterface(stETHtoETHPriceAggregator).latestAnswer();
    int256 scaledPrice = _convertStETHPrice(stETHPrice);
    return scaledPrice;
  }

  function latestTimestamp() external view override returns (uint256) {
    return AggregatorInterface(stETHtoETHPriceAggregator).latestTimestamp();
  }

  function latestRound() external view override returns (uint256) {
    return AggregatorInterface(stETHtoETHPriceAggregator).latestRound();
  }

  function getAnswer(uint256 roundId) external view override returns (int256) {
    int256 stETHPrice = AggregatorInterface(stETHtoETHPriceAggregator).getAnswer(roundId);
    int256 scaledPrice = _convertStETHPrice(stETHPrice);
    return scaledPrice;
  }

  function getTimestamp(uint256 roundId) external view override returns (uint256) {
    return AggregatorInterface(stETHtoETHPriceAggregator).getTimestamp(roundId);
  }

  // AggregatorV3Interface

  function decimals() external view override returns (uint8) {
    return stETHtoETHPriceAggregatorDecimals;
  }

  function description() external pure override returns (string memory) {
    return _description;
  }

  function version() external pure override returns (uint256) {
    return _version;
  }

  function getRoundData(uint80 _roundId)
    external
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    (
      uint80 roundId_,
      int256 stETHPrice,
      uint256 startedAt_,
      uint256 updatedAt_,
      uint80 answeredInRound_
    ) = AggregatorV3Interface(stETHtoETHPriceAggregator).getRoundData(_roundId);
    int256 scaledPrice = _convertStETHPrice(stETHPrice);
    return (roundId_, scaledPrice, startedAt_, updatedAt_, answeredInRound_);
  }

  function latestRoundData()
    external
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    (
      uint80 roundId_,
      int256 stETHPrice,
      uint256 startedAt_,
      uint256 updatedAt_,
      uint80 answeredInRound_
    ) = AggregatorV3Interface(stETHtoETHPriceAggregator).latestRoundData();
    int256 scaledPrice = _convertStETHPrice(stETHPrice);
    return (roundId_, scaledPrice, startedAt_, updatedAt_, answeredInRound_);
  }

  function _convertStETHPrice(int256 stETHPrice) internal view returns (int256) {
    uint256 tokensPerStEth = IWstETH(wstETH).tokensPerStEth();
    int256 scaledPrice = (stETHPrice * _wstETHScale) / signed256(tokensPerStEth);
    return scaledPrice;
  }
}

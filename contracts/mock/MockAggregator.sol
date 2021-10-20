// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IChainlinkAggregator} from "../interfaces/IChainlinkAggregator.sol";

contract MockAggregator is IChainlinkAggregator {
    int256 private _latestAnswer;

    // v2
    constructor(int256 _initialAnswer) public {
        _latestAnswer = _initialAnswer;
    }

    function latestAnswer() external view override returns (int256) {
        return _latestAnswer;
    }

    function latestTimestamp() external view override returns (uint256) {
        return block.timestamp;
    }

    function latestRound() external view override returns (uint256) {
        return 1;
    }

    function getAnswer(uint256 roundId)
        external
        view
        override
        returns (int256)
    {
        return _latestAnswer;
    }

    function getTimestamp(uint256 roundId)
        external
        view
        override
        returns (uint256)
    {
        return block.timestamp;
    }

    // V3
    function decimals() external view override returns (uint8) {
        return 18;
    }

    function description() external view override returns (string memory) {
        return "MockAggregator";
    }

    function version() external view override returns (uint256) {
        return 1;
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
        return (1, _latestAnswer, block.timestamp, block.timestamp, 1);
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
        return (1, _latestAnswer, block.timestamp, block.timestamp, 1);
    }
}

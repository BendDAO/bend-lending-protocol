// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IChainlinkAggregator} from "../interfaces/IChainlinkAggregator.sol";

contract MockAggregator is IChainlinkAggregator {
    uint256 _version;
    string _description;
    uint8 _decimals;

    uint80 _roundId;
    int256 private _latestAnswer;

    // v2
    constructor(int256 _initialAnswer) {
        _version = 1;
        _description = "MockAggregator";
        _decimals = 18;

        _roundId = 1;
        _latestAnswer = _initialAnswer;
    }

    function latestAnswer() external view override returns (int256) {
        return _latestAnswer;
    }

    function latestTimestamp() external view override returns (uint256) {
        return block.timestamp;
    }

    function latestRound() external view override returns (uint256) {
        return _roundId;
    }

    function getAnswer(uint256 roundId)
        external
        view
        override
        returns (int256)
    {
        roundId;
        return _latestAnswer;
    }

    function getTimestamp(uint256 roundId)
        external
        view
        override
        returns (uint256)
    {
        roundId;
        return block.timestamp;
    }

    // V3
    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external view override returns (string memory) {
        return _description;
    }

    function version() external view override returns (uint256) {
        return _version;
    }

    function getRoundData(uint80 roundId_)
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
        roundId_;
        return (_roundId, _latestAnswer, block.timestamp, block.timestamp, 1);
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
        return (_roundId, _latestAnswer, block.timestamp, block.timestamp, 1);
    }
}

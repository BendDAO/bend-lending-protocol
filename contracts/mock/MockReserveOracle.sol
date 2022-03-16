// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

//import {IReserveOracle} from "../interfaces/IReserveOracle.sol";
import {ReserveOracle} from "../protocol/ReserveOracle.sol";

contract MockReserveOracle is ReserveOracle {
  uint256 private timestamp = 1444004400;
  uint256 private number = 10001;

  function mock_setBlockTimestamp(uint256 _timestamp) public {
    timestamp = _timestamp;
  }

  function mock_setBlockNumber(uint256 _number) public {
    number = _number;
  }

  function mock_getCurrentTimestamp() public view returns (uint256) {
    return _blockTimestamp();
  }

  // Override BlockContext here
  function _blockTimestamp() internal view override returns (uint256) {
    return timestamp;
  }

  function _blockNumber() internal view override returns (uint256) {
    return number;
  }
}

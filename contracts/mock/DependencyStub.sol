// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title DependencyStub
 * @dev Dependency Stub
 */
contract DependencyStub {
  constructor(uint256 val) {
    require(val != 0, "zero value");
  }
}

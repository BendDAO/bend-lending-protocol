// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../protocol/BToken.sol";

contract MockBTokenVersionN is BToken {
  uint256 public dummy1;
  uint256 public dummy2;

  function initializeVersionN(uint256 dummy1_, uint256 dummy2_) external initializer {
    dummy1 = dummy1_;
    dummy2 = dummy2_;
  }
}

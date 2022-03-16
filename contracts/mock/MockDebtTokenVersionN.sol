// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "../protocol/DebtToken.sol";

contract MockDebtTokenVersionN is DebtToken {
  uint256 public dummy1;
  uint256 public dummy2;

  function initializeVersionN(uint256 dummy1_, uint256 dummy2_) external initializer {
    dummy1 = dummy1_;
    dummy2 = dummy2_;
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IAaveLendPoolAddressesProvider} from "../adapters/interfaces/IAaveLendPoolAddressesProvider.sol";

contract MockAaveLendPoolAddressesProvider is IAaveLendPoolAddressesProvider {
  address public lendingPool;

  function setLendingPool(address lendingPool_) public {
    lendingPool = lendingPool_;
  }

  function getLendingPool() public view override returns (address) {
    return lendingPool;
  }
}

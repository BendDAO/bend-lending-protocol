// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAaveLendPoolAddressesProvider} from "../adapters/interfaces/IAaveLendPoolAddressesProvider.sol";
import {MockAaveLendPool} from "./MockAaveLendPool.sol";

contract MockAaveLendPoolAddressesProvider is IAaveLendPoolAddressesProvider {
  MockAaveLendPool public pool;

  constructor() {
    pool = new MockAaveLendPool();
  }

  function getLendingPool() external view override returns (address) {
    return address(pool);
  }
}

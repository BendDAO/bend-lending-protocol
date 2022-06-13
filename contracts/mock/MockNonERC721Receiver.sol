// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {ILendPool} from "../interfaces/ILendPool.sol";

/**
 * @title MockNonERC721Receiver
 * @dev Contract without onERC721Received method
 */
contract MockNonERC721Receiver {
  ILendPool public pool;

  constructor(address pool_) {
    pool = ILendPool(pool_);
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title BendCollector
 * @notice Stores all the BEND kept for incentives, just giving approval to the different
 * systems that will pull BEND funds for their specific use case
 * @author Bend
 **/
contract BendCollector is Initializable {
  /**
   * @dev initializes the contract upon assignment to the BendUpgradeableProxy
   */
  function initialize() external initializer {}
}

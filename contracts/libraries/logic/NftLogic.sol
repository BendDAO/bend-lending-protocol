// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {Errors} from "../helpers/Errors.sol";
import {DataTypes} from "../types/DataTypes.sol";

/**
 * @title NftLogic library
 * @author Bend
 * @notice Implements the logic to update the nft state
 */
library NftLogic {
  /**
   * @dev Initializes a nft
   * @param nft The nft object
   * @param bNftAddress The address of the bNFT contract
   **/
  function init(DataTypes.NftData storage nft, address bNftAddress) external {
    require(nft.bNftAddress == address(0), Errors.RL_RESERVE_ALREADY_INITIALIZED);

    nft.bNftAddress = bNftAddress;
  }
}

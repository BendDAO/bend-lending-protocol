// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/************
@title INFTOracleGetter interface
@notice Interface for getting NFT price oracle.*/
interface INFTOracleGetter {
  /***********
    @dev returns the asset price in ETH
     */
  function getAssetPrice(address asset) external view returns (uint256);
}

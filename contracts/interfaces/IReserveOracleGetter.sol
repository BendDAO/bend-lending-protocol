// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

/************
@title IReserveOracleGetter interface
@notice Interface for getting Reserve price oracle.*/
interface IReserveOracleGetter {
  /* CAUTION: Price uint is ETH based (WEI, 18 decimals) */
  /***********
    @dev returns the asset price in ETH
     */
  function getAssetPrice(address asset) external view returns (uint256);

  // get twap price depending on _period
  function getTwapPrice(address _priceFeedKey, uint256 _interval) external view returns (uint256);
}

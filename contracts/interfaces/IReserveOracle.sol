// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/************
@title IReserveOracle interface
@notice Interface for Reserve price oracle.*/
interface IReserveOracle {
    /***********
    @dev returns the asset price in ETH
     */
    function getAssetPrice(address asset) external view returns (uint256);

    /***********
    @dev sets the asset price, in wei
     */
    function setAssetPrice(address asset, uint256 price) external;
}

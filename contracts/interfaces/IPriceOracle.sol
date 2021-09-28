// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/************
@title IPriceOracle interface
@notice Interface for price oracle.*/
interface IPriceOracle {
    /***********
    @dev returns the asset price in ETH
     */
    function getCollateralPrice(address nftCollateral)
        external
        view
        returns (uint256);

    /***********
    @dev sets the asset price, in wei
     */
    function setCollateralPrice(address nftCollateral, uint256 price) external;
}

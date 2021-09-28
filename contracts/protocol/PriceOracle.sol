// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/IPriceOracle.sol";

contract PriceOracle is IPriceOracle {
    /***********
    @dev returns the asset price in ETH
     */
    function getCollateralPrice(address nftCollateral)
        external
        view
        override
        returns (uint256)
    {
        return 0;
    }

    /***********
    @dev sets the asset price, in wei
     */
    function setCollateralPrice(address nftCollateral, uint256 price)
        external
        override
    {}
}

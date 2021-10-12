// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/IReserveOracle.sol";

contract ReserveOracle is IReserveOracle {
    /***********
    @dev returns the reserve price in ETH
     */
    function getAssetPrice(address asset)
        external
        view
        override
        returns (uint256)
    {
        return 0;
    }

    /***********
    @dev sets the reserve price, in wei
     */
    function setAssetPrice(address asset, uint256 price) external override {}
}

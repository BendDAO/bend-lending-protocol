// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../interfaces/INFTOracle.sol";

contract NFTOracle is INFTOracle {
    /***********
    @dev returns the asset price in ETH
     */
    function getAssetPrice(address nftContract)
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
    function setAssetPrice(address nftContract, uint256 price)
        external
        override
    {}
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/************
@title INFTOracle interface
@notice Interface for NFT price oracle.*/
interface INFTOracle {
    /***********
    @dev returns the asset price in ETH
     */
    function getAssetPrice(address nftContract) external view returns (uint256);

    /***********
    @dev sets the asset price, in wei
     */
    function setAssetPrice(address nftContract, uint256 price) external;
}

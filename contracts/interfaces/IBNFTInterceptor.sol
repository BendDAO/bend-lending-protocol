// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface IBNFTInterceptor {
  /**
   * @dev Handles when mint is executed by the owner
   * @param nftAsset The address of the underlying asset of the BNFT
   * @param nftTokenId The token id of the underlying asset of the BNFT
   **/
  function preHandleMint(address nftAsset, uint256 nftTokenId) external returns (bool);

  /**
   * @dev Handles when mint is executed by the owner
   * @param nftAsset The address of the underlying asset of the BNFT
   * @param nftTokenId The token id of the underlying asset of the BNFT
   **/
  function preHandleBurn(address nftAsset, uint256 nftTokenId) external returns (bool);
}

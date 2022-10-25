// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface IBNFTBurnInterceptor {
  /**
   * @dev Handles before the burn is executed by the owner
   * @param nftAsset The address of the underlying asset of the BNFT
   * @param nftTokenId The token id of the underlying asset of the BNFT
   **/
  function beforeTokenBurn(address nftAsset, uint256 nftTokenId) external returns (bool);

  /**
   * @dev Handles after the burn is executed by the owner
   * @param nftAsset The address of the underlying asset of the BNFT
   * @param nftTokenId The token id of the underlying asset of the BNFT
   **/
  function afterTokenBurn(address nftAsset, uint256 nftTokenId) external returns (bool);
}

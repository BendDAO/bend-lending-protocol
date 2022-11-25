// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface ILoanRepaidInterceptor {
  /**
   * @dev Handles before the loan is repaid by the borrower
   * @param nftAsset The address of the underlying asset of the BNFT
   * @param nftTokenId The token id of the underlying asset of the BNFT
   **/
  function beforeLoanRepaid(address nftAsset, uint256 nftTokenId) external returns (bool);

  /**
   * @dev Handles after the loan is repaid by the borrower
   * @param nftAsset The address of the underlying asset of the BNFT
   * @param nftTokenId The token id of the underlying asset of the BNFT
   **/
  function afterLoanRepaid(address nftAsset, uint256 nftTokenId) external returns (bool);
}

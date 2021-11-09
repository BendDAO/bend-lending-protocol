// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {DataTypes} from "../libraries/types/DataTypes.sol";

interface ILendPoolLoan {
  /**
   * @dev Emitted on initialization to share location of dependent notes
   */
  event Initialized();

  /**
   * @dev Emitted when a loan is created
   */
  event LoanCreated(
    address indexed user,
    address indexed onBehalfOf,
    uint256 indexed loanId,
    address nftAsset,
    uint256 nftTokenId,
    address reserveAsset,
    uint256 amount,
    uint256 borrowIndex
  );

  /**
   * @dev Emitted when a loan is updated
   */
  event LoanUpdated(
    address indexed user,
    uint256 indexed loanId,
    address reserveAsset,
    uint256 amountAdded,
    uint256 amountTaken,
    uint256 borrowIndex
  );

  /**
   * @dev Emitted when a loan is repaid by the borrower
   */
  event LoanRepaid(
    address indexed user,
    uint256 indexed loanId,
    address nftAsset,
    uint256 nftTokenId,
    address reserveAsset,
    uint256 amount
  );

  /**
   * @dev Emitted when a loan is liquidate by the liquidator
   */
  event LoanLiquidated(
    address indexed user,
    uint256 indexed loanId,
    address nftAsset,
    uint256 nftTokenId,
    address reserveAsset,
    uint256 amount
  );

  function initNft(address nftAsset, address bNftAddress) external;

  /**
   * @dev Create store a loan object with some params
   * @param user The address receiving the borrowed bTokens, being the delegatee in case
   * of credit delegate, or same as `onBehalfOf` otherwise
   * @param onBehalfOf The address receiving the loan
   */
  function createLoan(
    address user,
    address onBehalfOf,
    address nftAsset,
    uint256 nftTokenId,
    address bNftAddress,
    address reserveAsset,
    uint256 amount,
    uint256 borrowIndex
  ) external returns (uint256);

  /**
   * @dev Update the given loan with some params
   *
   * Requirements:
   *  - The caller must be a holder of the loan
   *  - The loan must be in state Active
   * @param user The address receiving the borrowed bTokens, being the delegatee in case
   * of credit delegate, or same as `onBehalfOf` otherwise
   */
  function updateLoan(
    address user,
    uint256 loanId,
    uint256 amountAdded,
    uint256 amountTaken,
    uint256 borrowIndex
  ) external;

  /**
   * @dev Repay the given loan
   *
   * Requirements:
   *  - The caller must be a holder of the loan
   *  - The caller must send in principal + interest
   *  - The loan must be in state Active
   *
   * @param user The user receiving the returned underlying asset
   * @param loanId The loan getting burned
   * @param bNftAddress The address of bNFT
   */
  function repayLoan(
    address user,
    uint256 loanId,
    address bNftAddress
  ) external;

  /**
   * @dev Liquidate the given loan
   *
   * Requirements:
   *  - The caller must send in principal + interest
   *  - The loan must be in state Active
   *
   * @param user The user receiving the returned underlying asset
   * @param loanId The loan getting burned
   * @param bNftAddress The address of bNFT
   */
  function liquidateLoan(
    address user,
    uint256 loanId,
    address bNftAddress
  ) external;

  function borrowerOf(uint256 loanId) external view returns (address);

  function getCollateralLoanId(address nftAsset, uint256 nftTokenId) external view returns (uint256);

  function getLoan(uint256 loanId) external view returns (DataTypes.LoanData calldata loanData);

  function getLoanCollateralAndReserve(uint256 loanId)
    external
    view
    returns (
      address nftAsset,
      uint256 nftTokenId,
      address reserveAsset,
      uint256 scaledAmount
    );

  function getLoanReserveBorrowScaledAmount(uint256 loanId) external view returns (uint256);

  function getLoanReserveBorrowAmount(uint256 loanId) external view returns (uint256);

  function getNftCollateralAmount(address nftAsset) external view returns (uint256);

  function getUserNftCollateralAmount(address user, address nftAsset) external view returns (uint256);
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {DataTypes} from "../libraries/types/DataTypes.sol";

interface ILendPoolLoan {
  /**
   * @dev Emitted on initialization to share location of dependent notes
   * @param pool The address of the associated lend pool
   */
  event Initialized(address indexed pool);

  /**
   * @dev Emitted when a loan is created
   * @param user The address initiating the action
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
   * @param user The address initiating the action
   */
  event LoanUpdated(
    address indexed user,
    uint256 indexed loanId,
    address nftAsset,
    uint256 nftTokenId,
    address reserveAsset,
    uint256 amountAdded,
    uint256 amountTaken,
    uint256 borrowIndex
  );

  /**
   * @dev Emitted when a loan is repaid by the borrower
   * @param user The address initiating the action
   */
  event LoanRepaid(
    address indexed user,
    uint256 indexed loanId,
    address nftAsset,
    uint256 nftTokenId,
    address reserveAsset,
    uint256 amount,
    uint256 borrowIndex
  );

  /**
   * @dev Emitted when a loan is auction by the liquidator
   * @param user The address initiating the action
   */
  event LoanAuctioned(
    address indexed user,
    uint256 indexed loanId,
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount,
    uint256 borrowIndex,
    address bidder,
    uint256 price,
    address previousBidder,
    uint256 previousPrice
  );

  /**
   * @dev Emitted when a loan is redeemed
   * @param user The address initiating the action
   */
  event LoanRedeemed(
    address indexed user,
    uint256 indexed loanId,
    address nftAsset,
    uint256 nftTokenId,
    address reserveAsset,
    uint256 amountTaken,
    uint256 borrowIndex
  );

  /**
   * @dev Emitted when a loan is liquidate by the liquidator
   * @param user The address initiating the action
   */
  event LoanLiquidated(
    address indexed user,
    uint256 indexed loanId,
    address nftAsset,
    uint256 nftTokenId,
    address reserveAsset,
    uint256 amount,
    uint256 borrowIndex
  );

  function initNft(address nftAsset, address bNftAddress) external;

  /**
   * @dev Create store a loan object with some params
   * @param initiator The address of the user initiating the borrow
   * @param onBehalfOf The address receiving the loan
   */
  function createLoan(
    address initiator,
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
   * @param initiator The address of the user initiating the borrow
   */
  function updateLoan(
    address initiator,
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
   * @param initiator The address of the user initiating the repay
   * @param loanId The loan getting burned
   * @param bNftAddress The address of bNFT
   */
  function repayLoan(
    address initiator,
    uint256 loanId,
    address bNftAddress,
    uint256 amount,
    uint256 borrowIndex
  ) external;

  /**
   * @dev Auction the given loan
   *
   * Requirements:
   *  - The price must be greater than current highest price
   *  - The loan must be in state Active or Auction
   *
   * @param initiator The address of the user initiating the auction
   * @param loanId The loan getting auctioned
   * @param bidPrice The bid price of this auction
   */
  function auctionLoan(
    address initiator,
    uint256 loanId,
    address onBehalfOf,
    uint256 bidPrice,
    uint256 borrowAmount,
    uint256 borrowIndex
  ) external;

  /**
   * @dev Redeem the given loan with some params
   *
   * Requirements:
   *  - The caller must be a holder of the loan
   *  - The loan must be in state Auction
   * @param initiator The address of the user initiating the borrow
   */
  function redeemLoan(
    address initiator,
    uint256 loanId,
    uint256 amountTaken,
    uint256 borrowIndex
  ) external;

  /**
   * @dev Liquidate the given loan
   *
   * Requirements:
   *  - The caller must send in principal + interest
   *  - The loan must be in state Active
   *
   * @param initiator The address of the user initiating the auction
   * @param loanId The loan getting burned
   * @param bNftAddress The address of bNFT
   */
  function liquidateLoan(
    address initiator,
    uint256 loanId,
    address bNftAddress,
    uint256 borrowAmount,
    uint256 borrowIndex
  ) external;

  function borrowerOf(uint256 loanId) external view returns (address);

  function getCollateralLoanId(address nftAsset, uint256 nftTokenId) external view returns (uint256);

  function getLoan(uint256 loanId) external view returns (DataTypes.LoanData memory loanData);

  function getLoanCollateralAndReserve(uint256 loanId)
    external
    view
    returns (
      address nftAsset,
      uint256 nftTokenId,
      address reserveAsset,
      uint256 scaledAmount
    );

  function getLoanReserveBorrowScaledAmount(uint256 loanId) external view returns (address, uint256);

  function getLoanReserveBorrowAmount(uint256 loanId) external view returns (address, uint256);

  function getLoanHighestBid(uint256 loanId) external view returns (address, uint256);

  function getNftCollateralAmount(address nftAsset) external view returns (uint256);

  function getUserNftCollateralAmount(address user, address nftAsset) external view returns (uint256);
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {DataTypes} from "../libraries/types/DataTypes.sol";

interface ILendPoolLiquidator {
  /**
   * @dev Emitted when a borrower's loan is auctioned.
   * @param initiator The address of the user initiating the auction
   * @param reserve The address of the underlying asset of the reserve
   * @param price The price of the underlying reserve given by the bidder
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token id of the underlying NFT used as collateral
   * @param onBehalfOf The address that will be getting the NFT
   * @param loanId The loan ID of the NFT loans
   **/
  event Auction(
    address initiator,
    address indexed reserve,
    uint256 price,
    address indexed nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    uint256 loanId
  );

  /**
   * @dev Emitted on redeem()
   * @param initiator The address of the user initiating the redeem(), providing the funds
   * @param reserve The address of the underlying asset of the reserve
   * @param amount The amount repaid
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token id of the underlying NFT used as collateral
   * @param borrower The beneficiary of the repayment, getting his debt reduced
   * @param loanId The loan ID of the NFT loans
   **/
  event Redeem(
    address initiator,
    address indexed reserve,
    uint256 amount,
    address indexed nftAsset,
    uint256 nftTokenId,
    address indexed borrower,
    uint256 loanId,
    uint256 fine
  );

  /**
   * @dev Emitted when a borrower's loan is liquidated.
   * @param initiator The address of the user initiating the auction
   * @param reserve The address of the underlying asset of the reserve
   * @param repayAmount The amount of reserve repaid by the liquidator
   * @param borrowerAmount The amount of reserve received by the borrower
   * @param borrower The address of the borrower getting liquidated
   * @param loanId The loan ID of the NFT loans
   **/
  event Liquidate(
    address initiator,
    address indexed reserve,
    uint256 repayAmount,
    uint256 borrowerAmount,
    address indexed nftAsset,
    uint256 nftTokenId,
    address borrower,
    uint256 loanId
  );

  /**
   * @dev Function to auction a non-healthy position collateral-wise
   * - The caller (liquidator) want to buy collateral asset of the user getting liquidated
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token ID of the underlying NFT used as collateral
   * @param bidPrice The bid price of the liquidator want to buy the underlying NFT
   * @param onBehalfOf Address of the user who will get the underlying NFT, same as msg.sender if the user
   *   wants to receive them on his own wallet, or a different address if the beneficiary of NFT
   *   is a different wallet
   **/
  function auction(
    address nftAsset,
    uint256 nftTokenId,
    uint256 bidPrice,
    address onBehalfOf
  ) external;

  /**
   * @notice Redeem a NFT loan which state is in Auction
   * - E.g. User repays 100 USDC, burning loan and receives collateral asset
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token ID of the underlying NFT used as collateral
   **/
  function redeem(address nftAsset, uint256 nftTokenId) external returns (uint256 reapyAmount);

  /**
   * @dev Function to liquidate a non-healthy position collateral-wise
   * - The caller (liquidator) buy collateral asset of the user getting liquidated, and receives
   *   the collateral asset
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token ID of the underlying NFT used as collateral
   **/
  function liquidate(address nftAsset, uint256 nftTokenId) external;
}

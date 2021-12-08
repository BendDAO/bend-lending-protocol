// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IBToken} from "../interfaces/IBToken.sol";
import {IDebtToken} from "../interfaces/IDebtToken.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPoolLiquidator} from "../interfaces/ILendPoolLiquidator.sol";
import {INFTOracleGetter} from "../interfaces/INFTOracleGetter.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";
import {GenericLogic} from "../libraries/logic/GenericLogic.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";
import {ReserveLogic} from "../libraries/logic/ReserveLogic.sol";
import {NftLogic} from "../libraries/logic/NftLogic.sol";
import {ValidationLogic} from "../libraries/logic/ValidationLogic.sol";
import {ReserveConfiguration} from "../libraries/configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../libraries/configuration/NftConfiguration.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {LendPoolStorage} from "./LendPoolStorage.sol";

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

import "hardhat/console.sol";

/**
 * @title LendPoolLiquidator contract
 * @dev Implements the actions involving management of liquidation in the Bend Protocol
 * - Users can:
 *   # Auction
 *   # Redeem
 *   # Liquidate
 * IMPORTANT This contract will run always via DELEGATECALL, through the LendPool, so the chain of inheritance
 * is the same as the LendPool, to have compatible storage layouts
 * @author Bend
 **/
contract LendPoolLiquidator is Initializable, ILendPoolLiquidator, LendPoolStorage, ContextUpgradeable {
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using ReserveLogic for DataTypes.ReserveData;
  using NftLogic for DataTypes.NftData;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using NftConfiguration for DataTypes.NftConfigurationMap;

  struct AuctionLocalVars {
    address loanAddress;
    address initiator;
    uint256 loanId;
    uint256 thresholdPrice;
    uint256 liquidatePrice;
    uint256 borrowAmount;
    uint256 auctionEndTimestamp;
    uint256 remainAmount;
  }

  /**
   * @dev Function to auction a non-healthy position collateral-wise
   * - The bidder want to buy collateral asset of the user getting liquidated
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token ID of the underlying NFT used as collateral
   * @param bidPrice The bid price of the bidder want to buy underlying NFT
   * @param onBehalfOf Address of the user who will get the underlying NFT, same as msg.sender if the user
   *   wants to receive them on his own wallet, or a different address if the beneficiary of NFT
   *   is a different wallet
   **/
  function auction(
    address nftAsset,
    uint256 nftTokenId,
    uint256 bidPrice,
    address onBehalfOf
  ) external override {
    require(onBehalfOf != address(0), Errors.VL_INVALID_ONBEHALFOF_ADDRESS);

    AuctionLocalVars memory vars;
    vars.initiator = _msgSender();

    vars.loanAddress = _addressesProvider.getLendPoolLoan();
    vars.loanId = ILendPoolLoan(vars.loanAddress).getCollateralLoanId(nftAsset, nftTokenId);
    require(vars.loanId != 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.loanAddress).getLoan(vars.loanId);

    DataTypes.ReserveData storage reserveData = _reserves[loanData.reserveAsset];
    DataTypes.NftData storage nftData = _nfts[loanData.nftAsset];

    ValidationLogic.validateAuction(reserveData, nftData, loanData, bidPrice);

    // first time bid need to burn debt tokens and transfer reserve to bTokens
    if (loanData.state == DataTypes.LoanState.Active) {
      // update state MUST BEFORE get borrow amount which is depent on latest borrow index
      reserveData.updateState();

      (vars.borrowAmount, vars.thresholdPrice, vars.liquidatePrice) = GenericLogic.calculateLoanLiquidatePrice(
        vars.loanId,
        loanData.reserveAsset,
        reserveData,
        loanData.nftAsset,
        nftData,
        vars.loanAddress,
        _addressesProvider.getReserveOracle(),
        _addressesProvider.getNFTOracle()
      );

      // loan's accumulated debt must exceed threshold (heath factor below 1.0)
      require(vars.borrowAmount > vars.thresholdPrice, Errors.LP_BORROW_NOT_EXCEED_LIQUIDATION_THRESHOLD);

      // bid price must greater than liquidate price
      require(bidPrice >= vars.liquidatePrice, Errors.LPL_BID_PRICE_LESS_THAN_LIQUIDATION_PRICE);

      // bid price must greater than borrow debt
      require(bidPrice >= vars.borrowAmount, Errors.LPL_BID_PRICE_LESS_THAN_BORROW);

      if (bidPrice > vars.borrowAmount) {
        vars.remainAmount = bidPrice - vars.borrowAmount;
      }

      ILendPoolLoan(vars.loanAddress).auctionLoan(
        vars.initiator,
        vars.loanId,
        onBehalfOf,
        bidPrice,
        vars.borrowAmount,
        reserveData.variableBorrowIndex
      );

      IDebtToken(reserveData.debtTokenAddress).burn(
        loanData.borrower,
        vars.borrowAmount,
        reserveData.variableBorrowIndex
      );

      // update interest rate according latest borrow amount (utilizaton)
      reserveData.updateInterestRates(loanData.reserveAsset, reserveData.bTokenAddress, vars.borrowAmount, 0);

      // transfer borrow amount to bToken
      IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(
        vars.initiator,
        reserveData.bTokenAddress,
        vars.borrowAmount
      );

      // lock remain amount to pool, which will transfer to borrower after auction is ended
      IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(vars.initiator, address(this), vars.remainAmount);
    } else {
      // After first time, each bid price must greater than previous
      vars.borrowAmount = loanData.bidBorrowAmount;

      vars.auctionEndTimestamp = loanData.bidStartTimestamp + (nftData.configuration.getAuctionDuration() * 1 days);
      require(block.timestamp <= vars.auctionEndTimestamp, Errors.LPL_BID_AUCTION_DURATION_HAS_END);

      // bid price must greater than highest bid
      require(bidPrice > loanData.bidPrice, Errors.LPL_BID_PRICE_LESS_THAN_HIGHEST_PRICE);

      ILendPoolLoan(vars.loanAddress).auctionLoan(vars.initiator, vars.loanId, onBehalfOf, bidPrice, 0, 0);

      // lock highest bidder bid price amount to pool
      IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(vars.initiator, address(this), bidPrice);

      // return back bid price to previous bidder from pool
      if (loanData.bidderAddress != address(0)) {
        IERC20Upgradeable(loanData.reserveAsset).safeTransfer(loanData.bidderAddress, loanData.bidPrice);
      }
    }

    emit Auction(vars.initiator, nftAsset, nftTokenId, loanData.reserveAsset, bidPrice, onBehalfOf, vars.loanId);
  }

  struct RedeemLocalVars {
    address initiator;
    address poolLoan;
    uint256 loanId;
    uint256 repayAmountWithFine;
    uint256 bidFine;
    uint256 bidPriceWithFine;
    uint256 redeemEndTimestamp;
  }

  /**
   * @notice Redeem a NFT loan which state is in Auction
   * - E.g. User repays 100 USDC, burning loan and receives collateral asset
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token ID of the underlying NFT used as collateral
   **/
  function redeem(address nftAsset, uint256 nftTokenId) external override returns (uint256 repayAmount) {
    RedeemLocalVars memory vars;
    vars.initiator = _msgSender();

    vars.poolLoan = _addressesProvider.getLendPoolLoan();

    vars.loanId = ILendPoolLoan(vars.poolLoan).getCollateralLoanId(nftAsset, nftTokenId);
    require(vars.loanId != 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.poolLoan).getLoan(vars.loanId);

    DataTypes.ReserveData storage reserveData = _reserves[loanData.reserveAsset];
    DataTypes.NftData storage nftData = _nfts[loanData.nftAsset];

    ValidationLogic.validateRedeem(reserveData, nftData, loanData);

    vars.redeemEndTimestamp = (loanData.bidStartTimestamp + nftData.configuration.getRedeemDuration() * 1 days);
    require(block.timestamp <= vars.redeemEndTimestamp, Errors.LPL_BID_REDEEM_DURATION_HAS_END);

    vars.bidFine = loanData.bidPrice.percentMul(nftData.configuration.getRedeemFine());
    vars.bidPriceWithFine = loanData.bidPrice + vars.bidFine;

    vars.repayAmountWithFine = loanData.bidBorrowAmount + vars.bidFine;

    ILendPoolLoan(vars.poolLoan).liquidateLoan(vars.initiator, vars.loanId, nftData.bNftAddress, true);

    // transfer repay amount to pool
    IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(vars.initiator, address(this), vars.repayAmountWithFine);

    if (loanData.bidderAddress != address(0)) {
      // return back bid price amount and penalty fine to highest bidder
      IERC20Upgradeable(loanData.reserveAsset).safeTransfer(loanData.bidderAddress, vars.bidPriceWithFine);
    }

    emit Redeem(
      vars.initiator,
      loanData.reserveAsset,
      loanData.bidBorrowAmount,
      loanData.nftAsset,
      loanData.nftTokenId,
      loanData.borrower,
      vars.loanId,
      vars.bidFine
    );

    return (vars.repayAmountWithFine);
  }

  struct LiquidateLocalVars {
    address poolLoan;
    address initiator;
    uint256 loanId;
    uint256 remainAmount;
    uint256 auctionEndTimestamp;
  }

  /**
   * @dev Function to liquidate a non-healthy position collateral-wise
   * - The bidder buy collateral asset of the user getting liquidated, and receives
   *   the collateral asset
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token ID of the underlying NFT used as collateral
   **/
  function liquidate(address nftAsset, uint256 nftTokenId) external override {
    LiquidateLocalVars memory vars;
    vars.initiator = _msgSender();

    vars.poolLoan = _addressesProvider.getLendPoolLoan();

    vars.loanId = ILendPoolLoan(vars.poolLoan).getCollateralLoanId(nftAsset, nftTokenId);
    require(vars.loanId != 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.poolLoan).getLoan(vars.loanId);

    DataTypes.ReserveData storage reserveData = _reserves[loanData.reserveAsset];
    DataTypes.NftData storage nftData = _nfts[loanData.nftAsset];

    ValidationLogic.validateLiquidate(reserveData, nftData, loanData);

    vars.auctionEndTimestamp = loanData.bidStartTimestamp + (nftData.configuration.getAuctionDuration() * 1 days);
    require(block.timestamp > vars.auctionEndTimestamp, Errors.LPL_BID_AUCTION_DURATION_NOT_END);

    if (loanData.bidPrice > loanData.bidBorrowAmount) {
      vars.remainAmount = loanData.bidPrice - loanData.bidBorrowAmount;
    }

    ILendPoolLoan(vars.poolLoan).liquidateLoan(loanData.bidderAddress, vars.loanId, nftData.bNftAddress, false);

    // transfer remain amount to borrower
    if (vars.remainAmount > 0) {
      IERC20Upgradeable(loanData.reserveAsset).safeTransfer(loanData.borrower, vars.remainAmount);
    }

    emit Liquidate(
      vars.initiator,
      loanData.reserveAsset,
      loanData.bidBorrowAmount,
      vars.remainAmount,
      loanData.nftAsset,
      loanData.nftTokenId,
      loanData.borrower,
      vars.loanId
    );
  }
}

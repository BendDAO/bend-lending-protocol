// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IBToken} from "../../interfaces/IBToken.sol";
import {IDebtToken} from "../../interfaces/IDebtToken.sol";
import {IInterestRate} from "../../interfaces/IInterestRate.sol";
import {ILendPoolAddressesProvider} from "../../interfaces/ILendPoolAddressesProvider.sol";
import {IReserveOracleGetter} from "../../interfaces/IReserveOracleGetter.sol";
import {INFTOracleGetter} from "../../interfaces/INFTOracleGetter.sol";
import {ILendPoolLoan} from "../../interfaces/ILendPoolLoan.sol";

import {ReserveLogic} from "./ReserveLogic.sol";
import {GenericLogic} from "./GenericLogic.sol";
import {ValidationLogic} from "./ValidationLogic.sol";

import {ReserveConfiguration} from "../configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../configuration/NftConfiguration.sol";
import {MathUtils} from "../math/MathUtils.sol";
import {WadRayMath} from "../math/WadRayMath.sol";
import {PercentageMath} from "../math/PercentageMath.sol";
import {Errors} from "../helpers/Errors.sol";
import {DataTypes} from "../types/DataTypes.sol";

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

/**
 * @title LiquidateLogic library
 * @author Bend
 * @notice Implements the logic to liquidate feature
 */
library LiquidateLogic {
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using ReserveLogic for DataTypes.ReserveData;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using NftConfiguration for DataTypes.NftConfigurationMap;

  /**
   * @dev Emitted when a borrower's loan is auctioned.
   * @param user The address of the user initiating the auction
   * @param reserve The address of the underlying asset of the reserve
   * @param bidPrice The price of the underlying reserve given by the bidder
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token id of the underlying NFT used as collateral
   * @param onBehalfOf The address that will be getting the NFT
   * @param loanId The loan ID of the NFT loans
   **/
  event Auction(
    address user,
    address indexed reserve,
    uint256 bidPrice,
    address indexed nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    address indexed borrower,
    uint256 loanId
  );

  /**
   * @dev Emitted on redeem()
   * @param user The address of the user initiating the redeem(), providing the funds
   * @param reserve The address of the underlying asset of the reserve
   * @param borrowAmount The borrow amount repaid
   * @param nftAsset The address of the underlying NFT used as collateral
   * @param nftTokenId The token id of the underlying NFT used as collateral
   * @param loanId The loan ID of the NFT loans
   **/
  event Redeem(
    address user,
    address indexed reserve,
    uint256 borrowAmount,
    uint256 fineAmount,
    address indexed nftAsset,
    uint256 nftTokenId,
    address indexed borrower,
    uint256 loanId
  );

  /**
   * @dev Emitted when a borrower's loan is liquidated.
   * @param user The address of the user initiating the auction
   * @param reserve The address of the underlying asset of the reserve
   * @param repayAmount The amount of reserve repaid by the liquidator
   * @param remainAmount The amount of reserve received by the borrower
   * @param loanId The loan ID of the NFT loans
   **/
  event Liquidate(
    address user,
    address indexed reserve,
    uint256 repayAmount,
    uint256 remainAmount,
    address indexed nftAsset,
    uint256 nftTokenId,
    address indexed borrower,
    uint256 loanId
  );

  struct AuctionLocalVars {
    address loanAddress;
    address reserveOracle;
    address nftOracle;
    address initiator;
    uint256 loanId;
    uint256 thresholdPrice;
    uint256 liquidatePrice;
    uint256 borrowAmount;
    uint256 auctionEndTimestamp;
    uint256 minBidDelta;
  }

  /**
   * @notice Implements the auction feature. Through `auction()`, users auction assets in the protocol.
   * @dev Emits the `Auction()` event.
   * @param reservesData The state of all the reserves
   * @param nftsData The state of all the nfts
   * @param params The additional parameters needed to execute the auction function
   */
  function executeAuction(
    ILendPoolAddressesProvider addressesProvider,
    mapping(address => DataTypes.ReserveData) storage reservesData,
    mapping(address => DataTypes.NftData) storage nftsData,
    DataTypes.ExecuteAuctionParams memory params
  ) external {
    require(params.onBehalfOf != address(0), Errors.VL_INVALID_ONBEHALFOF_ADDRESS);
    ValidationLogic.validateERC721Receiver(params.onBehalfOf);

    AuctionLocalVars memory vars;
    vars.initiator = params.initiator;

    vars.loanAddress = addressesProvider.getLendPoolLoan();
    vars.reserveOracle = addressesProvider.getReserveOracle();
    vars.nftOracle = addressesProvider.getNFTOracle();

    vars.loanId = ILendPoolLoan(vars.loanAddress).getCollateralLoanId(params.nftAsset, params.nftTokenId);
    require(vars.loanId != 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.loanAddress).getLoan(vars.loanId);

    DataTypes.ReserveData storage reserveData = reservesData[loanData.reserveAsset];
    DataTypes.NftData storage nftData = nftsData[loanData.nftAsset];

    ValidationLogic.validateAuction(reserveData, nftData, loanData, params.bidPrice);

    // update state MUST BEFORE get borrow amount which is depent on latest borrow index
    reserveData.updateState();

    (vars.borrowAmount, vars.thresholdPrice, vars.liquidatePrice) = GenericLogic.calculateLoanLiquidatePrice(
      vars.loanId,
      loanData.reserveAsset,
      reserveData,
      loanData.nftAsset,
      nftData,
      vars.loanAddress,
      vars.reserveOracle,
      vars.nftOracle
    );

    // first time bid need to burn debt tokens and transfer reserve to bTokens
    if (loanData.state == DataTypes.LoanState.Active) {
      // loan's accumulated debt must exceed threshold (heath factor below 1.0)
      require(vars.borrowAmount > vars.thresholdPrice, Errors.LP_BORROW_NOT_EXCEED_LIQUIDATION_THRESHOLD);

      // bid price must greater than liquidate price
      require(params.bidPrice >= vars.liquidatePrice, Errors.LPL_BID_PRICE_LESS_THAN_LIQUIDATION_PRICE);

      // bid price must greater than borrow debt
      require(params.bidPrice >= vars.borrowAmount, Errors.LPL_BID_PRICE_LESS_THAN_BORROW);
    } else {
      // bid price must greater than borrow debt
      require(params.bidPrice >= vars.borrowAmount, Errors.LPL_BID_PRICE_LESS_THAN_BORROW);

      vars.auctionEndTimestamp = loanData.bidStartTimestamp + (nftData.configuration.getAuctionDuration() * 1 days);
      require(block.timestamp <= vars.auctionEndTimestamp, Errors.LPL_BID_AUCTION_DURATION_HAS_END);

      // bid price must greater than highest bid + delta
      vars.minBidDelta = vars.borrowAmount.percentMul(PercentageMath.ONE_PERCENT);
      require(params.bidPrice >= (loanData.bidPrice + vars.minBidDelta), Errors.LPL_BID_PRICE_LESS_THAN_HIGHEST_PRICE);
    }

    ILendPoolLoan(vars.loanAddress).auctionLoan(
      vars.initiator,
      vars.loanId,
      params.onBehalfOf,
      params.bidPrice,
      vars.borrowAmount,
      reserveData.variableBorrowIndex
    );

    // lock highest bidder bid price amount to lend pool
    IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(vars.initiator, address(this), params.bidPrice);

    // transfer (return back) last bid price amount to previous bidder from lend pool
    if (loanData.bidderAddress != address(0)) {
      IERC20Upgradeable(loanData.reserveAsset).safeTransfer(loanData.bidderAddress, loanData.bidPrice);
    }

    // update interest rate according latest borrow amount (utilizaton)
    reserveData.updateInterestRates(loanData.reserveAsset, reserveData.bTokenAddress, 0, 0);

    emit Auction(
      vars.initiator,
      loanData.reserveAsset,
      params.bidPrice,
      params.nftAsset,
      params.nftTokenId,
      params.onBehalfOf,
      loanData.borrower,
      vars.loanId
    );
  }

  struct RedeemLocalVars {
    address initiator;
    address poolLoan;
    address reserveOracle;
    address nftOracle;
    uint256 loanId;
    uint256 borrowAmount;
    uint256 repayAmount;
    uint256 minRepayAmount;
    uint256 maxRepayAmount;
    uint256 bidFine;
    uint256 redeemEndTimestamp;
    uint256 minBidFinePct;
    uint256 minBidFine;
  }

  /**
   * @notice Implements the redeem feature. Through `redeem()`, users redeem assets in the protocol.
   * @dev Emits the `Redeem()` event.
   * @param reservesData The state of all the reserves
   * @param nftsData The state of all the nfts
   * @param params The additional parameters needed to execute the redeem function
   */
  function executeRedeem(
    ILendPoolAddressesProvider addressesProvider,
    mapping(address => DataTypes.ReserveData) storage reservesData,
    mapping(address => DataTypes.NftData) storage nftsData,
    DataTypes.ExecuteRedeemParams memory params
  ) external returns (uint256) {
    RedeemLocalVars memory vars;
    vars.initiator = params.initiator;

    vars.poolLoan = addressesProvider.getLendPoolLoan();
    vars.reserveOracle = addressesProvider.getReserveOracle();
    vars.nftOracle = addressesProvider.getNFTOracle();

    vars.loanId = ILendPoolLoan(vars.poolLoan).getCollateralLoanId(params.nftAsset, params.nftTokenId);
    require(vars.loanId != 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.poolLoan).getLoan(vars.loanId);

    DataTypes.ReserveData storage reserveData = reservesData[loanData.reserveAsset];
    DataTypes.NftData storage nftData = nftsData[loanData.nftAsset];

    ValidationLogic.validateRedeem(reserveData, nftData, loanData, params.amount);

    vars.redeemEndTimestamp = (loanData.bidStartTimestamp + nftData.configuration.getRedeemDuration() * 1 days);
    require(block.timestamp <= vars.redeemEndTimestamp, Errors.LPL_BID_REDEEM_DURATION_HAS_END);

    // update state MUST BEFORE get borrow amount which is depent on latest borrow index
    reserveData.updateState();

    (vars.borrowAmount, , ) = GenericLogic.calculateLoanLiquidatePrice(
      vars.loanId,
      loanData.reserveAsset,
      reserveData,
      loanData.nftAsset,
      nftData,
      vars.poolLoan,
      vars.reserveOracle,
      vars.nftOracle
    );

    // check bid fine in min & max range
    (, vars.bidFine) = GenericLogic.calculateLoanBidFine(
      loanData.reserveAsset,
      reserveData,
      loanData.nftAsset,
      nftData,
      loanData,
      vars.poolLoan,
      vars.reserveOracle
    );

    // check bid fine is enough
    require(vars.bidFine <= params.bidFine, Errors.LPL_INVALID_BID_FINE);

    // check the minimum debt repay amount, use redeem threshold in config
    vars.repayAmount = params.amount;
    vars.minRepayAmount = vars.borrowAmount.percentMul(nftData.configuration.getRedeemThreshold());
    require(vars.repayAmount >= vars.minRepayAmount, Errors.LP_AMOUNT_LESS_THAN_REDEEM_THRESHOLD);

    // check the maxinmum debt repay amount, 90%?
    vars.maxRepayAmount = vars.borrowAmount.percentMul(PercentageMath.PERCENTAGE_FACTOR - PercentageMath.TEN_PERCENT);
    require(vars.repayAmount <= vars.maxRepayAmount, Errors.LP_AMOUNT_GREATER_THAN_MAX_REPAY);

    ILendPoolLoan(vars.poolLoan).redeemLoan(
      vars.initiator,
      vars.loanId,
      vars.repayAmount,
      reserveData.variableBorrowIndex
    );

    IDebtToken(reserveData.debtTokenAddress).burn(loanData.borrower, vars.repayAmount, reserveData.variableBorrowIndex);

    // update interest rate according latest borrow amount (utilizaton)
    reserveData.updateInterestRates(loanData.reserveAsset, reserveData.bTokenAddress, vars.repayAmount, 0);

    // transfer repay amount from borrower to bToken
    IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(
      vars.initiator,
      reserveData.bTokenAddress,
      vars.repayAmount
    );

    if (loanData.bidderAddress != address(0)) {
      // transfer (return back) last bid price amount from lend pool to bidder
      IERC20Upgradeable(loanData.reserveAsset).safeTransfer(loanData.bidderAddress, loanData.bidPrice);

      // transfer bid penalty fine amount from borrower to the first bidder
      IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(
        vars.initiator,
        loanData.firstBidderAddress,
        vars.bidFine
      );
    }

    emit Redeem(
      vars.initiator,
      loanData.reserveAsset,
      vars.repayAmount,
      vars.bidFine,
      loanData.nftAsset,
      loanData.nftTokenId,
      loanData.borrower,
      vars.loanId
    );

    return (vars.repayAmount + vars.bidFine);
  }

  struct LiquidateLocalVars {
    address initiator;
    address poolLoan;
    address reserveOracle;
    address nftOracle;
    uint256 loanId;
    uint256 borrowAmount;
    uint256 extraDebtAmount;
    uint256 remainAmount;
    uint256 auctionEndTimestamp;
  }

  /**
   * @notice Implements the liquidate feature. Through `liquidate()`, users liquidate assets in the protocol.
   * @dev Emits the `Liquidate()` event.
   * @param reservesData The state of all the reserves
   * @param nftsData The state of all the nfts
   * @param params The additional parameters needed to execute the liquidate function
   */
  function executeLiquidate(
    ILendPoolAddressesProvider addressesProvider,
    mapping(address => DataTypes.ReserveData) storage reservesData,
    mapping(address => DataTypes.NftData) storage nftsData,
    DataTypes.ExecuteLiquidateParams memory params
  ) external returns (uint256) {
    LiquidateLocalVars memory vars;
    vars.initiator = params.initiator;

    vars.poolLoan = addressesProvider.getLendPoolLoan();
    vars.reserveOracle = addressesProvider.getReserveOracle();
    vars.nftOracle = addressesProvider.getNFTOracle();

    vars.loanId = ILendPoolLoan(vars.poolLoan).getCollateralLoanId(params.nftAsset, params.nftTokenId);
    require(vars.loanId != 0, Errors.LP_NFT_IS_NOT_USED_AS_COLLATERAL);

    DataTypes.LoanData memory loanData = ILendPoolLoan(vars.poolLoan).getLoan(vars.loanId);

    DataTypes.ReserveData storage reserveData = reservesData[loanData.reserveAsset];
    DataTypes.NftData storage nftData = nftsData[loanData.nftAsset];

    ValidationLogic.validateLiquidate(reserveData, nftData, loanData);

    vars.auctionEndTimestamp = loanData.bidStartTimestamp + (nftData.configuration.getAuctionDuration() * 1 days);
    require(block.timestamp > vars.auctionEndTimestamp, Errors.LPL_BID_AUCTION_DURATION_NOT_END);

    // update state MUST BEFORE get borrow amount which is depent on latest borrow index
    reserveData.updateState();

    (vars.borrowAmount, , ) = GenericLogic.calculateLoanLiquidatePrice(
      vars.loanId,
      loanData.reserveAsset,
      reserveData,
      loanData.nftAsset,
      nftData,
      vars.poolLoan,
      vars.reserveOracle,
      vars.nftOracle
    );

    // Last bid price can not cover borrow amount
    if (loanData.bidPrice < vars.borrowAmount) {
      vars.extraDebtAmount = vars.borrowAmount - loanData.bidPrice;
      require(params.amount >= vars.extraDebtAmount, Errors.LP_AMOUNT_LESS_THAN_EXTRA_DEBT);
    }

    if (loanData.bidPrice > vars.borrowAmount) {
      vars.remainAmount = loanData.bidPrice - vars.borrowAmount;
    }

    ILendPoolLoan(vars.poolLoan).liquidateLoan(
      loanData.bidderAddress,
      vars.loanId,
      nftData.bNftAddress,
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

    // transfer extra borrow amount from liquidator to lend pool
    if (vars.extraDebtAmount > 0) {
      IERC20Upgradeable(loanData.reserveAsset).safeTransferFrom(vars.initiator, address(this), vars.extraDebtAmount);
    }

    // transfer borrow amount from lend pool to bToken, repay debt
    IERC20Upgradeable(loanData.reserveAsset).safeTransfer(reserveData.bTokenAddress, vars.borrowAmount);

    // transfer remain amount to borrower
    if (vars.remainAmount > 0) {
      IERC20Upgradeable(loanData.reserveAsset).safeTransfer(loanData.borrower, vars.remainAmount);
    }

    // transfer erc721 to bidder
    IERC721Upgradeable(loanData.nftAsset).safeTransferFrom(address(this), loanData.bidderAddress, params.nftTokenId);

    emit Liquidate(
      vars.initiator,
      loanData.reserveAsset,
      vars.borrowAmount,
      vars.remainAmount,
      loanData.nftAsset,
      loanData.nftTokenId,
      loanData.borrower,
      vars.loanId
    );

    return (vars.extraDebtAmount);
  }
}

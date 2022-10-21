// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {ILendPoolLoan} from "../../interfaces/ILendPoolLoan.sol";
import {IReserveOracleGetter} from "../../interfaces/IReserveOracleGetter.sol";
import {INFTOracleGetter} from "../../interfaces/INFTOracleGetter.sol";
import {WadRayMath} from "../math/WadRayMath.sol";
import {PercentageMath} from "../math/PercentageMath.sol";
import {ReserveConfiguration} from "../configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../configuration/NftConfiguration.sol";
import {Errors} from "../helpers/Errors.sol";
import {DataTypes} from "../types/DataTypes.sol";
import {ReserveLogic} from "./ReserveLogic.sol";

/**
 * @title GenericLogic library
 * @author Bend
 * @notice Implements protocol-level logic to calculate and validate the state of a user
 */
library GenericLogic {
  using ReserveLogic for DataTypes.ReserveData;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using NftConfiguration for DataTypes.NftConfigurationMap;

  uint256 public constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1 ether;

  struct CalculateLoanDataVars {
    uint256 reserveUnitPrice;
    uint256 reserveUnit;
    uint256 reserveDecimals;
    uint256 healthFactor;
    uint256 totalCollateralInETH;
    uint256 totalCollateralInReserve;
    uint256 totalDebtInETH;
    uint256 totalDebtInReserve;
    uint256 nftLtv;
    uint256 nftLiquidationThreshold;
    address nftAsset;
    uint256 nftTokenId;
    uint256 nftUnitPrice;
  }

  /**
   * @dev Calculates the nft loan data.
   * this includes the total collateral/borrow balances in Reserve,
   * the Loan To Value, the Liquidation Ratio, and the Health factor.
   * @param reserveData Data of the reserve
   * @param nftData Data of the nft
   * @param reserveOracle The price oracle address of reserve
   * @param nftOracle The price oracle address of nft
   * @return The total collateral and total debt of the loan in Reserve, the ltv, liquidation threshold and the HF
   **/
  function calculateLoanData(
    address reserveAddress,
    DataTypes.ReserveData storage reserveData,
    address nftAddress,
    DataTypes.NftData storage nftData,
    address loanAddress,
    uint256 loanId,
    address reserveOracle,
    address nftOracle
  )
    internal
    view
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    CalculateLoanDataVars memory vars;

    (vars.nftLtv, vars.nftLiquidationThreshold, ) = nftData.configuration.getCollateralParams();

    // calculate total borrow balance for the loan
    if (loanId != 0) {
      (vars.totalDebtInETH, vars.totalDebtInReserve) = calculateNftDebtData(
        reserveAddress,
        reserveData,
        loanAddress,
        loanId,
        reserveOracle
      );
    }

    // calculate total collateral balance for the nft
    (vars.totalCollateralInETH, vars.totalCollateralInReserve) = calculateNftCollateralData(
      reserveAddress,
      reserveData,
      nftAddress,
      nftData,
      reserveOracle,
      nftOracle
    );

    // calculate health by borrow and collateral
    vars.healthFactor = calculateHealthFactorFromBalances(
      vars.totalCollateralInReserve,
      vars.totalDebtInReserve,
      vars.nftLiquidationThreshold
    );

    return (vars.totalCollateralInReserve, vars.totalDebtInReserve, vars.healthFactor);
  }

  function calculateNftDebtData(
    address reserveAddress,
    DataTypes.ReserveData storage reserveData,
    address loanAddress,
    uint256 loanId,
    address reserveOracle
  ) internal view returns (uint256, uint256) {
    CalculateLoanDataVars memory vars;

    // all asset price has converted to ETH based, unit is in WEI (18 decimals)

    vars.reserveDecimals = reserveData.configuration.getDecimals();
    vars.reserveUnit = 10**vars.reserveDecimals;

    vars.reserveUnitPrice = IReserveOracleGetter(reserveOracle).getAssetPrice(reserveAddress);

    (, vars.totalDebtInReserve) = ILendPoolLoan(loanAddress).getLoanReserveBorrowAmount(loanId);
    vars.totalDebtInETH = (vars.totalDebtInReserve * vars.reserveUnitPrice) / vars.reserveUnit;

    return (vars.totalDebtInETH, vars.totalDebtInReserve);
  }

  function calculateNftCollateralData(
    address reserveAddress,
    DataTypes.ReserveData storage reserveData,
    address nftAddress,
    DataTypes.NftData storage nftData,
    address reserveOracle,
    address nftOracle
  ) internal view returns (uint256, uint256) {
    reserveData;
    nftData;

    CalculateLoanDataVars memory vars;

    // calculate total collateral balance for the nft
    // all asset price has converted to ETH based, unit is in WEI (18 decimals)

    vars.nftUnitPrice = INFTOracleGetter(nftOracle).getAssetPrice(nftAddress);
    vars.totalCollateralInETH = vars.nftUnitPrice;

    if (reserveAddress != address(0)) {
      vars.reserveDecimals = reserveData.configuration.getDecimals();
      vars.reserveUnit = 10**vars.reserveDecimals;

      vars.reserveUnitPrice = IReserveOracleGetter(reserveOracle).getAssetPrice(reserveAddress);

      vars.totalCollateralInReserve = (vars.totalCollateralInETH * vars.reserveUnit) / vars.reserveUnitPrice;
    }

    return (vars.totalCollateralInETH, vars.totalCollateralInReserve);
  }

  /**
   * @dev Calculates the health factor from the corresponding balances
   * @param totalCollateral The total collateral
   * @param totalDebt The total debt
   * @param liquidationThreshold The avg liquidation threshold
   * @return The health factor calculated from the balances provided
   **/
  function calculateHealthFactorFromBalances(
    uint256 totalCollateral,
    uint256 totalDebt,
    uint256 liquidationThreshold
  ) internal pure returns (uint256) {
    if (totalDebt == 0) return type(uint256).max;

    return (totalCollateral.percentMul(liquidationThreshold)).wadDiv(totalDebt);
  }

  /**
   * @dev Calculates the equivalent amount that an user can borrow, depending on the available collateral and the
   * average Loan To Value
   * @param totalCollateral The total collateral
   * @param totalDebt The total borrow balance
   * @param ltv The average loan to value
   * @return the amount available to borrow for the user
   **/

  function calculateAvailableBorrows(
    uint256 totalCollateral,
    uint256 totalDebt,
    uint256 ltv
  ) internal pure returns (uint256) {
    uint256 availableBorrows = totalCollateral.percentMul(ltv);

    if (availableBorrows < totalDebt) {
      return 0;
    }

    availableBorrows = availableBorrows - totalDebt;
    return availableBorrows;
  }

  struct CalcLiquidatePriceLocalVars {
    uint256 ltv;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    uint256 nftPriceInETH;
    uint256 nftPriceInReserve;
    uint256 reserveDecimals;
    uint256 reservePriceInETH;
    uint256 thresholdPrice;
    uint256 liquidatePrice;
    uint256 borrowAmount;
  }

  function calculateLoanLiquidatePrice(
    uint256 loanId,
    address reserveAsset,
    DataTypes.ReserveData storage reserveData,
    address nftAsset,
    DataTypes.NftData storage nftData,
    address poolLoan,
    address reserveOracle,
    address nftOracle
  )
    internal
    view
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    CalcLiquidatePriceLocalVars memory vars;

    /*
     * 0                   CR                  LH                  100
     * |___________________|___________________|___________________|
     *  <       Borrowing with Interest        <
     * CR: Callteral Ratio;
     * LH: Liquidate Threshold;
     * Liquidate Trigger: Borrowing with Interest > thresholdPrice;
     * Liquidate Price: (100% - BonusRatio) * NFT Price;
     */

    vars.reserveDecimals = reserveData.configuration.getDecimals();

    (, vars.borrowAmount) = ILendPoolLoan(poolLoan).getLoanReserveBorrowAmount(loanId);

    (vars.ltv, vars.liquidationThreshold, vars.liquidationBonus) = nftData.configuration.getCollateralParams();

    vars.nftPriceInETH = INFTOracleGetter(nftOracle).getAssetPrice(nftAsset);
    vars.reservePriceInETH = IReserveOracleGetter(reserveOracle).getAssetPrice(reserveAsset);

    vars.nftPriceInReserve = ((10**vars.reserveDecimals) * vars.nftPriceInETH) / vars.reservePriceInETH;

    vars.thresholdPrice = vars.nftPriceInReserve.percentMul(vars.liquidationThreshold);

    if (vars.liquidationBonus < PercentageMath.PERCENTAGE_FACTOR) {
      vars.liquidatePrice = vars.nftPriceInReserve.percentMul(PercentageMath.PERCENTAGE_FACTOR - vars.liquidationBonus);
    }

    if (vars.liquidatePrice < vars.borrowAmount) {
      vars.liquidatePrice = vars.borrowAmount;
    }

    return (vars.borrowAmount, vars.thresholdPrice, vars.liquidatePrice);
  }

  struct CalcLoanBidFineLocalVars {
    uint256 reserveDecimals;
    uint256 reservePriceInETH;
    uint256 baseBidFineInReserve;
    uint256 minBidFinePct;
    uint256 minBidFineInReserve;
    uint256 bidFineInReserve;
    uint256 debtAmount;
  }

  function calculateLoanBidFine(
    address reserveAsset,
    DataTypes.ReserveData storage reserveData,
    address nftAsset,
    DataTypes.NftData storage nftData,
    DataTypes.LoanData memory loanData,
    address poolLoan,
    address reserveOracle
  ) internal view returns (uint256, uint256) {
    nftAsset;

    if (loanData.bidPrice == 0) {
      return (0, 0);
    }

    CalcLoanBidFineLocalVars memory vars;

    vars.reserveDecimals = reserveData.configuration.getDecimals();
    vars.reservePriceInETH = IReserveOracleGetter(reserveOracle).getAssetPrice(reserveAsset);
    vars.baseBidFineInReserve = (1 ether * 10**vars.reserveDecimals) / vars.reservePriceInETH;

    vars.minBidFinePct = nftData.configuration.getMinBidFine();
    vars.minBidFineInReserve = vars.baseBidFineInReserve.percentMul(vars.minBidFinePct);

    (, vars.debtAmount) = ILendPoolLoan(poolLoan).getLoanReserveBorrowAmount(loanData.loanId);

    vars.bidFineInReserve = vars.debtAmount.percentMul(nftData.configuration.getRedeemFine());
    if (vars.bidFineInReserve < vars.minBidFineInReserve) {
      vars.bidFineInReserve = vars.minBidFineInReserve;
    }

    return (vars.minBidFineInReserve, vars.bidFineInReserve);
  }

  function calculateLoanAuctionEndTimestamp(
    DataTypes.NftData storage nftData,
    DataTypes.LoanData memory loanData,
    uint256 pauseStartTime,
    uint256 pauseDurationTime
  ) internal view returns (uint256 auctionEndTimestamp, uint256 redeemEndTimestamp) {
    uint256 extraDuration = 0;

    if ((pauseDurationTime > 0) && (loanData.bidStartTimestamp <= pauseStartTime)) {
      extraDuration = pauseDurationTime;
    }

    auctionEndTimestamp =
      loanData.bidStartTimestamp +
      extraDuration +
      (nftData.configuration.getAuctionDuration() * 1 hours);

    redeemEndTimestamp =
      loanData.bidStartTimestamp +
      extraDuration +
      (nftData.configuration.getRedeemDuration() * 1 hours);
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

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
    uint256 tokenUnit;
    uint256 compoundedBorrowBalance;
    uint256 decimals;
    uint256 ltv;
    uint256 liquidationThreshold;
    uint256 healthFactor;
    uint256 totalCollateralInETH;
    uint256 totalDebtInETH;
    uint256 nftLtv;
    uint256 nftLiquidationThreshold;
    address nftAsset;
    uint256 nftTokenId;
    uint256 nftUnitPrice;
  }

  /**
   * @dev Calculates the nft loan data.
   * this includes the total collateral/borrow balances in ETH,
   * the Loan To Value, the Liquidation Ratio, and the Health factor.
   * @param reserveData Data of the reserve
   * @param nftData Data of the nft
   * @param reserveOracle The price oracle address of reserve
   * @param nftOracle The price oracle address of nft
   * @return The total collateral and total debt of the loan in ETH, the ltv, liquidation threshold and the HF
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
      uint256,
      uint256,
      uint256
    )
  {
    CalculateLoanDataVars memory vars;

    // calculate total borrow balance for the loan
    if (loanId != 0) {
      vars.totalDebtInETH = calculateNftDebtData(reserveAddress, reserveData, loanAddress, loanId, reserveOracle);
    }

    // calculate total collateral balance for the nft
    (vars.totalCollateralInETH, vars.nftLtv, vars.nftLiquidationThreshold) = calculateNftCollateralData(
      nftAddress,
      nftData,
      nftOracle
    );

    // calculate health by borrow and collateral
    vars.healthFactor = calculateHealthFactorFromBalances(
      vars.totalCollateralInETH,
      vars.totalDebtInETH,
      vars.nftLiquidationThreshold
    );

    return (
      vars.totalCollateralInETH,
      vars.totalDebtInETH,
      vars.nftLtv,
      vars.nftLiquidationThreshold,
      vars.healthFactor
    );
  }

  function calculateNftDebtData(
    address reserveAddress,
    DataTypes.ReserveData storage reserveData,
    address loanAddress,
    uint256 loanId,
    address reserveOracle
  ) internal view returns (uint256) {
    CalculateLoanDataVars memory vars;

    (vars.ltv, vars.liquidationThreshold, , vars.decimals, ) = reserveData.configuration.getParams();
    vars.tokenUnit = 10**vars.decimals;

    vars.reserveUnitPrice = IReserveOracleGetter(reserveOracle).getAssetPrice(reserveAddress);

    vars.compoundedBorrowBalance = ILendPoolLoan(loanAddress).getLoanReserveBorrowAmount(loanId);
    vars.totalDebtInETH = (vars.reserveUnitPrice * vars.compoundedBorrowBalance) / vars.tokenUnit;

    return vars.totalDebtInETH;
  }

  function calculateNftCollateralData(
    address nftAddress,
    DataTypes.NftData storage nftData,
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

    (vars.nftLtv, vars.nftLiquidationThreshold, ) = nftData.configuration.getParams();

    // calculate total collateral balance for the nft
    vars.nftUnitPrice = INFTOracleGetter(nftOracle).getAssetPrice(nftAddress);
    vars.totalCollateralInETH = vars.nftUnitPrice;

    return (vars.totalCollateralInETH, vars.nftLtv, vars.nftLiquidationThreshold);
  }

  /**
   * @dev Calculates the health factor from the corresponding balances
   * @param totalCollateralInETH The total collateral in ETH
   * @param totalDebtInETH The total debt in ETH
   * @param liquidationThreshold The avg liquidation threshold
   * @return The health factor calculated from the balances provided
   **/
  function calculateHealthFactorFromBalances(
    uint256 totalCollateralInETH,
    uint256 totalDebtInETH,
    uint256 liquidationThreshold
  ) internal pure returns (uint256) {
    if (totalDebtInETH == 0) return type(uint256).max;

    return (totalCollateralInETH.percentMul(liquidationThreshold)).wadDiv(totalDebtInETH);
  }

  /**
   * @dev Calculates the equivalent amount in ETH that an user can borrow, depending on the available collateral and the
   * average Loan To Value
   * @param totalCollateralInETH The total collateral in ETH
   * @param totalDebtInETH The total borrow balance
   * @param ltv The average loan to value
   * @return the amount available to borrow in ETH for the user
   **/

  function calculateAvailableBorrowsETH(
    uint256 totalCollateralInETH,
    uint256 totalDebtInETH,
    uint256 ltv
  ) internal pure returns (uint256) {
    uint256 availableBorrowsETH = totalCollateralInETH.percentMul(ltv);

    if (availableBorrowsETH < totalDebtInETH) {
      return 0;
    }

    availableBorrowsETH = availableBorrowsETH - totalDebtInETH;
    return availableBorrowsETH;
  }
}

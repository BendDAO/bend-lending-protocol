// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {INFTLoan} from "../../interfaces/INFTLoan.sol";
import {IReserveOracleGetter} from "../../interfaces/IReserveOracleGetter.sol";
import {INFTOracleGetter} from "../../interfaces/INFTOracleGetter.sol";
import {WadRayMath} from "../math/WadRayMath.sol";
import {PercentageMath} from "../math/PercentageMath.sol";
import {ReserveConfiguration} from "../configuration/ReserveConfiguration.sol";
import {UserConfiguration} from "../configuration/UserConfiguration.sol";
import {NftConfiguration} from "../configuration/NftConfiguration.sol";
import {Errors} from "../helpers/Errors.sol";
import {DataTypes} from "../types/DataTypes.sol";
import {ReserveLogic} from "./ReserveLogic.sol";

/**
 * @title GenericLogic library
 * @author NFTLend
 * @notice Implements protocol-level logic to calculate and validate the state of a user
 */
library GenericLogic {
    using ReserveLogic for DataTypes.ReserveData;
    using WadRayMath for uint256;
    using PercentageMath for uint256;
    using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
    using NftConfiguration for DataTypes.NftConfigurationMap;
    using UserConfiguration for DataTypes.UserConfigurationMap;

    uint256 public constant HEALTH_FACTOR_LIQUIDATION_THRESHOLD = 1 ether;

    /**
     * @dev Checks if a specific balance decrease is allowed
     * (i.e. doesn't bring the user borrow position health factor under HEALTH_FACTOR_LIQUIDATION_THRESHOLD)
     * @param asset The address of the underlying asset of the reserve
     * @param user The address of the user
     * @param amount The amount to decrease
     * @param reservesData The data of all the reserves
     * @param userConfig The user configuration
     * @param reserves The list of all the active reserves
     * @param oracle The address of the oracle contract
     * @return true if the decrease of the balance is allowed
     **/
    function balanceDecreaseAllowed(
        address asset,
        address user,
        uint256 amount,
        mapping(address => DataTypes.ReserveData) storage reservesData,
        DataTypes.UserConfigurationMap calldata userConfig,
        mapping(uint256 => address) storage reserves,
        uint256 reservesCount,
        address oracle
    ) external view returns (bool) {
        if (
            !userConfig.isReserveBorrowingAny() ||
            !userConfig.isUsingReserveAsCollateral(reservesData[asset].id)
        ) {
            return true;
        }

        return true;
    }

    struct CalculateNftLoanDataVars {
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
        address nftContract;
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
    function calculateNftLoanData(
        address reserveAddress,
        DataTypes.ReserveData storage reserveData,
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
        CalculateNftLoanDataVars memory vars;

        (vars.nftContract, vars.nftTokenId) = INFTLoan(loanAddress)
            .getLoanCollateral(loanId);

        (vars.ltv, vars.liquidationThreshold, , vars.decimals, ) = reserveData
            .configuration
            .getParams();

        (vars.nftLtv, vars.nftLiquidationThreshold, ) = nftData
            .configuration
            .getParams();

        vars.tokenUnit = 10**vars.decimals;
        vars.reserveUnitPrice = IReserveOracleGetter(reserveOracle).getAssetPrice(
            reserveAddress
        );
        vars.compoundedBorrowBalance = INFTLoan(loanAddress)
            .getLoanReserveBorrowAmount(loanId);
        vars.totalDebtInETH =
            (vars.reserveUnitPrice * vars.compoundedBorrowBalance) /
            vars.tokenUnit;

        vars.nftUnitPrice = INFTOracleGetter(nftOracle).getAssetPrice(
            vars.nftContract
        );
        vars.totalCollateralInETH = vars.nftUnitPrice;

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

        return
            (totalCollateralInETH.percentMul(liquidationThreshold)).wadDiv(
                totalDebtInETH
            );
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

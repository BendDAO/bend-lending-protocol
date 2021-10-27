// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {ReserveLogic} from "./ReserveLogic.sol";
import {GenericLogic} from "./GenericLogic.sol";
import {WadRayMath} from "../math/WadRayMath.sol";
import {PercentageMath} from "../math/PercentageMath.sol";
import {ReserveConfiguration} from "../configuration/ReserveConfiguration.sol";
import {UserConfiguration} from "../configuration/UserConfiguration.sol";
import {NftConfiguration} from "../configuration/NftConfiguration.sol";
import {Errors} from "../helpers/Errors.sol";
import {DataTypes} from "../types/DataTypes.sol";
import {IInterestRate} from "../../interfaces/IInterestRate.sol";
import {ILendPoolLoan} from "../../interfaces/ILendPoolLoan.sol";

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

/**
 * @title ValidationLogic library
 * @author NFTLend
 * @notice Implements functions to validate the different actions of the protocol
 */
library ValidationLogic {
    using ReserveLogic for DataTypes.ReserveData;
    using WadRayMath for uint256;
    using PercentageMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
    using UserConfiguration for DataTypes.UserConfigurationMap;
    using NftConfiguration for DataTypes.NftConfigurationMap;

    /**
     * @dev Validates a deposit action
     * @param reserve The reserve object on which the user is depositing
     * @param amount The amount to be deposited
     */
    function validateDeposit(
        DataTypes.ReserveData storage reserve,
        uint256 amount
    ) external view {
        (bool isActive, bool isFrozen, , ) = reserve.configuration.getFlags();

        require(amount != 0, Errors.VL_INVALID_AMOUNT);
        require(isActive, Errors.VL_NO_ACTIVE_RESERVE);
        require(!isFrozen, Errors.VL_RESERVE_FROZEN);
    }

    /**
     * @dev Validates a withdraw action
     * @param reserveAddress The address of the reserve
     * @param amount The amount to be withdrawn
     * @param userBalance The balance of the user
     * @param reservesData The reserves state
     * @param userConfig The user configuration
     * @param reserves The addresses of the reserves
     * @param reservesCount The number of reserves
     * @param oracle The price oracle
     */
    function validateWithdraw(
        address reserveAddress,
        uint256 amount,
        uint256 userBalance,
        mapping(address => DataTypes.ReserveData) storage reservesData,
        DataTypes.UserConfigurationMap storage userConfig,
        mapping(uint256 => address) storage reserves,
        uint256 reservesCount,
        address oracle
    ) external view {
        require(amount != 0, Errors.VL_INVALID_AMOUNT);
        require(
            amount <= userBalance,
            Errors.VL_NOT_ENOUGH_AVAILABLE_USER_BALANCE
        );

        (bool isActive, , , ) = reservesData[reserveAddress]
            .configuration
            .getFlags();
        require(isActive, Errors.VL_NO_ACTIVE_RESERVE);

        require(
            GenericLogic.balanceDecreaseAllowed(
                reserveAddress,
                msg.sender,
                amount,
                reservesData,
                userConfig,
                reserves,
                reservesCount,
                oracle
            ),
            Errors.VL_TRANSFER_NOT_ALLOWED
        );
    }

    struct ValidateBorrowLocalVars {
        uint256 currentLtv;
        uint256 currentLiquidationThreshold;
        uint256 amountOfCollateralNeededETH;
        uint256 userCollateralBalanceETH;
        uint256 userBorrowBalanceETH;
        uint256 availableLiquidity;
        uint256 healthFactor;
        bool isActive;
        bool isFrozen;
        bool borrowingEnabled;
        bool stableRateBorrowingEnabled;
        bool nftIsActive;
        bool nftIsFrozen;
    }

    /**
     * @dev Validates a borrow action
     * @param reserveAsset The address of the asset to borrow
     * @param amount The amount to be borrowed
     * @param reserve The reserve state from which the user is borrowing
     * @param nftData The state of the user for the specific nft
     */
    function validateBorrow(
        address user,
        address reserveAsset,
        uint256 amount,
        uint256 amountInETH,
        DataTypes.ReserveData storage reserve,
        address nftAsset,
        DataTypes.NftData storage nftData,
        address loanAddress,
        uint256 loanId,
        address reserveOracle,
        address nftOracle
    ) external view {
        ValidateBorrowLocalVars memory vars;

        require(amount != 0, Errors.VL_INVALID_AMOUNT);

        if (loanId != 0) {
            require(
                user == ILendPoolLoan(loanAddress).borrowerOf(loanId),
                Errors.LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER
            );
        }

        (
            vars.isActive,
            vars.isFrozen,
            vars.borrowingEnabled,
            vars.stableRateBorrowingEnabled
        ) = reserve.configuration.getFlags();
        require(vars.isActive, Errors.VL_NO_ACTIVE_RESERVE);
        require(!vars.isFrozen, Errors.VL_RESERVE_FROZEN);
        require(vars.borrowingEnabled, Errors.VL_BORROWING_NOT_ENABLED);

        (vars.nftIsActive, vars.nftIsFrozen) = nftData.configuration.getFlags();
        require(vars.nftIsActive, Errors.VL_NO_ACTIVE_NFT);
        require(!vars.nftIsFrozen, Errors.VL_NFT_FROZEN);

        (
            vars.userCollateralBalanceETH,
            vars.userBorrowBalanceETH,
            vars.currentLtv,
            vars.currentLiquidationThreshold,
            vars.healthFactor
        ) = GenericLogic.calculateLoanData(
            reserveAsset,
            reserve,
            nftAsset,
            nftData,
            loanAddress,
            loanId,
            reserveOracle,
            nftOracle
        );

        require(
            vars.userCollateralBalanceETH > 0,
            Errors.VL_COLLATERAL_BALANCE_IS_0
        );

        require(
            vars.healthFactor >
                GenericLogic.HEALTH_FACTOR_LIQUIDATION_THRESHOLD,
            Errors.VL_HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD
        );

        //add the current already borrowed amount to the amount requested to calculate the total collateral needed.
        //LTV is calculated in percentage
        vars.amountOfCollateralNeededETH = (vars.userBorrowBalanceETH +
            (amountInETH)).percentDiv(vars.currentLtv);

        require(
            vars.amountOfCollateralNeededETH <= vars.userCollateralBalanceETH,
            Errors.VL_COLLATERAL_CANNOT_COVER_NEW_BORROW
        );
    }

    /**
     * @dev Validates a repay action
     * @param user The address of the user msg.sender is repaying for
     * @param reserve The reserve state from which the user is repaying
     * @param amountSent The amount sent for the repayment. Can be an actual value or uint(-1)
     * @param variableDebt The borrow balance of the user
     */
    function validateRepay(
        address user,
        address borrower,
        DataTypes.ReserveData storage reserve,
        uint256 amountSent,
        uint256 variableDebt
    ) external view {
        bool isActive = reserve.configuration.getActive();

        require(isActive, Errors.VL_NO_ACTIVE_RESERVE);

        require(amountSent > 0, Errors.VL_INVALID_AMOUNT);

        require(variableDebt > 0, Errors.VL_NO_DEBT_OF_SELECTED_TYPE);

        require(
            user == borrower,
            Errors.LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER
        );
    }

    /**
     * @dev Validates the liquidation action
     * @param principalReserve The reserve data of the principal
     * @param nftData The NFT configuration
     * @param paybackAmount Total variable debt balance of the user
     **/
    function validateLiquidate(
        DataTypes.ReserveData storage principalReserve,
        DataTypes.NftData storage nftData,
        uint256 paybackAmount
    ) internal view {
        require(
            principalReserve.configuration.getActive(),
            Errors.VL_NO_ACTIVE_RESERVE
        );

        require(nftData.configuration.getActive(), Errors.VL_NO_ACTIVE_NFT);

        require(
            paybackAmount > 0,
            Errors.LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER
        );
    }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IWToken} from "../interfaces/IWToken.sol";
import {INFTLoan} from "../interfaces/INFTLoan.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {IPriceOracleGetter} from "../interfaces/IPriceOracleGetter.sol";
import {INFTOracleGetter} from "../interfaces/INFTOracleGetter.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";
import {ReserveLogic} from "../libraries/logic/ReserveLogic.sol";
import {ValidationLogic} from "../libraries/logic/ValidationLogic.sol";
import {UserConfiguration} from "../libraries/configuration/UserConfiguration.sol";
import {ReserveConfiguration} from "../libraries/configuration/ReserveConfiguration.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {LendPoolStorage} from "./LendPoolStorage.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title LendPool contract
 * @dev Main point of interaction with an NFTLend protocol's market
 * - Users can:
 *   # Deposit
 *   # Withdraw
 *   # Borrow
 *   # Repay
 *   # Liquidate positions
 *   # Execute Flash Loans
 * - To be covered by a proxy contract, owned by the LendPoolAddressesProvider of the specific market
 * - All admin functions are callable by the LendPoolConfigurator contract defined also in the
 *   LendPoolAddressesProvider
 * @author NFTLend
 **/
contract LendPool is ILendPool, LendPoolStorage {
    using WadRayMath for uint256;
    using PercentageMath for uint256;
    using SafeERC20 for IERC20;
    using ReserveLogic for DataTypes.ReserveData;
    using UserConfiguration for DataTypes.UserConfigurationMap;
    using ReserveConfiguration for DataTypes.ReserveConfigurationMap;

    modifier whenNotPaused() {
        _whenNotPaused();
        _;
    }

    function _whenNotPaused() internal view {
        require(!_paused, Errors.LP_IS_PAUSED);
    }

    /**
     * @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
     * - E.g. User deposits 100 USDC and gets in return 100 aUSDC
     * @param asset The address of the underlying asset to deposit
     * @param amount The amount to be deposited
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *   0 if the action is executed directly by the user, without any middle-man
     **/
    function deposit(
        address asset,
        uint256 amount,
        uint16 referralCode
    ) external override whenNotPaused {
        DataTypes.ReserveData storage reserve = _reserves[asset];

        ValidationLogic.validateDeposit(reserve, amount);

        address aToken = reserve.aTokenAddress;

        reserve.updateState();
        reserve.updateInterestRates(asset, aToken, amount, 0);

        IERC20(asset).safeTransferFrom(msg.sender, aToken, amount);

        bool isFirstDeposit = IWToken(aToken).mint(
            msg.sender,
            amount,
            reserve.liquidityIndex
        );

        emit Deposit(asset, msg.sender, amount, referralCode);
    }

    /**
     * @dev Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
     * E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
     * @param asset The address of the underlying asset to withdraw
     * @param amount The underlying amount to be withdrawn
     *   - Send the value type(uint256).max in order to withdraw the whole aToken balance
     * @param to Address that will receive the underlying, same as msg.sender if the user
     *   wants to receive it on his own wallet, or a different address if the beneficiary is a
     *   different wallet
     * @return The final amount withdrawn
     **/
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external override whenNotPaused returns (uint256) {
        DataTypes.ReserveData storage reserve = _reserves[asset];

        address aToken = reserve.aTokenAddress;

        uint256 userBalance = IWToken(aToken).balanceOf(msg.sender);

        uint256 amountToWithdraw = amount;

        if (amount == type(uint256).max) {
            amountToWithdraw = userBalance;
        }

        ValidationLogic.validateWithdraw(
            asset,
            amountToWithdraw,
            userBalance,
            _reserves,
            _usersConfig[msg.sender],
            _reservesList,
            _reservesCount,
            _addressesProvider.getPriceOracle()
        );

        reserve.updateState();

        reserve.updateInterestRates(asset, aToken, 0, amountToWithdraw);

        IWToken(aToken).burn(
            msg.sender,
            to,
            amountToWithdraw,
            reserve.liquidityIndex
        );

        emit Withdraw(asset, msg.sender, to, amountToWithdraw);

        return amountToWithdraw;
    }

    /**
     * @dev Allows users to borrow a specific `amount` of the reserve underlying asset, provided that the borrower
     * already deposited enough collateral
     * - E.g. User borrows 100 USDC, receiving the 100 USDC in his wallet
     *   and lock collateral asset in contract
     * @param asset The address of the underlying asset to borrow
     * @param amount The amount to be borrowed
     * @param collateralAsset The address of the underlying asset used as collateral
     * @param tokenId The token ID of the underlying asset used as collateral
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *   0 if the action is executed directly by the user, without any middle-man
     **/
    function borrow(
        address asset,
        uint256 amount,
        address collateralAsset,
        uint256 tokenId,
        uint256 loanId,
        uint16 referralCode
    ) external override whenNotPaused {
        DataTypes.ReserveData storage reserve = _reserves[asset];

        _executeBorrow(
            ExecuteBorrowParams(
                asset,
                msg.sender,
                amount,
                reserve.aTokenAddress,
                collateralAsset,
                tokenId,
                loanId,
                referralCode,
                true
            )
        );
    }

    /**
     * @notice Repays a borrowed `amount` on a specific reserve, burning the equivalent loan owned
     * - E.g. User repays 100 USDC, burning loan and receives collateral asset
     * @param loanId The loan ID of the NFT loans
     * @param amount The amount to repay
     * @return The final amount repaid
     **/
    function repay(uint256 loanId, uint256 amount)
        external
        override
        whenNotPaused
        returns (uint256)
    {
        address user = msg.sender;
        address nftLoanAddr = _addressesProvider.getNFTLoan();
        address asset = INFTLoan(nftLoanAddr).getLoanReserve(loanId);

        DataTypes.ReserveData storage reserve = _reserves[asset];

        uint256 variableDebt = INFTLoan(nftLoanAddr).getLoanAmount(loanId);

        ValidationLogic.validateRepay(reserve, amount, variableDebt);

        uint256 paybackAmount = variableDebt;
        bool isUpdate = false;
        if (amount < paybackAmount) {
            isUpdate = true;
            paybackAmount = amount;
        }

        reserve.updateState();

        if (isUpdate) {
            INFTLoan(nftLoanAddr).updateLoan(
                user,
                loanId,
                0,
                amount,
                reserve.variableBorrowIndex
            );
        } else {
            INFTLoan(nftLoanAddr).burnLoan(
                user,
                loanId,
                reserve.variableBorrowIndex
            );
        }

        address aToken = reserve.aTokenAddress;
        reserve.updateInterestRates(asset, aToken, paybackAmount, 0);

        if (INFTLoan(nftLoanAddr).balanceOf(user) == 0) {
            _usersConfig[user].setBorrowing(reserve.id, false);
        }

        IERC20(asset).safeTransferFrom(msg.sender, aToken, paybackAmount);

        IWToken(aToken).handleRepayment(msg.sender, paybackAmount);

        emit Repay(loanId, asset, msg.sender, msg.sender, paybackAmount);

        return paybackAmount;
    }

    /**
     * @dev Function to liquidate a non-healthy position collateral-wise
     * - The caller (liquidator) buy collateral asset of the user getting liquidated, and receives
     *   the collateral asset
     * @param loanId The loan ID of the NFT loans
     **/
    function liquidate(uint256 loanId) external override whenNotPaused {
        address nftLoanAddr = _addressesProvider.getNFTLoan();
        address asset = INFTLoan(nftLoanAddr).getLoanReserve(loanId);
        address borrower = IERC721(nftLoanAddr).ownerOf(loanId);

        DataTypes.ReserveData storage reserve = _reserves[asset];

        (address nftContract, uint256 nftTokenId) = INFTLoan(nftLoanAddr)
            .getLoanCollateral(loanId);
        uint256 paybackAmount = INFTLoan(nftLoanAddr).getLoanAmount(loanId);

        address nftOracle = _addressesProvider.getNFTOracle();
        uint256 nftPrice = INFTOracleGetter(nftOracle).getAssetPrice(
            nftContract
        );
        uint256 thresholdPrice = nftPrice.percentMul(80e4);
        require(
            paybackAmount <= thresholdPrice,
            Errors.LP_PRICE_TOO_HIGH_TO_LIQUIDATE
        );

        uint256 liquidateAmount = nftPrice.percentMul(95e4);
        require(
            liquidateAmount >= paybackAmount,
            Errors.LP_PRICE_TOO_LOW_TO_LIQUIDATE
        );

        uint256 remainAmount = 0;
        if (liquidateAmount > paybackAmount) {
            remainAmount = liquidateAmount - paybackAmount;
        }

        INFTLoan(nftLoanAddr).burnLoan(
            msg.sender,
            loanId,
            reserve.variableBorrowIndex
        );

        IERC20(asset).safeTransferFrom(msg.sender, asset, paybackAmount);
        IERC20(asset).safeTransferFrom(msg.sender, borrower, remainAmount);

        emit Liquidate(
            loanId,
            borrower,
            asset,
            paybackAmount,
            remainAmount,
            msg.sender
        );
    }

    /**
     * @dev Returns the normalized income normalized income of the reserve
     * @param asset The address of the underlying asset of the reserve
     * @return The reserve's normalized income
     */
    function getReserveNormalizedIncome(address asset)
        external
        view
        override
        returns (uint256)
    {
        return _reserves[asset].getNormalizedIncome();
    }

    /**
     * @dev Returns the normalized variable debt per unit of asset
     * @param asset The address of the underlying asset of the reserve
     * @return The reserve normalized variable debt
     */
    function getReserveNormalizedVariableDebt(address asset)
        external
        view
        override
        returns (uint256)
    {
        return _reserves[asset].getNormalizedDebt();
    }

    /**
     * @dev Returns the state and configuration of the reserve
     * @param asset The address of the underlying asset of the reserve
     * @return The state of the reserve
     **/
    function getReserveData(address asset)
        external
        view
        override
        returns (DataTypes.ReserveData memory)
    {
        return _reserves[asset];
    }

    /**
     * @dev Validates and finalizes an aToken transfer
     * - Only callable by the overlying aToken of the `asset`
     * @param asset The address of the underlying asset of the aToken
     * @param from The user from which the aTokens are transferred
     * @param to The user receiving the aTokens
     * @param amount The amount being transferred/withdrawn
     * @param balanceFromBefore The aToken balance of the `from` user before the transfer
     * @param balanceToBefore The aToken balance of the `to` user before the transfer
     */
    function finalizeTransfer(
        address asset,
        address from,
        address to,
        uint256 amount,
        uint256 balanceFromBefore,
        uint256 balanceToBefore
    ) external override {}

    /**
     * @dev Returns the list of the initialized reserves
     **/
    function getReservesList()
        external
        view
        override
        returns (address[] memory)
    {
        address[] memory _activeReserves = new address[](_reservesCount);

        for (uint256 i = 0; i < _reservesCount; i++) {
            _activeReserves[i] = _reservesList[i];
        }
        return _activeReserves;
    }

    /**
     * @dev Set the _pause state of a reserve
     * - Only callable by the LendingPoolConfigurator contract
     * @param val `true` to pause the reserve, `false` to un-pause it
     */
    function setPause(bool val) external override {
        _paused = val;
        if (_paused) {
            emit Paused();
        } else {
            emit Unpaused();
        }
    }

    /**
     * @dev Returns if the LendingPool is paused
     */
    function paused() external view override returns (bool) {
        return _paused;
    }

    struct ExecuteBorrowParams {
        address asset;
        address user;
        uint256 amount;
        address aTokenAddress;
        address collateralAsset;
        uint256 tokenId;
        uint256 loanId;
        uint16 referralCode;
        bool releaseUnderlying;
    }

    function _executeBorrow(ExecuteBorrowParams memory vars) internal {
        DataTypes.ReserveData storage reserve = _reserves[vars.asset];
        DataTypes.UserConfigurationMap storage userConfig = _usersConfig[
            vars.user
        ];

        address oracle = _addressesProvider.getPriceOracle();
        uint256 assetPrice = IPriceOracleGetter(oracle).getAssetPrice(
            vars.asset
        );
        uint256 amountInETH = (assetPrice * vars.amount) /
            10**reserve.configuration.getDecimals();

        ValidationLogic.validateBorrow(
            vars.asset,
            reserve,
            vars.user,
            vars.amount,
            amountInETH,
            _reserves,
            userConfig,
            _reservesList,
            _reservesCount,
            oracle
        );

        reserve.updateState();

        address nftLoanAddr = _addressesProvider.getNFTLoan();

        bool isFirstBorrowing = false;
        if (INFTLoan(nftLoanAddr).balanceOf(vars.user) == 0) {
            isFirstBorrowing = true;
        }

        if (vars.loanId == 0) {
            uint256 loanId = INFTLoan(nftLoanAddr).mintLoan(
                vars.user,
                vars.collateralAsset,
                vars.tokenId,
                vars.asset,
                vars.amount,
                reserve.variableBorrowIndex
            );

            if (isFirstBorrowing) {
                userConfig.setBorrowing(reserve.id, true);
            }
        } else {
            INFTLoan(nftLoanAddr).updateLoan(
                vars.user,
                vars.loanId,
                vars.amount,
                0,
                reserve.variableBorrowIndex
            );
        }

        reserve.updateInterestRates(
            vars.asset,
            vars.aTokenAddress,
            0,
            vars.releaseUnderlying ? vars.amount : 0
        );

        if (vars.releaseUnderlying) {
            IWToken(vars.aTokenAddress).transferUnderlyingTo(
                vars.user,
                vars.amount
            );
        }

        emit Borrow(
            vars.asset,
            vars.user,
            vars.amount,
            vars.collateralAsset,
            vars.tokenId,
            vars.loanId,
            reserve.currentVariableBorrowRate,
            vars.referralCode
        );
    }
}

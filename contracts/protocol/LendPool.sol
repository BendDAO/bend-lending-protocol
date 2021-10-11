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
import {NftLogic} from "../libraries/logic/NftLogic.sol";
import {ValidationLogic} from "../libraries/logic/ValidationLogic.sol";
import {UserConfiguration} from "../libraries/configuration/UserConfiguration.sol";
import {ReserveConfiguration} from "../libraries/configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../libraries/configuration/NftConfiguration.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {LendPoolStorage} from "./LendPoolStorage.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

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
contract LendPool is Initializable, ILendPool, LendPoolStorage {
    using WadRayMath for uint256;
    using PercentageMath for uint256;
    using SafeERC20 for IERC20;
    using ReserveLogic for DataTypes.ReserveData;
    using NftLogic for DataTypes.NftData;
    using UserConfiguration for DataTypes.UserConfigurationMap;
    using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
    using NftConfiguration for DataTypes.NftConfigurationMap;

    modifier whenNotPaused() {
        _whenNotPaused();
        _;
    }

    modifier onlyLendPoolConfigurator() {
        _onlyLendPoolConfigurator();
        _;
    }

    function _whenNotPaused() internal view {
        require(!_paused, Errors.LP_IS_PAUSED);
    }

    function _onlyLendPoolConfigurator() internal view {
        require(
            _addressesProvider.getLendPoolConfigurator() == msg.sender,
            Errors.LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR
        );
    }

    /**
     * @dev Function is invoked by the proxy contract when the LendPool contract is added to the
     * LendPoolAddressesProvider of the market.
     * - Caching the address of the LendPoolAddressesProvider in order to reduce gas consumption
     *   on subsequent operations
     * @param provider The address of the LendPoolAddressesProvider
     **/
    function initialize(ILendPoolAddressesProvider provider)
        public
        initializer
    {
        _addressesProvider = provider;
        _maxNumberOfReserves = 128;
        _maxNumberOfNfts = 128;
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
     * @param nftAsset The address of the underlying nft used as collateral
     * @param nftTokenId The token ID of the underlying nft used as collateral
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *   0 if the action is executed directly by the user, without any middle-man
     **/
    function borrow(
        address asset,
        uint256 amount,
        address nftAsset,
        uint256 nftTokenId,
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
                nftAsset,
                nftTokenId,
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

    struct LiquidationCallLocalVars {
        uint256 errorCode;
        string errorMsg;
        address asset;
        address borrower;
        address nftContract;
        uint256 nftTokenId;
        uint256 ltv;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
        uint256 liquidatePrice;
        uint256 paybackAmount;
        uint256 remainAmount;
    }

    /**
     * @dev Function to liquidate a non-healthy position collateral-wise
     * - The caller (liquidator) buy collateral asset of the user getting liquidated, and receives
     *   the collateral asset
     * @param loanId The loan ID of the NFT loans
     **/
    function liquidate(uint256 loanId) external override whenNotPaused {
        LiquidationCallLocalVars memory vars;

        address nftLoanAddr = _addressesProvider.getNFTLoan();
        vars.asset = INFTLoan(nftLoanAddr).getLoanReserve(loanId);
        vars.borrower = IERC721(nftLoanAddr).ownerOf(loanId);

        (vars.nftContract, vars.nftTokenId) = INFTLoan(nftLoanAddr)
            .getLoanCollateral(loanId);
        vars.paybackAmount = INFTLoan(nftLoanAddr).getLoanAmount(loanId);

        DataTypes.ReserveData storage reserve = _reserves[vars.asset];
        DataTypes.NftData storage nftData = _nfts[vars.nftContract];

        (vars.ltv, vars.liquidationThreshold, vars.liquidationBonus) = nftData
            .configuration
            .getParams();

        (vars.errorCode, vars.errorMsg) = ValidationLogic.validateLiquidate(
            reserve,
            nftData,
            vars.paybackAmount
        );

        address nftOracle = _addressesProvider.getNFTOracle();
        uint256 nftPrice = INFTOracleGetter(nftOracle).getAssetPrice(
            vars.nftContract
        );

        uint256 thresholdPrice = nftPrice.percentMul(vars.liquidationThreshold);
        require(
            vars.paybackAmount <= thresholdPrice,
            Errors.LP_PRICE_TOO_HIGH_TO_LIQUIDATE
        );

        vars.liquidatePrice = nftPrice.percentMul(
            vars.liquidationBonus - PercentageMath.PERCENTAGE_FACTOR
        );
        require(
            vars.liquidatePrice >= vars.paybackAmount,
            Errors.LP_PRICE_TOO_LOW_TO_LIQUIDATE
        );

        vars.remainAmount = 0;
        if (vars.liquidatePrice > vars.paybackAmount) {
            vars.remainAmount = vars.liquidatePrice - vars.paybackAmount;
        }

        reserve.updateState();

        INFTLoan(nftLoanAddr).burnLoan(
            msg.sender,
            loanId,
            reserve.variableBorrowIndex
        );

        reserve.updateInterestRates(
            vars.asset,
            reserve.aTokenAddress,
            vars.paybackAmount,
            0
        );

        IERC20(vars.asset).safeTransferFrom(
            msg.sender,
            vars.asset,
            vars.paybackAmount
        );
        if (vars.remainAmount > 0) {
            IERC20(vars.asset).safeTransferFrom(
                msg.sender,
                vars.borrower,
                vars.remainAmount
            );
        }

        emit Liquidate(
            loanId,
            vars.borrower,
            vars.asset,
            vars.paybackAmount,
            vars.remainAmount,
            msg.sender
        );
    }

    /**
     * @dev Returns the configuration of the reserve
     * @param asset The address of the underlying asset of the reserve
     * @return The configuration of the reserve
     **/
    function getReserveConfiguration(address asset)
        external
        view
        override
        returns (DataTypes.ReserveConfigurationMap memory)
    {
        return _reserves[asset].configuration;
    }

    /**
     * @dev Returns the configuration of the user across all the reserves
     * @param user The user address
     * @return The configuration of the user
     **/
    function getUserConfiguration(address user)
        external
        view
        override
        returns (DataTypes.UserConfigurationMap memory)
    {
        return _usersConfig[user];
    }

    /**
     * @dev Returns the configuration of the NFT
     * @param asset The address of the asset of the NFT
     * @return The configuration of the NFT
     **/
    function getNftConfiguration(address asset)
        external
        view
        override
        returns (DataTypes.NftConfigurationMap memory)
    {
        return _nfts[asset].configuration;
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
     * @dev Returns the state and configuration of the nft
     * @param asset The address of the underlying asset of the nft
     * @return The state of the nft
     **/
    function getNftData(address asset)
        external
        view
        override
        returns (DataTypes.NftData memory)
    {
        return _nfts[asset];
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
     * @dev Returns the list of the initialized nfts
     **/
    function getNftsList() external view override returns (address[] memory) {
        address[] memory _activeNfts = new address[](_nftsCount);

        for (uint256 i = 0; i < _nftsCount; i++) {
            _activeNfts[i] = _nftsList[i];
        }
        return _activeNfts;
    }

    /**
     * @dev Set the _pause state of the pool
     * - Only callable by the LendPoolConfigurator contract
     * @param val `true` to pause the pool, `false` to un-pause it
     */
    function setPause(bool val) external override onlyLendPoolConfigurator {
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

    /**
     * @dev Initializes a reserve, activating it, assigning an aToken and nft loan and an
     * interest rate strategy
     * - Only callable by the LendingPoolConfigurator contract
     * @param asset The address of the underlying asset of the reserve
     * @param aTokenAddress The address of the aToken that will be assigned to the reserve
     * @param nftLoanAddress The address of the NFTLoan that will be assigned to the reserve
     * @param interestRateAddress The address of the interest rate strategy contract
     **/
    function initReserve(
        address asset,
        address aTokenAddress,
        address nftLoanAddress,
        address interestRateAddress
    ) external override onlyLendPoolConfigurator {
        require(Address.isContract(asset), Errors.LP_NOT_CONTRACT);
        _reserves[asset].init(
            aTokenAddress,
            nftLoanAddress,
            interestRateAddress
        );
        _addReserveToList(asset);
    }

    /**
     * @dev Initializes a nft, activating it, assigning nft loan and an
     * interest rate strategy
     * - Only callable by the LendingPoolConfigurator contract
     * @param asset The address of the underlying asset of the nft
     **/
    function initNft(address asset, address nftLoanAddress)
        external
        override
        onlyLendPoolConfigurator
    {
        require(Address.isContract(asset), Errors.LP_NOT_CONTRACT);
        _nfts[asset].init(nftLoanAddress);
        _addNftToList(asset);
    }

    /**
     * @dev Updates the address of the interest rate strategy contract
     * - Only callable by the LendPoolConfigurator contract
     * @param asset The address of the underlying asset of the reserve
     * @param rateAddress The address of the interest rate strategy contract
     **/
    function setReserveInterestRateAddress(address asset, address rateAddress)
        external
        override
        onlyLendPoolConfigurator
    {
        _reserves[asset].interestRateAddress = rateAddress;
    }

    function setNftLoanAddress(address asset, address loanAddress)
        external
        override
        onlyLendPoolConfigurator
    {
        _nfts[asset].nftLoanAddress = loanAddress;
    }

    /**
     * @dev Sets the configuration bitmap of the reserve as a whole
     * - Only callable by the LendPoolConfigurator contract
     * @param asset The address of the underlying asset of the reserve
     * @param configuration The new configuration bitmap
     **/
    function setReserveConfiguration(address asset, uint256 configuration)
        external
        override
        onlyLendPoolConfigurator
    {
        _reserves[asset].configuration.data = configuration;
    }

    /**
     * @dev Sets the configuration bitmap of the NFT as a whole
     * - Only callable by the LendPoolConfigurator contract
     * @param asset The address of the asset of the NFT
     * @param configuration The new configuration bitmap
     **/
    function setNftConfiguration(address asset, uint256 configuration)
        external
        override
        onlyLendPoolConfigurator
    {
        _nfts[asset].configuration.data = configuration;
    }

    function _addReserveToList(address asset) internal {
        uint256 reservesCount = _reservesCount;

        require(
            reservesCount < _maxNumberOfReserves,
            Errors.LP_NO_MORE_RESERVES_ALLOWED
        );

        bool reserveAlreadyAdded = _reserves[asset].id != 0 ||
            _reservesList[0] == asset;

        if (!reserveAlreadyAdded) {
            _reserves[asset].id = uint8(reservesCount);
            _reservesList[reservesCount] = asset;

            _reservesCount = reservesCount + 1;
        }
    }

    function _addNftToList(address asset) internal {
        uint256 nftsCount = _nftsCount;

        require(nftsCount < _maxNumberOfNfts, Errors.LP_NO_MORE_NFTS_ALLOWED);

        bool nftAlreadyAdded = _nfts[asset].id != 0 || _nftsList[0] == asset;

        if (!nftAlreadyAdded) {
            _nfts[asset].id = uint8(nftsCount);
            _nftsList[nftsCount] = asset;

            _nftsCount = nftsCount + 1;
        }
    }

    struct ExecuteBorrowParams {
        address asset;
        address user;
        uint256 amount;
        address aTokenAddress;
        address nftAsset;
        uint256 nftTokenId;
        uint256 loanId;
        uint16 referralCode;
        bool releaseUnderlying;
    }

    struct ExecuteBorrowLocalVars {
        uint256 ltv;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
        uint256 amountInETH;
        uint256 assetPrice;
        uint256 nftPrice;
        uint256 thresholdPrice;
        bool isFirstBorrowing;
        uint256 newLoanId;
    }

    function _executeBorrow(ExecuteBorrowParams memory params) internal {
        DataTypes.ReserveData storage reserve = _reserves[params.asset];
        DataTypes.UserConfigurationMap storage userConfig = _usersConfig[
            params.user
        ];
        DataTypes.NftData storage nftData = _nfts[params.nftAsset];
        ExecuteBorrowLocalVars memory vars;

        // Convert asset amount to ETH
        address oracle = _addressesProvider.getPriceOracle();
        vars.assetPrice = IPriceOracleGetter(oracle).getAssetPrice(
            params.asset
        );
        vars.amountInETH =
            (vars.assetPrice * params.amount) /
            10**reserve.configuration.getDecimals();

        ValidationLogic.validateBorrow(
            params.asset,
            params.amount,
            reserve,
            nftData
        );

        // NFT Price in ETH
        address nftOracle = _addressesProvider.getNFTOracle();
        vars.nftPrice = INFTOracleGetter(nftOracle).getAssetPrice(
            params.nftAsset
        );

        (vars.ltv, vars.liquidationThreshold, vars.liquidationBonus) = nftData
            .configuration
            .getParams();
        vars.thresholdPrice = vars.nftPrice.percentMul(vars.ltv);
        require(
            vars.amountInETH <= vars.thresholdPrice,
            Errors.VL_INVALID_AMOUNT
        );

        reserve.updateState();

        address nftLoanAddr = _addressesProvider.getNFTLoan();

        vars.isFirstBorrowing = false;
        if (INFTLoan(nftLoanAddr).balanceOf(params.user) == 0) {
            vars.isFirstBorrowing = true;
        }

        vars.newLoanId = 0;

        if (params.loanId == 0) {
            (vars.newLoanId) = INFTLoan(nftLoanAddr).mintLoan(
                params.user,
                params.nftAsset,
                params.nftTokenId,
                params.asset,
                params.amount,
                reserve.variableBorrowIndex
            );

            if (vars.isFirstBorrowing) {
                userConfig.setBorrowing(reserve.id, true);
            }
        } else {
            INFTLoan(nftLoanAddr).updateLoan(
                params.user,
                params.loanId,
                params.amount,
                0,
                reserve.variableBorrowIndex
            );
        }

        reserve.updateInterestRates(
            params.asset,
            params.aTokenAddress,
            0,
            params.releaseUnderlying ? params.amount : 0
        );

        if (params.releaseUnderlying) {
            IWToken(params.aTokenAddress).transferUnderlyingTo(
                params.user,
                params.amount
            );
        }

        emit Borrow(
            params.asset,
            params.user,
            params.amount,
            params.nftAsset,
            params.nftTokenId,
            params.loanId,
            reserve.currentVariableBorrowRate,
            params.referralCode
        );
    }
}

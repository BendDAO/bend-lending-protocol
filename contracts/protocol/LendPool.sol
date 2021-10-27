// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IBToken} from "../interfaces/IBToken.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {IReserveOracleGetter} from "../interfaces/IReserveOracleGetter.sol";
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

import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

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
contract LendPool is
    Initializable,
    ILendPool,
    LendPoolStorage,
    ContextUpgradeable
{
    using WadRayMath for uint256;
    using PercentageMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
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
            _addressesProvider.getLendPoolConfigurator() == _msgSender(),
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
     * @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying bTokens.
     * - E.g. User deposits 100 USDC and gets in return 100 aUSDC
     * @param asset The address of the underlying asset to deposit
     * @param amount The amount to be deposited
     * @param onBehalfOf The address that will receive the bTokens, same as msg.sender if the user
     *   wants to receive them on his own wallet, or a different address if the beneficiary of bTokens
     *   is a different wallet
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *   0 if the action is executed directly by the user, without any middle-man
     **/
    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external override whenNotPaused {
        DataTypes.ReserveData storage reserve = _reserves[asset];

        ValidationLogic.validateDeposit(reserve, amount);

        address bToken = reserve.bTokenAddress;

        reserve.updateState(asset, _addressesProvider.getLendPoolLoan());
        reserve.updateInterestRates(
            asset,
            bToken,
            amount,
            0,
            _addressesProvider.getLendPoolLoan()
        );

        IERC20Upgradeable(asset).safeTransferFrom(_msgSender(), bToken, amount);

        IBToken(bToken).mint(onBehalfOf, amount, reserve.liquidityIndex);

        emit Deposit(asset, _msgSender(), onBehalfOf, amount, referralCode);
    }

    /**
     * @dev Withdraws an `amount` of underlying asset from the reserve, burning the equivalent bTokens owned
     * E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
     * @param asset The address of the underlying asset to withdraw
     * @param amount The underlying amount to be withdrawn
     *   - Send the value type(uint256).max in order to withdraw the whole bToken balance
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

        address bToken = reserve.bTokenAddress;

        uint256 userBalance = IBToken(bToken).balanceOf(_msgSender());

        uint256 amountToWithdraw = amount;

        if (amount == type(uint256).max) {
            amountToWithdraw = userBalance;
        }

        ValidationLogic.validateWithdraw(
            asset,
            amountToWithdraw,
            userBalance,
            _reserves,
            _usersConfig[_msgSender()],
            _reservesList,
            _reservesCount,
            _addressesProvider.getReserveOracle()
        );

        reserve.updateState(asset, _addressesProvider.getLendPoolLoan());

        reserve.updateInterestRates(
            asset,
            bToken,
            0,
            amountToWithdraw,
            _addressesProvider.getLendPoolLoan()
        );

        IBToken(bToken).burn(
            _msgSender(),
            to,
            amountToWithdraw,
            reserve.liquidityIndex
        );

        emit Withdraw(asset, _msgSender(), to, amountToWithdraw);

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
     * @param onBehalfOf Address of the user who will receive the loan. Should be the address of the borrower itself
     * calling the function if he wants to borrow against his own collateral, or the address of the credit delegator
     * if he has been given credit delegation allowance
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *   0 if the action is executed directly by the user, without any middle-man
     **/
    function borrow(
        address asset,
        uint256 amount,
        address nftAsset,
        uint256 nftTokenId,
        address onBehalfOf,
        uint16 referralCode
    ) external override whenNotPaused {
        DataTypes.ReserveData storage reserve = _reserves[asset];
        DataTypes.NftData storage nftData = _nfts[nftAsset];

        _executeBorrow(
            ExecuteBorrowParams(
                _msgSender(),
                onBehalfOf,
                asset,
                amount,
                reserve.bTokenAddress,
                nftAsset,
                nftTokenId,
                nftData.bNftAddress,
                referralCode,
                true
            )
        );
    }

    struct RepayLocalVars {
        address repayer;
        address borrower;
        address onBehalfOf;
        address asset;
        address nftAsset;
        uint256 nftTokenId;
        uint256 loanId;
        bool isUpdate;
        uint256 variableDebt;
        uint256 paybackAmount;
    }

    /**
     * @notice Repays a borrowed `amount` on a specific reserve, burning the equivalent loan owned
     * - E.g. User repays 100 USDC, burning loan and receives collateral asset
     * @param nftAsset The address of the underlying NFT used as collateral
     * @param nftTokenId The token ID of the underlying NFT used as collateral
     * @param amount The amount to repay
     * @return The final amount repaid, loan is burned or not
     **/
    function repay(
        address nftAsset,
        uint256 nftTokenId,
        uint256 amount
    ) external override whenNotPaused returns (uint256, bool) {
        RepayLocalVars memory vars;

        address loanAddress = _addressesProvider.getLendPoolLoan();

        vars.nftAsset = nftAsset;
        vars.nftTokenId = nftTokenId;

        vars.loanId = ILendPoolLoan(loanAddress).getCollateralLoanId(
            nftAsset,
            nftTokenId
        );
        require(vars.loanId != 0, Errors.LPL_NFT_IS_NOT_USED_AS_COLLATERAL);

        vars.repayer = _msgSender();
        vars.asset = ILendPoolLoan(loanAddress).getLoanReserve(vars.loanId);
        vars.borrower = ILendPoolLoan(loanAddress).borrowerOf(vars.loanId);

        DataTypes.ReserveData storage reserve = _reserves[vars.asset];
        DataTypes.NftData storage nftData = _nfts[vars.nftAsset];

        vars.variableDebt = ILendPoolLoan(loanAddress)
            .getLoanReserveBorrowAmount(vars.loanId);

        ValidationLogic.validateRepay(
            vars.repayer,
            vars.borrower,
            reserve,
            amount,
            vars.variableDebt
        );

        vars.paybackAmount = vars.variableDebt;
        vars.isUpdate = false;
        if (amount < vars.paybackAmount) {
            vars.isUpdate = true;
            vars.paybackAmount = amount;
        }

        reserve.updateState(vars.asset, _addressesProvider.getLendPoolLoan());

        if (vars.isUpdate) {
            ILendPoolLoan(loanAddress).updateLoan(
                vars.borrower,
                vars.loanId,
                0,
                amount,
                reserve.variableBorrowIndex
            );
        } else {
            ILendPoolLoan(loanAddress).repayLoan(
                vars.borrower,
                vars.loanId,
                nftData.bNftAddress
            );
        }

        reserve.updateInterestRates(
            vars.asset,
            reserve.bTokenAddress,
            vars.paybackAmount,
            0,
            _addressesProvider.getLendPoolLoan()
        );

        if (
            ILendPoolLoan(loanAddress).getUserReserveBorrowScaledAmount(
                vars.borrower,
                vars.asset
            ) == 0
        ) {
            _usersConfig[vars.borrower].setReserveBorrowing(reserve.id, false);
        }

        if (
            ILendPoolLoan(loanAddress).getUserNftCollateralAmount(
                vars.borrower,
                vars.nftAsset
            ) == 0
        ) {
            _usersConfig[vars.borrower].setUsingNftAsCollateral(
                nftData.id,
                false
            );
        }

        IERC20Upgradeable(vars.asset).safeTransferFrom(
            vars.repayer,
            reserve.bTokenAddress,
            vars.paybackAmount
        );

        emit Repay(
            vars.nftAsset,
            vars.nftTokenId,
            vars.asset,
            vars.borrower,
            vars.repayer,
            vars.paybackAmount,
            vars.loanId
        );

        return (vars.paybackAmount, !vars.isUpdate);
    }

    struct LiquidationCallLocalVars {
        address user;
        address asset;
        address borrower;
        address nftAsset;
        uint256 nftTokenId;
        uint256 loanId;
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
     * @param nftAsset The address of the underlying NFT used as collateral
     * @param nftTokenId The token ID of the underlying NFT used as collateral
     **/
    function liquidate(address nftAsset, uint256 nftTokenId)
        external
        override
        whenNotPaused
    {
        LiquidationCallLocalVars memory vars;
        vars.user = _msgSender();

        address loanAddress = _addressesProvider.getLendPoolLoan();

        vars.nftAsset = nftAsset;
        vars.nftTokenId = nftTokenId;

        vars.loanId = ILendPoolLoan(loanAddress).getCollateralLoanId(
            nftAsset,
            nftTokenId
        );
        require(vars.loanId != 0, Errors.LPL_NFT_IS_NOT_USED_AS_COLLATERAL);

        vars.asset = ILendPoolLoan(loanAddress).getLoanReserve(vars.loanId);

        vars.paybackAmount = ILendPoolLoan(loanAddress)
            .getLoanReserveBorrowAmount(vars.loanId);

        DataTypes.ReserveData storage reserve = _reserves[vars.asset];
        DataTypes.NftData storage nftData = _nfts[vars.nftAsset];

        //vars.borrower = IERC721Upgradeable(nftData.bNftAddress).ownerOf(vars.nftTokenId);
        vars.borrower = ILendPoolLoan(loanAddress).borrowerOf(vars.loanId);

        (vars.ltv, vars.liquidationThreshold, vars.liquidationBonus) = nftData
            .configuration
            .getParams();

        ValidationLogic.validateLiquidate(reserve, nftData, vars.paybackAmount);

        address nftOracle = _addressesProvider.getNFTOracle();
        uint256 nftPrice = INFTOracleGetter(nftOracle).getAssetPrice(
            vars.nftAsset
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

        reserve.updateState(vars.asset, _addressesProvider.getLendPoolLoan());

        ILendPoolLoan(loanAddress).liquidateLoan(
            vars.user,
            vars.loanId,
            nftData.bNftAddress
        );

        reserve.updateInterestRates(
            vars.asset,
            reserve.bTokenAddress,
            vars.paybackAmount,
            0,
            _addressesProvider.getLendPoolLoan()
        );

        if (
            ILendPoolLoan(loanAddress).getUserReserveBorrowScaledAmount(
                vars.borrower,
                vars.asset
            ) == 0
        ) {
            _usersConfig[vars.borrower].setReserveBorrowing(reserve.id, false);
        }

        if (
            ILendPoolLoan(loanAddress).getUserNftCollateralAmount(
                vars.borrower,
                vars.nftAsset
            ) == 0
        ) {
            _usersConfig[vars.borrower].setUsingNftAsCollateral(
                nftData.id,
                false
            );
        }

        IERC20Upgradeable(vars.asset).safeTransferFrom(
            vars.user,
            vars.asset,
            vars.paybackAmount
        );
        if (vars.remainAmount > 0) {
            IERC20Upgradeable(vars.asset).safeTransferFrom(
                vars.user,
                vars.borrower,
                vars.remainAmount
            );
        }

        emit Liquidate(
            vars.nftAsset,
            vars.nftTokenId,
            vars.borrower,
            vars.asset,
            vars.paybackAmount,
            vars.remainAmount,
            vars.user,
            vars.loanId
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
     * @dev Validates and finalizes an bToken transfer
     * - Only callable by the overlying bToken of the `asset`
     * @param asset The address of the underlying asset of the bToken
     * @param from The user from which the bToken are transferred
     * @param to The user receiving the bTokens
     * @param amount The amount being transferred/withdrawn
     * @param balanceFromBefore The bToken balance of the `from` user before the transfer
     * @param balanceToBefore The bToken balance of the `to` user before the transfer
     */
    function finalizeTransfer(
        address asset,
        address from,
        address to,
        uint256 amount,
        uint256 balanceFromBefore,
        uint256 balanceToBefore
    ) external pure override {
        asset;
        from;
        to;
        amount;
        balanceFromBefore;
        balanceToBefore;
    }

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
     * @dev Returns the cached LendPoolAddressesProvider connected to this contract
     **/
    function getAddressesProvider()
        external
        view
        override
        returns (ILendPoolAddressesProvider)
    {
        return _addressesProvider;
    }

    /**
     * @dev Returns the maximum number of reserves supported to be listed in this LendPool
     */
    function MAX_NUMBER_RESERVES() public view returns (uint256) {
        return _maxNumberOfReserves;
    }

    /**
     * @dev Returns the maximum number of nfts supported to be listed in this LendPool
     */
    function MAX_NUMBER_NFTS() public view returns (uint256) {
        return _maxNumberOfNfts;
    }

    /**
     * @dev Initializes a reserve, activating it, assigning an bToken and nft loan and an
     * interest rate strategy
     * - Only callable by the LendingPoolConfigurator contract
     * @param asset The address of the underlying asset of the reserve
     * @param bTokenAddress The address of the bToken that will be assigned to the reserve
     * @param interestRateAddress The address of the interest rate strategy contract
     **/
    function initReserve(
        address asset,
        address bTokenAddress,
        address interestRateAddress
    ) external override onlyLendPoolConfigurator {
        require(AddressUpgradeable.isContract(asset), Errors.LP_NOT_CONTRACT);
        _reserves[asset].init(bTokenAddress, interestRateAddress);
        _addReserveToList(asset);
    }

    /**
     * @dev Initializes a nft, activating it, assigning nft loan and an
     * interest rate strategy
     * - Only callable by the LendingPoolConfigurator contract
     * @param asset The address of the underlying asset of the nft
     **/
    function initNft(address asset, address bNftAddress)
        external
        override
        onlyLendPoolConfigurator
    {
        require(AddressUpgradeable.isContract(asset), Errors.LP_NOT_CONTRACT);
        _nfts[asset].init(bNftAddress);
        _addNftToList(asset);

        require(
            _addressesProvider.getLendPoolLoan() != address(0),
            Errors.LPC_INVALIED_LOAN_ADDRESS
        );
        IERC721Upgradeable(asset).setApprovalForAll(
            _addressesProvider.getLendPoolLoan(),
            true
        );

        ILendPoolLoan(_addressesProvider.getLendPoolLoan()).initNft(
            asset,
            bNftAddress
        );
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
        address user;
        address onBehalfOf;
        address asset;
        uint256 amount;
        address bTokenAddress;
        address nftAsset;
        uint256 nftTokenId;
        address bNftAddress;
        uint16 referralCode;
        bool releaseUnderlying;
    }

    struct ExecuteBorrowLocalVars {
        uint256 ltv;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
        uint256 amountInETH;
        uint256 reservePrice;
        uint256 nftPrice;
        uint256 thresholdPrice;
        bool isFirstBorrowing;
        bool isFirstPledging;
        uint256 loanId;
        address reserveOracle;
        address nftOracle;
        address loanAddress;
    }

    function _executeBorrow(ExecuteBorrowParams memory params) internal {
        DataTypes.ReserveData storage reserve = _reserves[params.asset];
        DataTypes.UserConfigurationMap storage userConfig = _usersConfig[
            params.onBehalfOf
        ];
        DataTypes.NftData storage nftData = _nfts[params.nftAsset];
        ExecuteBorrowLocalVars memory vars;

        // Convert asset amount to ETH
        vars.reserveOracle = _addressesProvider.getReserveOracle();
        vars.nftOracle = _addressesProvider.getNFTOracle();
        vars.loanAddress = _addressesProvider.getLendPoolLoan();

        vars.reservePrice = IReserveOracleGetter(vars.reserveOracle)
            .getAssetPrice(params.asset);
        vars.amountInETH =
            (vars.reservePrice * params.amount) /
            10**reserve.configuration.getDecimals();

        vars.loanId = ILendPoolLoan(vars.loanAddress).getCollateralLoanId(
            params.nftAsset,
            params.nftTokenId
        );

        ValidationLogic.validateBorrow(
            params.onBehalfOf,
            params.asset,
            params.amount,
            vars.amountInETH,
            reserve,
            params.nftAsset,
            nftData,
            vars.loanAddress,
            vars.loanId,
            vars.reserveOracle,
            vars.nftOracle
        );

        reserve.updateState(params.asset, _addressesProvider.getLendPoolLoan());

        vars.isFirstBorrowing = false;
        if (
            ILendPoolLoan(vars.loanAddress).getUserReserveBorrowScaledAmount(
                params.onBehalfOf,
                params.asset
            ) == 0
        ) {
            vars.isFirstBorrowing = true;
        }

        vars.isFirstPledging = false;
        if (
            ILendPoolLoan(vars.loanAddress).getUserNftCollateralAmount(
                params.onBehalfOf,
                params.nftAsset
            ) == 0
        ) {
            vars.isFirstPledging = true;
        }

        if (vars.loanId == 0) {
            IERC721Upgradeable(params.nftAsset).transferFrom(
                _msgSender(),
                address(this),
                params.nftTokenId
            );

            vars.loanId = ILendPoolLoan(vars.loanAddress).createLoan(
                params.user,
                params.onBehalfOf,
                params.nftAsset,
                params.nftTokenId,
                params.bNftAddress,
                params.asset,
                params.amount,
                reserve.variableBorrowIndex
            );

            if (vars.isFirstBorrowing) {
                userConfig.setReserveBorrowing(reserve.id, true);
            }

            if (vars.isFirstPledging) {
                userConfig.setUsingNftAsCollateral(nftData.id, true);
            }
        } else {
            ILendPoolLoan(vars.loanAddress).updateLoan(
                params.user,
                vars.loanId,
                params.amount,
                0,
                reserve.variableBorrowIndex
            );
        }

        reserve.updateInterestRates(
            params.asset,
            params.bTokenAddress,
            0,
            params.releaseUnderlying ? params.amount : 0,
            _addressesProvider.getLendPoolLoan()
        );

        if (params.releaseUnderlying) {
            IBToken(params.bTokenAddress).transferUnderlyingTo(
                params.user,
                params.amount
            );
        }

        emit Borrow(
            params.asset,
            params.user,
            params.onBehalfOf,
            params.amount,
            params.nftAsset,
            params.nftTokenId,
            reserve.currentVariableBorrowRate,
            vars.loanId,
            params.referralCode
        );
    }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
//import {InitializableImmutableAdminUpgradeabilityProxy} from "../libraries/upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol";
import {ReserveConfiguration} from "../libraries/configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../libraries/configuration/NftConfiguration.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {INFTLoan} from "../interfaces/INFTLoan.sol";
import {IBToken} from "../interfaces/IBToken.sol";
import {IIncentivesController} from "../interfaces/IIncentivesController.sol";
import {ILendPoolConfigurator} from "../interfaces/ILendPoolConfigurator.sol";

/**
 * @title LendPoolConfigurator contract
 * @author NFTLend
 * @dev Implements the configuration methods for the NFTLend protocol
 **/

contract LendPoolConfigurator is Initializable, ILendPoolConfigurator {
    using PercentageMath for uint256;
    using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
    using NftConfiguration for DataTypes.NftConfigurationMap;

    ILendPoolAddressesProvider internal addressesProvider;
    ILendPool internal pool;

    modifier onlyPoolAdmin() {
        require(
            addressesProvider.getPoolAdmin() == msg.sender,
            Errors.CALLER_NOT_POOL_ADMIN
        );
        _;
    }

    modifier onlyEmergencyAdmin() {
        require(
            addressesProvider.getEmergencyAdmin() == msg.sender,
            Errors.LPC_CALLER_NOT_EMERGENCY_ADMIN
        );
        _;
    }

    function initialize(ILendPoolAddressesProvider provider)
        public
        initializer
    {
        addressesProvider = provider;
        pool = ILendPool(addressesProvider.getLendPool());
    }

    /**
     * @dev Initializes reserves in batch
     **/
    function batchInitReserve(InitReserveInput[] calldata input)
        external
        onlyPoolAdmin
    {
        ILendPool cachedPool = pool;
        for (uint256 i = 0; i < input.length; i++) {
            _initReserve(cachedPool, input[i]);
        }
    }

    function _initReserve(ILendPool pool, InitReserveInput calldata input)
        internal
    {
        address bTokenProxyAddress = _initTokenWithProxy(
            input.bTokenImpl,
            abi.encodeWithSelector(
                IBToken.initialize.selector,
                pool,
                input.treasury,
                input.underlyingAsset,
                IIncentivesController(input.incentivesController),
                input.params
            )
        );

        pool.initReserve(
            input.underlyingAsset,
            bTokenProxyAddress,
            input.nftLoanAddress,
            input.interestRateAddress
        );

        DataTypes.ReserveConfigurationMap memory currentConfig = pool
            .getReserveConfiguration(input.underlyingAsset);

        currentConfig.setDecimals(input.underlyingAssetDecimals);

        currentConfig.setActive(true);
        currentConfig.setFrozen(false);

        pool.setReserveConfiguration(input.underlyingAsset, currentConfig.data);

        emit ReserveInitialized(
            input.underlyingAsset,
            bTokenProxyAddress,
            input.nftLoanAddress,
            input.interestRateAddress
        );
    }

    function batchInitNft(InitNftInput[] calldata input)
        external
        onlyPoolAdmin
    {
        ILendPool cachedPool = pool;
        for (uint256 i = 0; i < input.length; i++) {
            _initNft(cachedPool, input[i]);
        }
    }

    function _initNft(ILendPool pool, InitNftInput calldata input) internal {
        pool.initNft(input.underlyingAsset, input.nftLoanAddress);

        DataTypes.NftConfigurationMap memory currentConfig = pool
            .getNftConfiguration(input.underlyingAsset);

        currentConfig.setActive(true);
        currentConfig.setFrozen(false);

        pool.setNftConfiguration(input.underlyingAsset, currentConfig.data);

        emit NftInitialized(input.underlyingAsset, input.nftLoanAddress);
    }

    /**
     * @dev Updates the bToken implementation for the reserve
     **/
    function updateBToken(UpdateBTokenInput calldata input)
        external
        onlyPoolAdmin
    {
        ILendPool cachedPool = pool;

        DataTypes.ReserveData memory reserveData = cachedPool.getReserveData(
            input.asset
        );

        (, , , uint256 decimals, ) = cachedPool
            .getReserveConfiguration(input.asset)
            .getParamsMemory();

        bytes memory encodedCall = abi.encodeWithSelector(
            IBToken.initialize.selector,
            cachedPool,
            input.treasury,
            input.asset,
            input.incentivesController,
            input.params
        );

        _upgradeTokenImplementation(
            reserveData.bTokenAddress,
            input.implementation,
            encodedCall
        );

        emit BTokenUpgraded(
            input.asset,
            reserveData.bTokenAddress,
            input.implementation
        );
    }

    /**
     * @dev Enables borrowing on a reserve
     * @param asset The address of the underlying asset of the reserve
     **/
    function enableBorrowingOnReserve(address asset) external onlyPoolAdmin {
        DataTypes.ReserveConfigurationMap memory currentConfig = pool
            .getReserveConfiguration(asset);

        currentConfig.setBorrowingEnabled(true);

        pool.setReserveConfiguration(asset, currentConfig.data);

        emit BorrowingEnabledOnReserve(asset);
    }

    /**
     * @dev Disables borrowing on a reserve
     * @param asset The address of the underlying asset of the reserve
     **/
    function disableBorrowingOnReserve(address asset) external onlyPoolAdmin {
        DataTypes.ReserveConfigurationMap memory currentConfig = pool
            .getReserveConfiguration(asset);

        currentConfig.setBorrowingEnabled(false);

        pool.setReserveConfiguration(asset, currentConfig.data);
        emit BorrowingDisabledOnReserve(asset);
    }

    /**
     * @dev Activates a reserve
     * @param asset The address of the underlying asset of the reserve
     **/
    function activateReserve(address asset) external onlyPoolAdmin {
        DataTypes.ReserveConfigurationMap memory currentConfig = pool
            .getReserveConfiguration(asset);

        currentConfig.setActive(true);

        pool.setReserveConfiguration(asset, currentConfig.data);

        emit ReserveActivated(asset);
    }

    /**
     * @dev Deactivates a reserve
     * @param asset The address of the underlying asset of the reserve
     **/
    function deactivateReserve(address asset) external onlyPoolAdmin {
        _checkReserveNoLiquidity(asset);

        DataTypes.ReserveConfigurationMap memory currentConfig = pool
            .getReserveConfiguration(asset);

        currentConfig.setActive(false);

        pool.setReserveConfiguration(asset, currentConfig.data);

        emit ReserveDeactivated(asset);
    }

    /**
     * @dev Freezes a reserve. A frozen reserve doesn't allow any new deposit, borrow or rate swap
     *  but allows repayments, liquidations, rate rebalances and withdrawals
     * @param asset The address of the underlying asset of the reserve
     **/
    function freezeReserve(address asset) external onlyPoolAdmin {
        DataTypes.ReserveConfigurationMap memory currentConfig = pool
            .getReserveConfiguration(asset);

        currentConfig.setFrozen(true);

        pool.setReserveConfiguration(asset, currentConfig.data);

        emit ReserveFrozen(asset);
    }

    /**
     * @dev Unfreezes a reserve
     * @param asset The address of the underlying asset of the reserve
     **/
    function unfreezeReserve(address asset) external onlyPoolAdmin {
        DataTypes.ReserveConfigurationMap memory currentConfig = pool
            .getReserveConfiguration(asset);

        currentConfig.setFrozen(false);

        pool.setReserveConfiguration(asset, currentConfig.data);

        emit ReserveUnfrozen(asset);
    }

    /**
     * @dev Updates the reserve factor of a reserve
     * @param asset The address of the underlying asset of the reserve
     * @param reserveFactor The new reserve factor of the reserve
     **/
    function setReserveFactor(address asset, uint256 reserveFactor)
        external
        onlyPoolAdmin
    {
        DataTypes.ReserveConfigurationMap memory currentConfig = pool
            .getReserveConfiguration(asset);

        currentConfig.setReserveFactor(reserveFactor);

        pool.setReserveConfiguration(asset, currentConfig.data);

        emit ReserveFactorChanged(asset, reserveFactor);
    }

    /**
     * @dev Sets the interest rate strategy of a reserve
     * @param asset The address of the underlying asset of the reserve
     * @param rateAddress The new address of the interest strategy contract
     **/
    function setReserveInterestRateAddress(address asset, address rateAddress)
        external
        onlyPoolAdmin
    {
        pool.setReserveInterestRateAddress(asset, rateAddress);
        emit ReserveInterestRateChanged(asset, rateAddress);
    }

    /**
     * @dev Configures the NFT collateralization parameters
     * all the values are expressed in percentages with two decimals of precision. A valid value is 10000, which means 100.00%
     * @param asset The address of the underlying asset of the reserve
     * @param ltv The loan to value of the asset when used as NFT
     * @param liquidationThreshold The threshold at which loans using this asset as collateral will be considered undercollateralized
     * @param liquidationBonus The bonus liquidators receive to liquidate this asset. The values is always above 100%. A value of 105%
     * means the liquidator will receive a 5% bonus
     **/
    function configureNftAsCollateral(
        address asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external onlyPoolAdmin {
        DataTypes.NftConfigurationMap memory currentConfig = pool
            .getNftConfiguration(asset);

        //validation of the parameters: the LTV can
        //only be lower or equal than the liquidation threshold
        //(otherwise a loan against the asset would cause instantaneous liquidation)
        require(ltv <= liquidationThreshold, Errors.LPC_INVALID_CONFIGURATION);

        if (liquidationThreshold != 0) {
            //liquidation bonus must be bigger than 100.00%, otherwise the liquidator would receive less
            //collateral than needed to cover the debt
            require(
                liquidationBonus > PercentageMath.PERCENTAGE_FACTOR,
                Errors.LPC_INVALID_CONFIGURATION
            );

            //if threshold * bonus is less than PERCENTAGE_FACTOR, it's guaranteed that at the moment
            //a loan is taken there is enough collateral available to cover the liquidation bonus
            require(
                liquidationThreshold.percentMul(liquidationBonus) <=
                    PercentageMath.PERCENTAGE_FACTOR,
                Errors.LPC_INVALID_CONFIGURATION
            );
        } else {
            require(liquidationBonus == 0, Errors.LPC_INVALID_CONFIGURATION);
        }

        currentConfig.setLtv(ltv);
        currentConfig.setLiquidationThreshold(liquidationThreshold);
        currentConfig.setLiquidationBonus(liquidationBonus);

        pool.setNftConfiguration(asset, currentConfig.data);

        emit NftConfigurationChanged(
            asset,
            ltv,
            liquidationThreshold,
            liquidationBonus
        );
    }

    /**
     * @dev Activates a NFT
     * @param asset The address of the underlying asset of the NFT
     **/
    function activateNft(address asset) external onlyPoolAdmin {
        DataTypes.NftConfigurationMap memory currentConfig = pool
            .getNftConfiguration(asset);

        currentConfig.setActive(true);

        pool.setNftConfiguration(asset, currentConfig.data);

        emit NftActivated(asset);
    }

    /**
     * @dev Deactivates a NFT
     * @param asset The address of the underlying asset of the NFT
     **/
    function deactivateNft(address asset) external onlyPoolAdmin {
        DataTypes.NftConfigurationMap memory currentConfig = pool
            .getNftConfiguration(asset);

        currentConfig.setActive(false);

        pool.setNftConfiguration(asset, currentConfig.data);

        emit NftDeactivated(asset);
    }

    /**
     * @dev Freezes a NFT. A frozen NFT doesn't allow any new borrow
     *  but allows repayments, liquidations
     * @param asset The address of the underlying asset of the NFT
     **/
    function freezeNft(address asset) external onlyPoolAdmin {
        DataTypes.NftConfigurationMap memory currentConfig = pool
            .getNftConfiguration(asset);

        currentConfig.setFrozen(true);

        pool.setNftConfiguration(asset, currentConfig.data);

        emit NftFrozen(asset);
    }

    /**
     * @dev Unfreezes a NFT
     * @param asset The address of the underlying asset of the NFT
     **/
    function unfreezeNft(address asset) external onlyPoolAdmin {
        DataTypes.NftConfigurationMap memory currentConfig = pool
            .getNftConfiguration(asset);

        currentConfig.setFrozen(false);

        pool.setNftConfiguration(asset, currentConfig.data);

        emit NftUnfrozen(asset);
    }

    /**
     * @dev pauses or unpauses all the actions of the protocol, including bToken transfers
     * @param val true if protocol needs to be paused, false otherwise
     **/
    function setPoolPause(bool val) external onlyEmergencyAdmin {
        pool.setPause(val);
    }

    function _initTokenWithProxy(
        address implementation,
        bytes memory initParams
    ) internal returns (address) {
        /*
        InitializableImmutableAdminUpgradeabilityProxy proxy = new InitializableImmutableAdminUpgradeabilityProxy(
                address(this)
            );

        proxy.initialize(implementation, initParams);
        */
        address proxy;

        return address(proxy);
    }

    function _upgradeTokenImplementation(
        address proxyAddress,
        address implementation,
        bytes memory initParams
    ) internal {
        /*
        InitializableImmutableAdminUpgradeabilityProxy proxy = InitializableImmutableAdminUpgradeabilityProxy(
                payable(proxyAddress)
            );

        proxy.upgradeToAndCall(implementation, initParams);
        */
    }

    function _checkReserveNoLiquidity(address asset) internal view {
        DataTypes.ReserveData memory reserveData = pool.getReserveData(asset);

        uint256 availableLiquidity = IERC20(asset).balanceOf(
            reserveData.bTokenAddress
        );

        require(
            availableLiquidity == 0 && reserveData.currentLiquidityRate == 0,
            Errors.LPC_RESERVE_LIQUIDITY_NOT_0
        );
    }
}

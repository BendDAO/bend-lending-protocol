// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {IBToken} from "../interfaces/IBToken.sol";
import {IDebtToken} from "../interfaces/IDebtToken.sol";
import {IBNFT} from "../interfaces/IBNFT.sol";
import {IBNFTRegistry} from "../interfaces/IBNFTRegistry.sol";
import {IIncentivesController} from "../interfaces/IIncentivesController.sol";
import {ILendPoolConfigurator} from "../interfaces/ILendPoolConfigurator.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {BendUpgradeableProxy} from "../libraries/proxy/BendUpgradeableProxy.sol";
import {ReserveConfiguration} from "../libraries/configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../libraries/configuration/NftConfiguration.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title LendPoolConfigurator contract
 * @author Bend
 * @dev Implements the configuration methods for the Bend protocol
 **/

contract LendPoolConfigurator is Initializable, ILendPoolConfigurator {
  using PercentageMath for uint256;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using NftConfiguration for DataTypes.NftConfigurationMap;

  ILendPoolAddressesProvider internal _addressesProvider;
  ILendPool internal _pool;
  IBNFTRegistry internal _bnftRegistry;

  modifier onlyPoolAdmin() {
    require(_addressesProvider.getPoolAdmin() == msg.sender, Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  modifier onlyAddressProvider() {
    require(address(_addressesProvider) == msg.sender, Errors.CALLER_NOT_ADDRESS_PROVIDER);
    _;
  }

  modifier onlyEmergencyAdmin() {
    require(_addressesProvider.getEmergencyAdmin() == msg.sender, Errors.LPC_CALLER_NOT_EMERGENCY_ADMIN);
    _;
  }

  function initialize(ILendPoolAddressesProvider provider) public initializer {
    _setAddressProvider(provider);
  }

  function initializeAfterUpgrade(ILendPoolAddressesProvider provider) public onlyAddressProvider {
    _setAddressProvider(provider);
  }

  function _setAddressProvider(ILendPoolAddressesProvider provider) internal {
    _addressesProvider = provider;
    _pool = ILendPool(_addressesProvider.getLendPool());
    _bnftRegistry = IBNFTRegistry(_addressesProvider.getBNFTRegistry());
  }

  /**
   * @dev Initializes reserves in batch
   **/
  function batchInitReserve(InitReserveInput[] calldata input) external onlyPoolAdmin {
    ILendPool cachedPool = _pool;
    for (uint256 i = 0; i < input.length; i++) {
      _initReserve(cachedPool, input[i]);
    }
  }

  function _initReserve(ILendPool pool_, InitReserveInput calldata input) internal {
    address bTokenProxyAddress = _initTokenWithProxy(
      input.bTokenImpl,
      abi.encodeWithSelector(
        IBToken.initialize.selector,
        _addressesProvider,
        input.treasury,
        input.underlyingAsset,
        IIncentivesController(input.incentivesController),
        input.underlyingAssetDecimals,
        input.bTokenName,
        input.bTokenSymbol,
        input.params
      )
    );

    address debtTokenProxyAddress = _initTokenWithProxy(
      input.debtTokenImpl,
      abi.encodeWithSelector(
        IDebtToken.initialize.selector,
        _addressesProvider,
        input.underlyingAsset,
        IIncentivesController(input.incentivesController),
        input.underlyingAssetDecimals,
        input.debtTokenName,
        input.debtTokenSymbol,
        input.params
      )
    );

    pool_.initReserve(input.underlyingAsset, bTokenProxyAddress, debtTokenProxyAddress, input.interestRateAddress);

    DataTypes.ReserveConfigurationMap memory currentConfig = pool_.getReserveConfiguration(input.underlyingAsset);

    currentConfig.setDecimals(input.underlyingAssetDecimals);

    currentConfig.setActive(true);
    currentConfig.setFrozen(false);

    pool_.setReserveConfiguration(input.underlyingAsset, currentConfig.data);

    emit ReserveInitialized(
      input.underlyingAsset,
      bTokenProxyAddress,
      debtTokenProxyAddress,
      input.interestRateAddress
    );
  }

  function batchInitNft(InitNftInput[] calldata input) external onlyPoolAdmin {
    ILendPool cachedPool = _pool;
    IBNFTRegistry cachedRegistry = _bnftRegistry;

    for (uint256 i = 0; i < input.length; i++) {
      _initNft(cachedPool, cachedRegistry, input[i]);
    }
  }

  function _initNft(
    ILendPool pool_,
    IBNFTRegistry registry_,
    InitNftInput calldata input
  ) internal {
    // BNFT proxy and implementation are created in BNFTRegistry
    (address bNftProxy, ) = registry_.getBNFTAddresses(input.underlyingAsset);
    require(bNftProxy != address(0), Errors.LPC_INVALIED_BNFT_ADDRESS);

    pool_.initNft(input.underlyingAsset, bNftProxy);

    DataTypes.NftConfigurationMap memory currentConfig = pool_.getNftConfiguration(input.underlyingAsset);

    currentConfig.setActive(true);
    currentConfig.setFrozen(false);

    pool_.setNftConfiguration(input.underlyingAsset, currentConfig.data);

    emit NftInitialized(input.underlyingAsset, bNftProxy);
  }

  /**
   * @dev Updates the bToken implementation for the reserve
   **/
  function updateBToken(UpdateBTokenInput calldata input) external onlyPoolAdmin {
    ILendPool cachedPool = _pool;

    DataTypes.ReserveData memory reserveData = cachedPool.getReserveData(input.asset);

    (, , , uint256 decimals, ) = cachedPool.getReserveConfiguration(input.asset).getParamsMemory();

    bytes memory encodedCall = abi.encodeWithSelector(
      IBToken.initializeAfterUpgrade.selector,
      _addressesProvider,
      input.treasury,
      input.asset,
      IIncentivesController(input.incentivesController),
      decimals,
      input.name,
      input.symbol,
      input.params
    );

    _upgradeTokenImplementation(reserveData.bTokenAddress, input.implementation, encodedCall);

    emit BTokenUpgraded(input.asset, reserveData.bTokenAddress, input.implementation);
  }

  /**
   * @dev Updates the debt token implementation for the asset
   **/
  function updateDebtToken(UpdateDebtTokenInput calldata input) external onlyPoolAdmin {
    ILendPool cachedPool = _pool;

    DataTypes.ReserveData memory reserveData = cachedPool.getReserveData(input.asset);

    (, , , uint256 decimals, ) = cachedPool.getReserveConfiguration(input.asset).getParamsMemory();

    bytes memory encodedCall = abi.encodeWithSelector(
      IDebtToken.initializeAfterUpgrade.selector,
      _addressesProvider,
      input.asset,
      IIncentivesController(input.incentivesController),
      decimals,
      input.name,
      input.symbol,
      input.params
    );

    _upgradeTokenImplementation(reserveData.debtTokenAddress, input.implementation, encodedCall);

    emit DebtTokenUpgraded(input.asset, reserveData.debtTokenAddress, input.implementation);
  }

  /**
   * @dev Enables borrowing on a reserve
   * @param asset The address of the underlying asset of the reserve
   **/
  function enableBorrowingOnReserve(address asset) external onlyPoolAdmin {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getReserveConfiguration(asset);

    currentConfig.setBorrowingEnabled(true);

    _pool.setReserveConfiguration(asset, currentConfig.data);

    emit BorrowingEnabledOnReserve(asset);
  }

  /**
   * @dev Disables borrowing on a reserve
   * @param asset The address of the underlying asset of the reserve
   **/
  function disableBorrowingOnReserve(address asset) external onlyPoolAdmin {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getReserveConfiguration(asset);

    currentConfig.setBorrowingEnabled(false);

    _pool.setReserveConfiguration(asset, currentConfig.data);
    emit BorrowingDisabledOnReserve(asset);
  }

  /**
   * @dev Activates a reserve
   * @param asset The address of the underlying asset of the reserve
   **/
  function activateReserve(address asset) external onlyPoolAdmin {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getReserveConfiguration(asset);

    currentConfig.setActive(true);

    _pool.setReserveConfiguration(asset, currentConfig.data);

    emit ReserveActivated(asset);
  }

  /**
   * @dev Deactivates a reserve
   * @param asset The address of the underlying asset of the reserve
   **/
  function deactivateReserve(address asset) external onlyPoolAdmin {
    _checkReserveNoLiquidity(asset);

    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getReserveConfiguration(asset);

    currentConfig.setActive(false);

    _pool.setReserveConfiguration(asset, currentConfig.data);

    emit ReserveDeactivated(asset);
  }

  /**
   * @dev Freezes a reserve. A frozen reserve doesn't allow any new deposit, borrow or rate swap
   *  but allows repayments, liquidations, rate rebalances and withdrawals
   * @param asset The address of the underlying asset of the reserve
   **/
  function freezeReserve(address asset) external onlyPoolAdmin {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getReserveConfiguration(asset);

    currentConfig.setFrozen(true);

    _pool.setReserveConfiguration(asset, currentConfig.data);

    emit ReserveFrozen(asset);
  }

  /**
   * @dev Unfreezes a reserve
   * @param asset The address of the underlying asset of the reserve
   **/
  function unfreezeReserve(address asset) external onlyPoolAdmin {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getReserveConfiguration(asset);

    currentConfig.setFrozen(false);

    _pool.setReserveConfiguration(asset, currentConfig.data);

    emit ReserveUnfrozen(asset);
  }

  /**
   * @dev Updates the reserve factor of a reserve
   * @param asset The address of the underlying asset of the reserve
   * @param reserveFactor The new reserve factor of the reserve
   **/
  function setReserveFactor(address asset, uint256 reserveFactor) external onlyPoolAdmin {
    DataTypes.ReserveConfigurationMap memory currentConfig = _pool.getReserveConfiguration(asset);

    currentConfig.setReserveFactor(reserveFactor);

    _pool.setReserveConfiguration(asset, currentConfig.data);

    emit ReserveFactorChanged(asset, reserveFactor);
  }

  /**
   * @dev Sets the interest rate strategy of a reserve
   * @param asset The address of the underlying asset of the reserve
   * @param rateAddress The new address of the interest strategy contract
   **/
  function setReserveInterestRateAddress(address asset, address rateAddress) external onlyPoolAdmin {
    _pool.setReserveInterestRateAddress(asset, rateAddress);
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
    DataTypes.NftConfigurationMap memory currentConfig = _pool.getNftConfiguration(asset);

    //validation of the parameters: the LTV can
    //only be lower or equal than the liquidation threshold
    //(otherwise a loan against the asset would cause instantaneous liquidation)
    require(ltv <= liquidationThreshold, Errors.LPC_INVALID_CONFIGURATION);

    if (liquidationThreshold != 0) {
      //liquidation bonus must be smaller than 100.00%
      require(liquidationBonus < PercentageMath.PERCENTAGE_FACTOR, Errors.LPC_INVALID_CONFIGURATION);
    } else {
      require(liquidationBonus == 0, Errors.LPC_INVALID_CONFIGURATION);
    }

    currentConfig.setLtv(ltv);
    currentConfig.setLiquidationThreshold(liquidationThreshold);
    currentConfig.setLiquidationBonus(liquidationBonus);

    _pool.setNftConfiguration(asset, currentConfig.data);

    emit NftConfigurationChanged(asset, ltv, liquidationThreshold, liquidationBonus);
  }

  /**
   * @dev Activates a NFT
   * @param asset The address of the underlying asset of the NFT
   **/
  function activateNft(address asset) external onlyPoolAdmin {
    DataTypes.NftConfigurationMap memory currentConfig = _pool.getNftConfiguration(asset);

    currentConfig.setActive(true);

    _pool.setNftConfiguration(asset, currentConfig.data);

    emit NftActivated(asset);
  }

  /**
   * @dev Deactivates a NFT
   * @param asset The address of the underlying asset of the NFT
   **/
  function deactivateNft(address asset) external onlyPoolAdmin {
    DataTypes.NftConfigurationMap memory currentConfig = _pool.getNftConfiguration(asset);

    currentConfig.setActive(false);

    _pool.setNftConfiguration(asset, currentConfig.data);

    emit NftDeactivated(asset);
  }

  /**
   * @dev Freezes a NFT. A frozen NFT doesn't allow any new borrow
   *  but allows repayments, liquidations
   * @param asset The address of the underlying asset of the NFT
   **/
  function freezeNft(address asset) external onlyPoolAdmin {
    DataTypes.NftConfigurationMap memory currentConfig = _pool.getNftConfiguration(asset);

    currentConfig.setFrozen(true);

    _pool.setNftConfiguration(asset, currentConfig.data);

    emit NftFrozen(asset);
  }

  /**
   * @dev Unfreezes a NFT
   * @param asset The address of the underlying asset of the NFT
   **/
  function unfreezeNft(address asset) external onlyPoolAdmin {
    DataTypes.NftConfigurationMap memory currentConfig = _pool.getNftConfiguration(asset);

    currentConfig.setFrozen(false);

    _pool.setNftConfiguration(asset, currentConfig.data);

    emit NftUnfrozen(asset);
  }

  function setMaxNumberOfReserves(uint256 newVal) external onlyPoolAdmin {
    //default value is 32
    uint256 curVal = _pool.MAX_NUMBER_RESERVES();
    require(newVal > curVal, Errors.LPC_INVALID_CONFIGURATION);
    _pool.setMaxNumberOfReserves(newVal);
  }

  function setMaxNumberOfNfts(uint256 newVal) external onlyPoolAdmin {
    //default value is 256
    uint256 curVal = _pool.MAX_NUMBER_NFTS();
    require(newVal > curVal, Errors.LPC_INVALID_CONFIGURATION);
    _pool.setMaxNumberOfNfts(newVal);
  }

  /**
   * @dev pauses or unpauses all the actions of the protocol, including bToken transfers
   * @param val true if protocol needs to be paused, false otherwise
   **/
  function setPoolPause(bool val) external onlyEmergencyAdmin {
    _pool.setPause(val);
  }

  function _initTokenWithProxy(address implementation, bytes memory initParams) internal returns (address) {
    BendUpgradeableProxy proxy = new BendUpgradeableProxy(implementation, address(this), initParams);

    return address(proxy);
  }

  function _upgradeTokenImplementation(
    address proxyAddress,
    address implementation,
    bytes memory initParams
  ) internal {
    BendUpgradeableProxy proxy = BendUpgradeableProxy(payable(proxyAddress));

    proxy.upgradeToAndCall(implementation, initParams);
  }

  function _checkReserveNoLiquidity(address asset) internal view {
    DataTypes.ReserveData memory reserveData = _pool.getReserveData(asset);

    uint256 availableLiquidity = IERC20Upgradeable(asset).balanceOf(reserveData.bTokenAddress);

    require(availableLiquidity == 0 && reserveData.currentLiquidityRate == 0, Errors.LPC_RESERVE_LIQUIDITY_NOT_0);
  }
}

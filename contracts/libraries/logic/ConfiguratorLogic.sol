// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IBToken} from "../../interfaces/IBToken.sol";
import {IDebtToken} from "../../interfaces/IDebtToken.sol";
import {ILendPool} from "../../interfaces/ILendPool.sol";
import {ILendPoolAddressesProvider} from "../../interfaces/ILendPoolAddressesProvider.sol";

import {IBNFT} from "../../interfaces/IBNFT.sol";
import {IBNFTRegistry} from "../../interfaces/IBNFTRegistry.sol";

import {BendUpgradeableProxy} from "../../libraries/proxy/BendUpgradeableProxy.sol";
import {ReserveConfiguration} from "../../libraries/configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../../libraries/configuration/NftConfiguration.sol";
import {DataTypes} from "../../libraries/types/DataTypes.sol";
import {ConfigTypes} from "../../libraries/types/ConfigTypes.sol";
import {Errors} from "../../libraries/helpers/Errors.sol";
import {PercentageMath} from "../../libraries/math/PercentageMath.sol";

/**
 * @title ConfiguratorLogic library
 * @author Bend
 * @notice Implements the logic to configuration feature
 */
library ConfiguratorLogic {
  using PercentageMath for uint256;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using NftConfiguration for DataTypes.NftConfigurationMap;

  /**
   * @dev Emitted when a reserve is initialized.
   * @param asset The address of the underlying asset of the reserve
   * @param bToken The address of the associated bToken contract
   * @param debtToken The address of the associated debtToken contract
   * @param interestRateAddress The address of the interest rate strategy for the reserve
   **/
  event ReserveInitialized(
    address indexed asset,
    address indexed bToken,
    address debtToken,
    address interestRateAddress
  );

  /**
   * @dev Emitted when a reserve factor is updated
   * @param asset The address of the underlying asset of the reserve
   * @param factor The new reserve factor
   **/
  event ReserveFactorChanged(address indexed asset, uint256 factor);

  event ReserveMaxUtilizationRateChanged(address indexed asset, uint256 maxUtilRate);

  /**
   * @dev Emitted when a nft is initialized.
   * @param asset The address of the underlying asset of the nft
   * @param bNft The address of the associated bNFT contract
   **/
  event NftInitialized(address indexed asset, address indexed bNft);

  event NftConfigurationChanged(
    address indexed asset,
    uint256 ltv,
    uint256 liquidationThreshold,
    uint256 liquidationBonus
  );

  event NftAuctionChanged(address indexed asset, uint256 redeemDuration, uint256 auctionDuration, uint256 redeemFine);

  event NftRedeemThresholdChanged(address indexed asset, uint256 redeemThreshold);

  event NftMinBidFineChanged(address indexed asset, uint256 minBidFine);

  event NftMaxSupplyAndTokenIdChanged(address indexed asset, uint256 maxSupply, uint256 maxTokenId);

  event NftMaxCollateralCapChanged(address indexed asset, uint256 maxCap);

  /**
   * @dev Emitted when an bToken implementation is upgraded
   * @param asset The address of the underlying asset of the reserve
   * @param proxy The bToken proxy address
   * @param implementation The new bToken implementation
   **/
  event BTokenUpgraded(address indexed asset, address indexed proxy, address indexed implementation);

  /**
   * @dev Emitted when the implementation of a debt token is upgraded
   * @param asset The address of the underlying asset of the reserve
   * @param proxy The debt token proxy address
   * @param implementation The new debtToken implementation
   **/
  event DebtTokenUpgraded(address indexed asset, address indexed proxy, address indexed implementation);

  function executeInitReserve(
    ILendPoolAddressesProvider addressProvider,
    ILendPool cachePool,
    ConfigTypes.InitReserveInput calldata input
  ) external {
    address bTokenProxyAddress = _initTokenWithProxy(
      input.bTokenImpl,
      abi.encodeWithSelector(
        IBToken.initialize.selector,
        addressProvider,
        input.treasury,
        input.underlyingAsset,
        input.underlyingAssetDecimals,
        input.bTokenName,
        input.bTokenSymbol
      )
    );

    address debtTokenProxyAddress = _initTokenWithProxy(
      input.debtTokenImpl,
      abi.encodeWithSelector(
        IDebtToken.initialize.selector,
        addressProvider,
        input.underlyingAsset,
        input.underlyingAssetDecimals,
        input.debtTokenName,
        input.debtTokenSymbol
      )
    );

    cachePool.initReserve(input.underlyingAsset, bTokenProxyAddress, debtTokenProxyAddress, input.interestRateAddress);

    DataTypes.ReserveConfigurationMap memory currentConfig = cachePool.getReserveConfiguration(input.underlyingAsset);

    currentConfig.setDecimals(input.underlyingAssetDecimals);

    currentConfig.setActive(true);
    currentConfig.setFrozen(false);

    cachePool.setReserveConfiguration(input.underlyingAsset, currentConfig.data);

    emit ReserveInitialized(
      input.underlyingAsset,
      bTokenProxyAddress,
      debtTokenProxyAddress,
      input.interestRateAddress
    );
  }

  function executeSetReserveMaxUtilizationRate(
    ILendPool cachedPool,
    address[] calldata assets,
    uint256 maxUtilRate
  ) external {
    for (uint256 i = 0; i < assets.length; i++) {
      cachedPool.setReserveMaxUtilizationRate(assets[i], maxUtilRate);

      emit ReserveMaxUtilizationRateChanged(assets[i], maxUtilRate);
    }
  }

  function executeBatchConfigReserve(ILendPool cachedPool, ConfigTypes.ConfigReserveInput[] calldata inputs) external {
    for (uint256 i = 0; i < inputs.length; i++) {
      DataTypes.ReserveConfigurationMap memory currentConfig = cachedPool.getReserveConfiguration(inputs[i].asset);

      currentConfig.setReserveFactor(inputs[i].reserveFactor);

      cachedPool.setReserveConfiguration(inputs[i].asset, currentConfig.data);
      emit ReserveFactorChanged(inputs[i].asset, inputs[i].reserveFactor);

      cachedPool.setReserveMaxUtilizationRate(inputs[i].asset, inputs[i].maxUtilizationRate);
      emit ReserveMaxUtilizationRateChanged(inputs[i].asset, inputs[i].maxUtilizationRate);
    }
  }

  function executeInitNft(
    ILendPool pool_,
    IBNFTRegistry registry_,
    ConfigTypes.InitNftInput calldata input
  ) external {
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

  function executeBatchConfigNft(ILendPool cachedPool, ConfigTypes.ConfigNftInput[] calldata inputs) external {
    for (uint256 i = 0; i < inputs.length; i++) {
      DataTypes.NftConfigurationMap memory currentConfig = cachedPool.getNftConfiguration(inputs[i].asset);

      //validation of the parameters: the LTV can
      //only be lower or equal than the liquidation threshold
      //(otherwise a loan against the asset would cause instantaneous liquidation)
      require(inputs[i].baseLTV <= inputs[i].liquidationThreshold, Errors.LPC_INVALID_CONFIGURATION);

      if (inputs[i].liquidationThreshold != 0) {
        //liquidation bonus must be smaller than or equal 100.00%
        require(inputs[i].liquidationBonus <= PercentageMath.PERCENTAGE_FACTOR, Errors.LPC_INVALID_CONFIGURATION);
      } else {
        require(inputs[i].liquidationBonus == 0, Errors.LPC_INVALID_CONFIGURATION);
      }

      // collateral parameters
      currentConfig.setLtv(inputs[i].baseLTV);
      currentConfig.setLiquidationThreshold(inputs[i].liquidationThreshold);
      currentConfig.setLiquidationBonus(inputs[i].liquidationBonus);

      // auction parameters
      currentConfig.setRedeemDuration(inputs[i].redeemDuration);
      currentConfig.setAuctionDuration(inputs[i].auctionDuration);
      currentConfig.setRedeemFine(inputs[i].redeemFine);
      currentConfig.setRedeemThreshold(inputs[i].redeemThreshold);
      currentConfig.setMinBidFine(inputs[i].minBidFine);

      cachedPool.setNftConfiguration(inputs[i].asset, currentConfig.data);

      emit NftConfigurationChanged(
        inputs[i].asset,
        inputs[i].baseLTV,
        inputs[i].liquidationThreshold,
        inputs[i].liquidationBonus
      );
      emit NftAuctionChanged(
        inputs[i].asset,
        inputs[i].redeemDuration,
        inputs[i].auctionDuration,
        inputs[i].redeemFine
      );
      emit NftRedeemThresholdChanged(inputs[i].asset, inputs[i].redeemThreshold);
      emit NftMinBidFineChanged(inputs[i].asset, inputs[i].minBidFine);

      // max limit
      cachedPool.setNftMaxSupplyAndTokenId(inputs[i].asset, inputs[i].maxSupply, inputs[i].maxTokenId);
      emit NftMaxSupplyAndTokenIdChanged(inputs[i].asset, inputs[i].maxSupply, inputs[i].maxTokenId);

      cachedPool.setNftMaxCollateralCap(inputs[i].asset, inputs[i].maxCollateralCap);
      emit NftMaxCollateralCapChanged(inputs[i].asset, inputs[i].maxCollateralCap);
    }
  }

  function executeSetNftMaxCollateralCap(
    ILendPool cachedPool,
    address[] calldata assets,
    uint256 maxCap
  ) external {
    for (uint256 i = 0; i < assets.length; i++) {
      cachedPool.setNftMaxCollateralCap(assets[i], maxCap);

      emit NftMaxCollateralCapChanged(assets[i], maxCap);
    }
  }

  function executeUpdateBToken(ILendPool cachedPool, ConfigTypes.UpdateBTokenInput calldata input) external {
    DataTypes.ReserveData memory reserveData = cachedPool.getReserveData(input.asset);

    _upgradeTokenImplementation(reserveData.bTokenAddress, input.implementation, input.encodedCallData);

    emit BTokenUpgraded(input.asset, reserveData.bTokenAddress, input.implementation);
  }

  function executeUpdateDebtToken(ILendPool cachedPool, ConfigTypes.UpdateDebtTokenInput calldata input) external {
    DataTypes.ReserveData memory reserveData = cachedPool.getReserveData(input.asset);

    _upgradeTokenImplementation(reserveData.debtTokenAddress, input.implementation, input.encodedCallData);

    emit DebtTokenUpgraded(input.asset, reserveData.debtTokenAddress, input.implementation);
  }

  function getTokenImplementation(address proxyAddress) external view returns (address) {
    BendUpgradeableProxy proxy = BendUpgradeableProxy(payable(proxyAddress));
    return proxy.getImplementation();
  }

  function _initTokenWithProxy(address implementation, bytes memory initParams) internal returns (address) {
    BendUpgradeableProxy proxy = new BendUpgradeableProxy(implementation, address(this), initParams);

    return address(proxy);
  }

  function _upgradeTokenImplementation(
    address proxyAddress,
    address implementation,
    bytes memory encodedCallData
  ) internal {
    BendUpgradeableProxy proxy = BendUpgradeableProxy(payable(proxyAddress));

    if (encodedCallData.length > 0) {
      proxy.upgradeToAndCall(implementation, encodedCallData);
    } else {
      proxy.upgradeTo(implementation);
    }
  }
}

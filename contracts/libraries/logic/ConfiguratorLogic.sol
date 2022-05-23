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

/**
 * @title ConfiguratorLogic library
 * @author Bend
 * @notice Implements the logic to configuration feature
 */
library ConfiguratorLogic {
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
   * @dev Emitted when a nft is initialized.
   * @param asset The address of the underlying asset of the nft
   * @param bNft The address of the associated bNFT contract
   **/
  event NftInitialized(address indexed asset, address indexed bNft);

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

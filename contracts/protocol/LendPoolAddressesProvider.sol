// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

// Prettier ignore to prevent buidler flatter bug
// prettier-ignore
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {BendUpgradeableProxy} from "../libraries/proxy/BendUpgradeableProxy.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title LendPoolAddressesProvider contract
 * @dev Main registry of addresses part of or connected to the protocol, including permissioned roles
 * - Acting also as factory of proxies and admin of those, so with right to change its implementations
 * - Owned by the Bend Governance
 * @author Bend
 **/
contract LendPoolAddressesProvider is Ownable, ILendPoolAddressesProvider {
  string private _marketId;
  mapping(bytes32 => address) private _addresses;

  bytes32 private constant LEND_POOL = "LEND_POOL";
  bytes32 private constant LEND_POOL_CONFIGURATOR = "LEND_POOL_CONFIGURATOR";
  bytes32 private constant POOL_ADMIN = "POOL_ADMIN";
  bytes32 private constant EMERGENCY_ADMIN = "EMERGENCY_ADMIN";
  bytes32 private constant RESERVE_ORACLE = "RESERVE_ORACLE";
  bytes32 private constant NFT_ORACLE = "NFT_ORACLE";
  bytes32 private constant BEND_ORACLE = "BEND_ORACLE";
  bytes32 private constant LEND_POOL_LOAN = "LEND_POOL_LOAN";
  bytes32 private constant BNFT_REGISTRY = "BNFT_REGISTRY";
  bytes32 private constant LEND_POOL_LIQUIDATOR = "LEND_POOL_LIQUIDATOR";
  bytes32 private constant INCENTIVES_CONTROLLER = "INCENTIVES_CONTROLLER";
  bytes32 private constant BEND_DATA_PROVIDER = "BEND_DATA_PROVIDER";
  bytes32 private constant UI_DATA_PROVIDER = "UI_DATA_PROVIDER";
  bytes32 private constant WALLET_BALANCE_PROVIDER = "WALLET_BALANCE_PROVIDER";

  constructor(string memory marketId) {
    _setMarketId(marketId);
  }

  /**
   * @dev Returns the id of the Bend market to which this contracts points to
   * @return The market id
   **/
  function getMarketId() external view override returns (string memory) {
    return _marketId;
  }

  /**
   * @dev Allows to set the market which this LendPoolAddressesProvider represents
   * @param marketId The market id
   */
  function setMarketId(string memory marketId) external override onlyOwner {
    _setMarketId(marketId);
  }

  /**
   * @dev General function to update the implementation of a proxy registered with
   * certain `id`. If there is no proxy registered, it will instantiate one and
   * set as implementation the `implementationAddress`
   * IMPORTANT Use this function carefully, only for ids that don't have an explicit
   * setter function, in order to avoid unexpected consequences
   * @param id The id
   * @param implementationAddress The address of the new implementation
   */
  function setAddressAsProxy(
    bytes32 id,
    address implementationAddress,
    bytes memory encodedCallData
  ) external override onlyOwner {
    _updateImpl(id, implementationAddress);
    emit AddressSet(id, implementationAddress, true, encodedCallData);

    if (encodedCallData.length > 0) {
      Address.functionCall(_addresses[id], encodedCallData);
    }
  }

  /**
   * @dev Sets an address for an id replacing the address saved in the addresses map
   * IMPORTANT Use this function carefully, as it will do a hard replacement
   * @param id The id
   * @param newAddress The address to set
   */
  function setAddress(bytes32 id, address newAddress) external override onlyOwner {
    _addresses[id] = newAddress;
    emit AddressSet(id, newAddress, false, new bytes(0));
  }

  /**
   * @dev Returns an address by id
   * @return The address
   */
  function getAddress(bytes32 id) public view override returns (address) {
    return _addresses[id];
  }

  /**
   * @dev Returns the address of the LendPool proxy
   * @return The LendPool proxy address
   **/
  function getLendPool() external view override returns (address) {
    return getAddress(LEND_POOL);
  }

  /**
   * @dev Updates the implementation of the LendPool, or creates the proxy
   * setting the new `pool` implementation on the first time calling it
   * @param pool The new LendPool implementation
   **/
  function setLendPoolImpl(address pool, bytes memory encodedCallData) external override onlyOwner {
    _updateImpl(LEND_POOL, pool);
    emit LendPoolUpdated(pool, encodedCallData);

    if (encodedCallData.length > 0) {
      Address.functionCall(_addresses[LEND_POOL], encodedCallData);
    }
  }

  /**
   * @dev Returns the address of the LendPoolConfigurator proxy
   * @return The LendPoolConfigurator proxy address
   **/
  function getLendPoolConfigurator() external view override returns (address) {
    return getAddress(LEND_POOL_CONFIGURATOR);
  }

  /**
   * @dev Updates the implementation of the LendPoolConfigurator, or creates the proxy
   * setting the new `configurator` implementation on the first time calling it
   * @param configurator The new LendPoolConfigurator implementation
   **/
  function setLendPoolConfiguratorImpl(address configurator, bytes memory encodedCallData) external override onlyOwner {
    _updateImpl(LEND_POOL_CONFIGURATOR, configurator);
    emit LendPoolConfiguratorUpdated(configurator, encodedCallData);

    if (encodedCallData.length > 0) {
      Address.functionCall(_addresses[LEND_POOL_CONFIGURATOR], encodedCallData);
    }
  }

  /**
   * @dev The functions below are getters/setters of addresses that are outside the context
   * of the protocol hence the upgradable proxy pattern is not used
   **/

  function getPoolAdmin() external view override returns (address) {
    return getAddress(POOL_ADMIN);
  }

  function setPoolAdmin(address admin) external override onlyOwner {
    _addresses[POOL_ADMIN] = admin;
    emit ConfigurationAdminUpdated(admin);
  }

  function getEmergencyAdmin() external view override returns (address) {
    return getAddress(EMERGENCY_ADMIN);
  }

  function setEmergencyAdmin(address emergencyAdmin) external override onlyOwner {
    _addresses[EMERGENCY_ADMIN] = emergencyAdmin;
    emit EmergencyAdminUpdated(emergencyAdmin);
  }

  function getReserveOracle() external view override returns (address) {
    return getAddress(RESERVE_ORACLE);
  }

  function setReserveOracle(address reserveOracle) external override onlyOwner {
    _addresses[RESERVE_ORACLE] = reserveOracle;
    emit ReserveOracleUpdated(reserveOracle);
  }

  function getNFTOracle() external view override returns (address) {
    return getAddress(NFT_ORACLE);
  }

  function setNFTOracle(address nftOracle) external override onlyOwner {
    _addresses[NFT_ORACLE] = nftOracle;
    emit NftOracleUpdated(nftOracle);
  }

  function getLendPoolLoan() external view override returns (address) {
    return getAddress(LEND_POOL_LOAN);
  }

  function setLendPoolLoanImpl(address loanAddress, bytes memory encodedCallData) external override onlyOwner {
    _updateImpl(LEND_POOL_LOAN, loanAddress);
    emit LendPoolLoanUpdated(loanAddress, encodedCallData);

    if (encodedCallData.length > 0) {
      Address.functionCall(_addresses[LEND_POOL_LOAN], encodedCallData);
    }
  }

  function getBNFTRegistry() external view override returns (address) {
    return getAddress(BNFT_REGISTRY);
  }

  function setBNFTRegistry(address factory) external override onlyOwner {
    _addresses[BNFT_REGISTRY] = factory;
    emit BNFTRegistryUpdated(factory);
  }

  function getIncentivesController() external view override returns (address) {
    return getAddress(INCENTIVES_CONTROLLER);
  }

  function setIncentivesController(address controller) external override onlyOwner {
    _addresses[INCENTIVES_CONTROLLER] = controller;
    emit IncentivesControllerUpdated(controller);
  }

  function getUIDataProvider() external view override returns (address) {
    return getAddress(UI_DATA_PROVIDER);
  }

  function setUIDataProvider(address provider) external override onlyOwner {
    _addresses[UI_DATA_PROVIDER] = provider;
    emit UIDataProviderUpdated(provider);
  }

  function getBendDataProvider() external view override returns (address) {
    return getAddress(BEND_DATA_PROVIDER);
  }

  function setBendDataProvider(address provider) external override onlyOwner {
    _addresses[BEND_DATA_PROVIDER] = provider;
    emit BendDataProviderUpdated(provider);
  }

  function getWalletBalanceProvider() external view override returns (address) {
    return getAddress(WALLET_BALANCE_PROVIDER);
  }

  function setWalletBalanceProvider(address provider) external override onlyOwner {
    _addresses[WALLET_BALANCE_PROVIDER] = provider;
    emit WalletBalanceProviderUpdated(provider);
  }

  function getImplementation(address proxyAddress) external view onlyOwner returns (address) {
    BendUpgradeableProxy proxy = BendUpgradeableProxy(payable(proxyAddress));
    return proxy.getImplementation();
  }

  /**
   * @dev Internal function to update the implementation of a specific proxied component of the protocol
   * - If there is no proxy registered in the given `id`, it creates the proxy setting `newAdress`
   *   as implementation and calls the initialize() function on the proxy
   * - If there is already a proxy registered, it just updates the implementation to `newAddress` and
   *   calls the encoded method function via upgradeToAndCall() in the proxy
   * @param id The id of the proxy to be updated
   * @param newAddress The address of the new implementation
   **/
  function _updateImpl(bytes32 id, address newAddress) internal {
    address payable proxyAddress = payable(_addresses[id]);

    if (proxyAddress == address(0)) {
      bytes memory params = abi.encodeWithSignature("initialize(address)", address(this));

      // create proxy, then init proxy & implementation
      BendUpgradeableProxy proxy = new BendUpgradeableProxy(newAddress, address(this), params);

      _addresses[id] = address(proxy);
      emit ProxyCreated(id, address(proxy));
    } else {
      // upgrade implementation
      BendUpgradeableProxy proxy = BendUpgradeableProxy(proxyAddress);

      proxy.upgradeTo(newAddress);
    }
  }

  function _setMarketId(string memory marketId) internal {
    _marketId = marketId;
    emit MarketIdSet(marketId);
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

// Prettier ignore to prevent buidler flatter bug
// prettier-ignore
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {InitializableImmutableAdminUpgradeabilityProxy} from "../libraries/upgradeability/InitializableImmutableAdminUpgradeabilityProxy.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LendingPoolAddressesProvider contract
 * @dev Main registry of addresses part of or connected to the protocol, including permissioned roles
 * - Acting also as factory of proxies and admin of those, so with right to change its implementations
 * - Owned by the NFTLend Governance
 * @author NFTLend
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
    bytes32 private constant NFT_LOAN = "NFT_LOAN";

    constructor(string memory marketId) {
        _setMarketId(marketId);
    }

    /**
     * @dev Returns the id of the Aave market to which this contracts points to
     * @return The market id
     **/
    function getMarketId() external view override returns (string memory) {
        return _marketId;
    }

    /**
     * @dev Allows to set the market which this LendingPoolAddressesProvider represents
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
    function setAddressAsProxy(bytes32 id, address implementationAddress)
        external
        override
        onlyOwner
    {
        _updateImpl(id, implementationAddress);
        emit AddressSet(id, implementationAddress, true);
    }

    /**
     * @dev Sets an address for an id replacing the address saved in the addresses map
     * IMPORTANT Use this function carefully, as it will do a hard replacement
     * @param id The id
     * @param newAddress The address to set
     */
    function setAddress(bytes32 id, address newAddress)
        external
        override
        onlyOwner
    {
        _addresses[id] = newAddress;
        emit AddressSet(id, newAddress, false);
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
    function setLendPoolImpl(address pool) external override onlyOwner {
        _updateImpl(LEND_POOL, pool);
        emit LendPoolUpdated(pool);
    }

    /**
     * @dev Returns the address of the LendPoolConfigurator proxy
     * @return The LendPoolConfigurator proxy address
     **/
    function getLendPoolConfigurator()
        external
        view
        override
        returns (address)
    {
        return getAddress(LEND_POOL_CONFIGURATOR);
    }

    /**
     * @dev Updates the implementation of the LendPoolConfigurator, or creates the proxy
     * setting the new `configurator` implementation on the first time calling it
     * @param configurator The new LendPoolConfigurator implementation
     **/
    function setLendPoolConfiguratorImpl(address configurator)
        external
        override
        onlyOwner
    {
        _updateImpl(LEND_POOL_CONFIGURATOR, configurator);
        emit LendPoolConfiguratorUpdated(configurator);
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

    function setEmergencyAdmin(address emergencyAdmin)
        external
        override
        onlyOwner
    {
        _addresses[EMERGENCY_ADMIN] = emergencyAdmin;
        emit EmergencyAdminUpdated(emergencyAdmin);
    }

    function getReserveOracle() external view override returns (address) {
        return getAddress(RESERVE_ORACLE);
    }

    function setReserveOracle(address reserveOracle)
        external
        override
        onlyOwner
    {
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
        return getAddress(NFT_LOAN);
    }

    function setLendPoolLoan(address loanAddress) external override {
        _addresses[NFT_LOAN] = loanAddress;
        emit LendPoolLoanUpdated(loanAddress);
    }

    /**
     * @dev Internal function to update the implementation of a specific proxied component of the protocol
     * - If there is no proxy registered in the given `id`, it creates the proxy setting `newAdress`
     *   as implementation and calls the initialize() function on the proxy
     * - If there is already a proxy registered, it just updates the implementation to `newAddress` and
     *   calls the initialize() function via upgradeToAndCall() in the proxy
     * @param id The id of the proxy to be updated
     * @param newAddress The address of the new implementation
     **/
    function _updateImpl(bytes32 id, address newAddress) internal {
        address payable proxyAddress = payable(_addresses[id]);

        bytes memory params = abi.encodeWithSignature(
            "initialize(address)",
            address(this)
        );

        if (proxyAddress == address(0)) {
            InitializableImmutableAdminUpgradeabilityProxy proxy = new InitializableImmutableAdminUpgradeabilityProxy(
                    address(this)
                );

            proxy.initialize(newAddress, params);

            _addresses[id] = address(proxy);
            emit ProxyCreated(id, address(proxy));
        } else {
            InitializableImmutableAdminUpgradeabilityProxy proxy = InitializableImmutableAdminUpgradeabilityProxy(
                    proxyAddress
                );

            proxy.upgradeToAndCall(newAddress, params);
        }
    }

    function _setMarketId(string memory marketId) internal {
        _marketId = marketId;
        emit MarketIdSet(marketId);
    }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title LendPoolAddressesProvider contract
 * @dev Main registry of addresses part of or connected to the protocol, including permissioned roles
 * - Acting also as factory of proxies and admin of those, so with right to change its implementations
 * - Owned by the Aave Governance
 * @author NFTLend
 **/
interface ILendPoolAddressesProvider {
    event MarketIdSet(string newMarketId);
    event LendPoolUpdated(address indexed newAddress);
    event ConfigurationAdminUpdated(address indexed newAddress);
    event EmergencyAdminUpdated(address indexed newAddress);
    event LendPoolConfiguratorUpdated(address indexed newAddress);
    event BendOracleUpdated(address indexed newAddress);
    event ReserveOracleUpdated(address indexed newAddress);
    event NftOracleUpdated(address indexed newAddress);
    event LendPoolLoanUpdated(address indexed newAddress);
    event ProxyCreated(bytes32 id, address indexed newAddress);
    event AddressSet(bytes32 id, address indexed newAddress, bool hasProxy);
    event BNFTRegistryUpdated(address indexed newAddress);

    function getMarketId() external view returns (string memory);

    function setMarketId(string calldata marketId) external;

    function setAddress(bytes32 id, address newAddress) external;

    function setAddressAsProxy(bytes32 id, address impl) external;

    function getAddress(bytes32 id) external view returns (address);

    function getLendPool() external view returns (address);

    function setLendPoolImpl(address pool) external;

    function getLendPoolConfigurator() external view returns (address);

    function setLendPoolConfiguratorImpl(address configurator) external;

    function getPoolAdmin() external view returns (address);

    function setPoolAdmin(address admin) external;

    function getEmergencyAdmin() external view returns (address);

    function setEmergencyAdmin(address admin) external;

    function getBendOracle() external view returns (address);

    function setBendOracle(address bendOracle) external;

    function getReserveOracle() external view returns (address);

    function setReserveOracle(address reserveOracle) external;

    function getNFTOracle() external view returns (address);

    function setNFTOracle(address nftOracle) external;

    function getLendPoolLoan() external view returns (address);

    function setLendPoolLoanImpl(address loan) external;

    function getBNFTRegistry() external view returns (address);

    function setBNFTRegistry(address factory) external;
}

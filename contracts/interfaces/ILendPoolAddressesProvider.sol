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
    event LendPoolCollateralManagerUpdated(address indexed newAddress);
    event ReserveOracleUpdated(address indexed newAddress);
    event NftOracleUpdated(address indexed newAddress);
    event NftLoanUpdated(address indexed newAddress);
    event ProxyCreated(bytes32 id, address indexed newAddress);
    event AddressSet(bytes32 id, address indexed newAddress, bool hasProxy);

    function getMarketId() external view returns (string memory);

    function setMarketId(string calldata marketId) external;

    function setAddress(bytes32 id, address newAddress) external;

    function setAddressAsProxy(bytes32 id, address impl) external;

    function getAddress(bytes32 id) external view returns (address);

    function getLendPool() external view returns (address);

    function setLendPoolImpl(address pool) external;

    function getLendPoolConfigurator() external view returns (address);

    function setLendPoolConfiguratorImpl(address configurator) external;

    function getLendPoolCollateralManager() external view returns (address);

    function setLendPoolCollateralManager(address manager) external;

    function getPoolAdmin() external view returns (address);

    function setPoolAdmin(address admin) external;

    function getEmergencyAdmin() external view returns (address);

    function setEmergencyAdmin(address admin) external;

    function getReserveOracle() external view returns (address);

    function setReserveOracle(address reserveOracle) external;

    function getNftOracle() external view returns (address);

    function setNftOracle(address nftOracle) external;

    function getNftLoan() external view returns (address);

    function setNftLoan(address nftLoan) external;
}

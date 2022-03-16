// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

/**
 * @title ILendPoolAddressesProviderRegistry contract
 * @dev Main registry of LendPoolAddressesProvider of multiple Bend protocol's markets
 * - Used for indexing purposes of Bend protocol's markets
 * - The id assigned to a LendPoolAddressesProvider refers to the market it is connected with,
 *   for example with `1` for the Bend main market and `2` for the next created
 * @author Bend
 **/
interface ILendPoolAddressesProviderRegistry {
  event AddressesProviderRegistered(address indexed newAddress);
  event AddressesProviderUnregistered(address indexed newAddress);

  function getAddressesProvidersList() external view returns (address[] memory);

  function getAddressesProviderIdByAddress(address addressesProvider) external view returns (uint256);

  function registerAddressesProvider(address provider, uint256 id) external;

  function unregisterAddressesProvider(address provider) external;
}

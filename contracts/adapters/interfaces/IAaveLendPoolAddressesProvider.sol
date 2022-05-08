// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

/**
 * @title IAaveLendPoolAddressesProvider contract
 * @dev Main registry of addresses part of or connected to the aave protocol, including permissioned roles
 * - Acting also as factory of proxies and admin of those, so with right to change its implementations
 * - Owned by the Aave Governance
 * @author Bend
 **/
interface IAaveLendPoolAddressesProvider {
  function getLendingPool() external view returns (address);
}

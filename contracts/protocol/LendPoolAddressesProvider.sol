// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";

/**
 * @title LendPoolAddressesProvider contract
 * @dev Main registry of addresses part of or connected to the protocol, including permissioned roles
 * - Acting also as factory of proxies and admin of those, so with right to change its implementations
 * - Owned by the Aave Governance
 * @author NFTLend
 **/
abstract contract LendPoolAddressesProvider is ILendPoolAddressesProvider {

}

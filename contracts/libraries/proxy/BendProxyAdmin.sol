// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {InitializableAdminProxy} from "./InitializableAdminProxy.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev This is an auxiliary contract meant to be assigned as the admin of a {InitializableAdminProxy}.
 */
contract BendProxyAdmin is Ownable {
  /**
   * @dev Returns the current implementation of `proxy`.
   *
   * Requirements:
   *
   * - This contract must be the admin of `proxy`.
   */
  function getProxyImplementation(InitializableAdminProxy proxy) public view virtual returns (address) {
    // We need to manually run the static call since the getter cannot be flagged as view
    // bytes4(keccak256("implementation()")) == 0x5c60da1b
    (bool success, bytes memory returndata) = address(proxy).staticcall(hex"5c60da1b");
    require(success);
    return abi.decode(returndata, (address));
  }

  /**
   * @dev Returns the current admin of `proxy`.
   *
   * Requirements:
   *
   * - This contract must be the admin of `proxy`.
   */
  function getProxyAdmin(InitializableAdminProxy proxy) public view virtual returns (address) {
    // We need to manually run the static call since the getter cannot be flagged as view
    // bytes4(keccak256("admin()")) == 0xf851a440
    (bool success, bytes memory returndata) = address(proxy).staticcall(hex"f851a440");
    require(success);
    return abi.decode(returndata, (address));
  }

  /**
   * @dev Changes the admin of `proxy` to `newAdmin`.
   *
   * Requirements:
   *
   * - This contract must be the current admin of `proxy`.
   */
  function changeProxyAdmin(InitializableAdminProxy proxy, address newAdmin) public virtual onlyOwner {
    proxy.changeAdmin(newAdmin);
  }

  /**
   * @dev Upgrades `proxy` to `implementation`. See {InitializableAdminProxy-upgradeTo}.
   *
   * Requirements:
   *
   * - This contract must be the admin of `proxy`.
   */
  function upgrade(InitializableAdminProxy proxy, address implementation) public virtual onlyOwner {
    proxy.upgradeTo(implementation);
  }

  /**
   * @dev Upgrades `proxy` to `implementation` and calls a function on the new implementation. See
   * {InitializableAdminProxy-upgradeToAndCall}.
   *
   * Requirements:
   *
   * - This contract must be the admin of `proxy`.
   */
  function upgradeAndCall(
    InitializableAdminProxy proxy,
    address implementation,
    bytes memory data
  ) public payable virtual onlyOwner {
    proxy.upgradeToAndCall{value: msg.value}(implementation, data);
  }
}

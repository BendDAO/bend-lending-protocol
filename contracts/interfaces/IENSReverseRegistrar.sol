// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface IENSReverseRegistrar {
  /**
   * @dev Sets the `name()` record for the reverse ENS record associated with
   * the calling account. First updates the resolver to the default reverse
   * resolver if necessary.
   * @param name The name to set for this address.
   * @return The ENS node hash of the reverse record.
   */
  function setName(string memory name) external returns (bytes32);
}

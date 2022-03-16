// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

contract UserProxy {
  address private immutable _owner;

  /**
   * @dev Initializes the contract settings
   */
  constructor() {
    _owner = msg.sender;
  }

  /**
   * @dev Transfers punk to the smart contract owner
   */
  function transfer(address punkContract, uint256 punkIndex) external returns (bool) {
    if (_owner != msg.sender) {
      return false;
    }

    (bool result, ) = punkContract.call(abi.encodeWithSignature("transferPunk(address,uint256)", _owner, punkIndex));

    return result;
  }
}

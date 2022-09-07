// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

contract LendPoolStorageExt {
  // !!! Add new variable MUST append it only, do not insert, update type & name, or change order !!!
  // https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#potentially-unsafe-operations

  uint256 internal constant _NOT_ENTERED = 0;
  uint256 internal constant _ENTERED = 1;
  uint256 internal _status;

  uint256 internal _pauseStartTime;
  uint256 internal _pauseDurationTime;

  // keccak256(abi.encodePacked(nftAsset, nftTokenId))
  mapping(bytes32 => address) internal _nftItemEscrowAccounts;
  address internal _auctionEscrowVaultImpl;

  // For upgradable, add one new variable above, minus 1 at here
  uint256[46] private __gap;
}

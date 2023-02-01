// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../libraries/utils/BitMaps.sol";
import "../interfaces/INFTLevelAsset.sol";

contract NFTLevelAsset is INFTLevelAsset, OwnableUpgradeable {
  struct KeyEntry {
    uint256 key;
    uint256 value;
  }
  using BitMaps for BitMaps.BitMap;

  //////////////////////////////////////////////////////////////////////////////
  // !!! Add new variable MUST append it only, do not insert, update type & name, or change order !!!
  // https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable#potentially-unsafe-operations
  address public override nftContract;
  bytes32 public override nftLevelKey;
  BitMaps.BitMap private _bitmap;

  // For upgradable, add one new variable above, minus 1 at here
  uint256[47] private __gap;

  //////////////////////////////////////////////////////////////////////////////

  function initialize(
    address nftContract_,
    bytes32 nftLevelKey_,
    uint256[] memory data_
  ) public initializer {
    __Ownable_init();

    nftContract = nftContract_;
    nftLevelKey = nftLevelKey_;

    _bitmap.init(data_);
  }

  function isValid(uint256 tokenId) external view override returns (bool) {
    return _bitmap.get(tokenId);
  }

  function setBitMapValues(KeyEntry[] calldata entries) external onlyOwner {
    for (uint256 i = 0; i < entries.length; i++) {
      KeyEntry memory entry = entries[i];
      _bitmap.setValue(entry.key, entry.value);
    }
  }

  function setBitMapValue(uint256 key, uint256 value) external onlyOwner {
    _bitmap.setValue(key, value);
  }

  function enableTokenIds(uint256[] calldata tokenIds) external onlyOwner {
    for (uint256 i = 0; i < tokenIds.length; i++) {
      _bitmap.set(tokenIds[i]);
    }
  }

  function disableTokenIds(uint256[] calldata tokenIds) external onlyOwner {
    for (uint256 i = 0; i < tokenIds.length; i++) {
      _bitmap.unset(tokenIds[i]);
    }
  }

  function viewBitMapValue(uint256 key) external view returns (uint256) {
    return _bitmap.getValue(key);
  }

  function viewBitmapKeys(uint256 cursor, uint256 size) external view returns (uint256[] memory, uint256) {
    return _bitmap.viewKeys(cursor, size);
  }

  function viewBitMapKeyCount() external view returns (uint256) {
    return _bitmap.getKeyCount();
  }
}

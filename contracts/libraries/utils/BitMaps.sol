// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (utils/structs/BitMaps.sol)
pragma solidity 0.8.4;

/**
 * @dev Library for managing uint256 to bool mapping in a compact and efficient way, providing the keys are sequential.
 * Largely inspired by Uniswap's https://github.com/Uniswap/merkle-distributor/blob/master/contracts/MerkleDistributor.sol[merkle-distributor].
 */

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

library BitMaps {
  using EnumerableSet for EnumerableSet.UintSet;
  struct BitMap {
    EnumerableSet.UintSet _keys;
    mapping(uint256 => uint256) _data;
  }

  /**
   * @dev Returns whether the bit at `index` is set.
   */
  function get(BitMap storage bitmap, uint256 index) internal view returns (bool) {
    uint256 bucket = index >> 8;
    uint256 mask = 1 << (index & 0xff);
    return bitmap._data[bucket] & mask != 0;
  }

  /**
   * @dev Sets the bit at `index` to the boolean `value`.
   */
  function setTo(
    BitMap storage bitmap,
    uint256 index,
    bool value
  ) internal {
    if (value) {
      set(bitmap, index);
    } else {
      unset(bitmap, index);
    }
  }

  /**
   * @dev Sets the bit at `index`.
   */
  function set(BitMap storage bitmap, uint256 index) internal {
    uint256 bucket = index >> 8;
    uint256 mask = 1 << (index & 0xff);
    bitmap._data[bucket] |= mask;
    bitmap._keys.add(bucket);
  }

  /**
   * @dev Unsets the bit at `index`.
   */
  function unset(BitMap storage bitmap, uint256 index) internal {
    uint256 bucket = index >> 8;
    uint256 mask = 1 << (index & 0xff);
    bitmap._data[bucket] &= ~mask;
  }

  function init(BitMap storage bitmap, uint256[] memory values) internal {
    for (uint256 i = 0; i < values.length; i++) {
      uint256 key = i;
      bitmap._data[key] = values[i];
      bitmap._keys.add(key);
    }
  }

  function setValue(
    BitMap storage bitmap,
    uint256 key,
    uint256 value
  ) internal {
    bitmap._data[key] = value;
    bitmap._keys.add(key);
  }

  function getValue(BitMap storage bitmap, uint256 key) internal view returns (uint256) {
    return bitmap._data[key];
  }

  function getKeyCount(BitMap storage bitmap) internal view returns (uint256) {
    return bitmap._keys.length();
  }

  function viewKeys(
    BitMap storage bitmap,
    uint256 cursor,
    uint256 size
  ) internal view returns (uint256[] memory, uint256) {
    uint256 length = size;
    if (length > bitmap._keys.length() - cursor) {
      length = bitmap._keys.length() - cursor;
    }
    uint256[] memory result = new uint256[](length);

    for (uint256 i = 0; i < length; i++) {
      result[i] = bitmap._keys.at(cursor + i);
    }
    return (result, cursor + length);
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface IOpenseaExchage {
  function atomicMatch_(
    address[14] memory addrs,
    uint256[18] memory uints,
    uint8[8] memory feeMethodsSidesKindsHowToCalls,
    bytes memory calldataBuy,
    bytes memory calldataSell,
    bytes memory replacementPatternBuy,
    bytes memory replacementPatternSell,
    bytes memory staticExtradataBuy,
    bytes memory staticExtradataSell,
    uint8[2] memory vs,
    bytes32[5] memory rssMetadata
  ) external payable;
}

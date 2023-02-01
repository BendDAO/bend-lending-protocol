// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface INFTLevelAsset {
  function nftContract() external view returns (address);

  function nftLevelKey() external view returns (bytes32);

  function isValid(uint256 tokenId) external view returns (bool);
}

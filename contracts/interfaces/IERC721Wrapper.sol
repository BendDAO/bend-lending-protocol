// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";

interface IERC721Wrapper is IERC721MetadataUpgradeable {
  function mint(uint256 tokenId) external;

  function burn(uint256 tokenId) external;
}

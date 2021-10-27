// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';

/**
 * @title MintableERC721
 * @dev ERC721 minting logic
 */
contract MintableERC721 is ERC721 {
  constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

  /**
   * @dev Function to mint tokens
   * @param tokenId The id of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(uint256 tokenId) public returns (bool) {
    _mint(_msgSender(), tokenId);
    return true;
  }
}

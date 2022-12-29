// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/**
 * @title MintableERC1155
 * @dev ERC1155 minting logic
 */
contract MintableERC1155 is Ownable, ERC1155 {
  mapping(address => mapping(uint256 => uint256)) public mintCounts;

  constructor() ERC1155("https://MintableERC1155/") {}

  /**
   * @dev Function to mint tokens
   * @param id The id of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(uint256 id, uint256 amount) public returns (bool) {
    require(id > 0, "id is zero");
    require(id <= 100, "exceed id limit");

    mintCounts[_msgSender()][id] += amount;
    require(mintCounts[_msgSender()][id] <= 10, "exceed mint limit");

    _mint(_msgSender(), id, amount, new bytes(0));
    return true;
  }

  function privateMint(uint256 id, uint256 amount) public onlyOwner returns (bool) {
    _mint(_msgSender(), id, amount, new bytes(0));
    return true;
  }

  function setURI(string memory uri_) public onlyOwner {
    _setURI(uri_);
  }
}

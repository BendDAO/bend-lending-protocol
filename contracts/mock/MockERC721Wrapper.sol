// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract MockerERC721Wrapper is ERC721Enumerable, ERC721Holder {
  string public baseURI;
  IERC721 public underlyingToken;

  constructor(
    address underlyingToken_,
    string memory name,
    string memory symbol
  ) ERC721(name, symbol) {
    baseURI = "https://MintableERC721/";

    underlyingToken = IERC721(underlyingToken_);
  }

  function mint(uint256 tokenId) public {
    require(underlyingToken.ownerOf(tokenId) == _msgSender(), "MockerERC721Wrapper: caller not owner");

    underlyingToken.safeTransferFrom(_msgSender(), address(this), tokenId);

    _mint(_msgSender(), tokenId);
  }

  function burn(uint256 tokenId) public {
    require(ownerOf(tokenId) == _msgSender(), "MockerERC721Wrapper: caller not owner");

    _burn(tokenId);

    underlyingToken.safeTransferFrom(address(this), _msgSender(), tokenId);
  }

  function _baseURI() internal view virtual override returns (string memory) {
    return baseURI;
  }

  function setBaseURI(string memory baseURI_) public {
    baseURI = baseURI_;
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IBNFT} from "../interfaces/IBNFT.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract MockBNFTMinter {
  address private _bnftAddress;
  address private _nftAddress;

  constructor(address nftAddress_, address bnftAddress_) {
    _bnftAddress = bnftAddress_;
    _nftAddress = nftAddress_;

    IERC721(_nftAddress).setApprovalForAll(_bnftAddress, true);
  }

  function mint(address to, uint256 tokenId) public {
    IBNFT(_bnftAddress).mint(to, tokenId);
  }

  function burn(uint256 tokenId) public {
    IBNFT(_bnftAddress).burn(tokenId);
  }
}

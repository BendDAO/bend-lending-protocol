// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "../interfaces/IBNFT.sol";
import "../interfaces/IBNFTInterceptor.sol";
import "../interfaces/ILendPoolLoan.sol";

contract MockTokenInterceptor is IBNFTInterceptor {
  ILendPoolLoan public poolLoan;

  constructor(address poolLoan_) {
    poolLoan = ILendPoolLoan(poolLoan_);
  }

  function addTokenInterceptor(address bNftAddress, uint256 tokenId) public {
    poolLoan.addTokenInterceptor(bNftAddress, tokenId);
  }

  function deleteTokenInterceptor(address bNftAddress, uint256 tokenId) public {
    poolLoan.deleteTokenInterceptor(bNftAddress, tokenId);
  }

  function preHandleMint(address nftAsset, uint256 nftTokenId) public pure override returns (bool) {
    nftAsset;
    nftTokenId;
    return true;
  }

  function preHandleBurn(address nftAsset, uint256 nftTokenId) public pure override returns (bool) {
    nftAsset;
    nftTokenId;
    return true;
  }
}

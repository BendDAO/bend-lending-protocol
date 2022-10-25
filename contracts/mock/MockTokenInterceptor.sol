// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "../interfaces/IBNFT.sol";
import "../interfaces/IBNFTRegistry.sol";
import "../interfaces/IBNFTBurnInterceptor.sol";
import "../interfaces/ILendPoolLoan.sol";
import "../interfaces/ILendPoolAddressesProvider.sol";

contract MockTokenInterceptor is IBNFTBurnInterceptor {
  ILendPoolAddressesProvider public addressProvider;

  bool public isBeforeTokenBurnCalled;
  bool public isAfterTokenBurnCalled;

  event BeforeTokenBurn(address indexed nftAsset, uint256 nftTokenId);
  event AfterTokenBurn(address indexed nftAsset, uint256 nftTokenId);

  constructor(address addressProvider_) {
    addressProvider = ILendPoolAddressesProvider(addressProvider_);
  }

  function addTokenBurnInterceptor(address bNftAddress, uint256 tokenId) public {
    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());
    poolLoan.addTokenBurnInterceptor(bNftAddress, tokenId);
  }

  function deleteTokenBurnInterceptor(address bNftAddress, uint256 tokenId) public {
    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());
    poolLoan.deleteTokenBurnInterceptor(bNftAddress, tokenId);
  }

  function resetCallState() public {
    isBeforeTokenBurnCalled = false;
    isAfterTokenBurnCalled = false;
  }

  function beforeTokenBurn(address nftAsset, uint256 nftTokenId) public override returns (bool) {
    nftAsset;
    nftTokenId;
    isBeforeTokenBurnCalled = true;
    emit BeforeTokenBurn(nftAsset, nftTokenId);
    return true;
  }

  function afterTokenBurn(address nftAsset, uint256 nftTokenId) public override returns (bool) {
    nftAsset;
    nftTokenId;
    isAfterTokenBurnCalled = true;
    emit AfterTokenBurn(nftAsset, nftTokenId);
    return true;
  }
}

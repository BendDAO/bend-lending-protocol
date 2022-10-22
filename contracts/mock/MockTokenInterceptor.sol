// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "../interfaces/IBNFT.sol";
import "../interfaces/IBNFTRegistry.sol";
import "../interfaces/IBNFTInterceptor.sol";
import "../interfaces/ILendPoolLoan.sol";
import "../interfaces/ILendPoolAddressesProvider.sol";

contract MockTokenInterceptor is IBNFTInterceptor {
  ILendPoolAddressesProvider public addressProvider;

  bool public isPreHandleMintCalled;
  bool public isPreHandleBurnCalled;

  event PreHandleMint(address indexed nftAsset, uint256 nftTokenId);
  event PreHandleBurn(address indexed nftAsset, uint256 nftTokenId);

  constructor(address addressProvider_) {
    addressProvider = ILendPoolAddressesProvider(addressProvider_);
  }

  function addTokenInterceptor(address bNftAddress, uint256 tokenId) public {
    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());
    poolLoan.addTokenInterceptor(bNftAddress, tokenId);
  }

  function deleteTokenInterceptor(address bNftAddress, uint256 tokenId) public {
    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());
    poolLoan.deleteTokenInterceptor(bNftAddress, tokenId);
  }

  function preHandleMint(address nftAsset, uint256 nftTokenId) public override returns (bool) {
    nftAsset;
    nftTokenId;

    IBNFTRegistry bnftRegistry = IBNFTRegistry(addressProvider.getBNFTRegistry());
    (address bnftProxy, ) = bnftRegistry.getBNFTAddresses(nftAsset);
    require(bnftProxy == msg.sender, "caller not bnft");

    isPreHandleMintCalled = true;
    emit PreHandleMint(nftAsset, nftTokenId);
    return true;
  }

  function preHandleBurn(address nftAsset, uint256 nftTokenId) public override returns (bool) {
    nftAsset;
    nftTokenId;

    IBNFTRegistry bnftRegistry = IBNFTRegistry(addressProvider.getBNFTRegistry());
    (address bnftProxy, ) = bnftRegistry.getBNFTAddresses(nftAsset);
    require(bnftProxy == msg.sender, "caller not bnft");

    isPreHandleBurnCalled = true;
    emit PreHandleBurn(nftAsset, nftTokenId);
    return true;
  }

  function resetCallState() public {
    isPreHandleMintCalled = false;
    isPreHandleBurnCalled = false;
  }
}

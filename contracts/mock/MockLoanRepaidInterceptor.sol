// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import "../interfaces/IBNFT.sol";
import "../interfaces/IBNFTRegistry.sol";
import "../interfaces/ILendPoolLoan.sol";
import "../interfaces/ILoanRepaidInterceptor.sol";
import "../interfaces/ILendPoolAddressesProvider.sol";

contract MockLoanRepaidInterceptor is ILoanRepaidInterceptor {
  ILendPoolAddressesProvider public addressProvider;

  bool public isBeforeHookCalled;
  bool public isAfterHookCalled;

  event BeforeHookCalled(address indexed nftAsset, uint256 nftTokenId);
  event AfterHookCalled(address indexed nftAsset, uint256 nftTokenId);

  constructor(address addressProvider_) {
    addressProvider = ILendPoolAddressesProvider(addressProvider_);
  }

  function addLoanRepaidInterceptor(address nftAddress, uint256 tokenId) public {
    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());
    poolLoan.addLoanRepaidInterceptor(nftAddress, tokenId);
  }

  function deleteLoanRepaidInterceptor(address nftAddress, uint256 tokenId) public {
    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());
    poolLoan.deleteLoanRepaidInterceptor(nftAddress, tokenId);
  }

  function setFlashLoanLocking(
    address nftAddress,
    uint256 tokenId,
    bool locked
  ) public {
    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());
    poolLoan.setFlashLoanLocking(nftAddress, tokenId, locked);
  }

  function resetCallState() public {
    isBeforeHookCalled = false;
    isAfterHookCalled = false;
  }

  function beforeLoanRepaid(address nftAsset, uint256 nftTokenId) public override returns (bool) {
    nftAsset;
    nftTokenId;
    isBeforeHookCalled = true;
    emit BeforeHookCalled(nftAsset, nftTokenId);
    return true;
  }

  function afterLoanRepaid(address nftAsset, uint256 nftTokenId) public override returns (bool) {
    nftAsset;
    nftTokenId;
    isAfterHookCalled = true;

    ILendPoolLoan poolLoan = ILendPoolLoan(addressProvider.getLendPoolLoan());

    if (poolLoan.isFlashLoanLockerApproved(address(this))) {
      poolLoan.setFlashLoanLocking(nftAsset, nftTokenId, false);
    }

    if (poolLoan.isLoanRepaidInterceptorApproved(address(this))) {
      poolLoan.deleteLoanRepaidInterceptor(nftAsset, nftTokenId);
    }

    emit AfterHookCalled(nftAsset, nftTokenId);
    return true;
  }
}

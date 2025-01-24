// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {Errors} from "../libraries/helpers/Errors.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IWrapperGateway} from "../interfaces/IWrapperGateway.sol";
import {IERC721Wrapper} from "../interfaces/IERC721Wrapper.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {IWETHGateway} from "../interfaces/IWETHGateway.sol";

import {EmergencyTokenRecoveryUpgradeable} from "./EmergencyTokenRecoveryUpgradeable.sol";

contract WrapperGateway is
  IWrapperGateway,
  ReentrancyGuardUpgradeable,
  ERC721HolderUpgradeable,
  EmergencyTokenRecoveryUpgradeable
{
  using SafeERC20Upgradeable for IERC20Upgradeable;

  ILendPoolAddressesProvider public addressProvider;
  IWETHGateway public wethGateway;

  IERC721Upgradeable public underlyingToken;
  IERC721Wrapper public wrappedToken;

  mapping(address => bool) internal _callerWhitelists;

  function initialize(
    address addressProvider_,
    address wethGateway_,
    address underlyingToken_,
    address wrappedToken_
  ) public initializer {
    __ReentrancyGuard_init();
    __ERC721Holder_init();
    __EmergencyTokenRecovery_init();

    addressProvider = ILendPoolAddressesProvider(addressProvider_);
    wethGateway = IWETHGateway(wethGateway_);

    underlyingToken = IERC721Upgradeable(underlyingToken_);
    wrappedToken = IERC721Wrapper(wrappedToken_);

    underlyingToken.setApprovalForAll(address(wrappedToken), true);

    wrappedToken.setApprovalForAll(address(_getLendPool()), true);
    wrappedToken.setApprovalForAll(address(wethGateway), true);
  }

  function _getLendPool() internal view returns (ILendPool) {
    return ILendPool(addressProvider.getLendPool());
  }

  function _getLendPoolLoan() internal view returns (ILendPoolLoan) {
    return ILendPoolLoan(addressProvider.getLendPoolLoan());
  }

  function authorizeLendPoolERC20(address[] calldata tokens) external nonReentrant onlyOwner {
    for (uint256 i = 0; i < tokens.length; i++) {
      IERC20Upgradeable(tokens[i]).safeApprove(address(_getLendPool()), type(uint256).max);
    }
  }

  function authorizeCallerWhitelist(address[] calldata callers, bool flag) external nonReentrant onlyOwner {
    for (uint256 i = 0; i < callers.length; i++) {
      _callerWhitelists[callers[i]] = flag;
    }
  }

  function isCallerInWhitelist(address caller) external view returns (bool) {
    return _callerWhitelists[caller];
  }

  function _checkValidCallerAndOnBehalfOf(address onBehalfOf) internal view {
    require(
      (onBehalfOf == _msgSender()) || (_callerWhitelists[_msgSender()] == true),
      Errors.CALLER_NOT_ONBEHALFOF_OR_IN_WHITELIST
    );
  }

  function _depositUnderlyingToken(uint256 nftTokenId) internal {
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedToken), nftTokenId);
    if (loanId != 0) {
      return;
    }

    underlyingToken.safeTransferFrom(msg.sender, address(this), nftTokenId);

    wrappedToken.mint(nftTokenId);
  }

  function borrow(
    address reserveAsset,
    uint256 amount,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode
  ) external override nonReentrant {
    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    ILendPool cachedPool = _getLendPool();

    _depositUnderlyingToken(nftTokenId);

    cachedPool.borrow(reserveAsset, amount, address(wrappedToken), nftTokenId, onBehalfOf, referralCode);

    IERC20Upgradeable(reserveAsset).safeTransfer(onBehalfOf, amount);
  }

  function batchBorrow(
    address[] calldata reserveAssets,
    uint256[] calldata amounts,
    uint256[] calldata nftTokenIds,
    address onBehalfOf,
    uint16 referralCode
  ) external override nonReentrant {
    require(nftTokenIds.length == reserveAssets.length, "WrapperGateway: inconsistent reserveAssets length");
    require(nftTokenIds.length == amounts.length, "WrapperGateway: inconsistent amounts length");

    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    ILendPool cachedPool = _getLendPool();

    for (uint256 i = 0; i < nftTokenIds.length; i++) {
      _depositUnderlyingToken(nftTokenIds[i]);

      cachedPool.borrow(reserveAssets[i], amounts[i], address(wrappedToken), nftTokenIds[i], onBehalfOf, referralCode);

      IERC20Upgradeable(reserveAssets[i]).safeTransfer(onBehalfOf, amounts[i]);
    }
  }

  function _withdrawUnderlyingToken(uint256 nftTokenId, address onBehalfOf) internal {
    address owner = wrappedToken.ownerOf(nftTokenId);
    require(owner == _msgSender(), "WrapperGateway: caller is not owner");
    require(owner == onBehalfOf, "WrapperGateway: onBehalfOf is not owner");

    wrappedToken.safeTransferFrom(onBehalfOf, address(this), nftTokenId);
    wrappedToken.burn(nftTokenId);

    underlyingToken.safeTransferFrom(address(this), owner, nftTokenId);
  }

  function repay(uint256 nftTokenId, uint256 amount) external override nonReentrant returns (uint256, bool) {
    return _repay(nftTokenId, amount);
  }

  function batchRepay(uint256[] calldata nftTokenIds, uint256[] calldata amounts)
    external
    override
    nonReentrant
    returns (uint256[] memory, bool[] memory)
  {
    require(nftTokenIds.length == amounts.length, "WrapperGateway: inconsistent amounts length");

    uint256[] memory repayAmounts = new uint256[](nftTokenIds.length);
    bool[] memory repayAlls = new bool[](nftTokenIds.length);

    for (uint256 i = 0; i < nftTokenIds.length; i++) {
      (repayAmounts[i], repayAlls[i]) = _repay(nftTokenIds[i], amounts[i]);
    }

    return (repayAmounts, repayAlls);
  }

  function _repay(uint256 nftTokenId, uint256 amount) internal returns (uint256, bool) {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedToken), nftTokenId);
    require(loanId != 0, "WrapperGateway: no loan with such nftTokenId");
    (, , address reserve, ) = cachedPoolLoan.getLoanCollateralAndReserve(loanId);
    (, uint256 debt) = cachedPoolLoan.getLoanReserveBorrowAmount(loanId);
    address borrower = cachedPoolLoan.borrowerOf(loanId);

    if (amount > debt) {
      amount = debt;
    }

    IERC20Upgradeable(reserve).safeTransferFrom(msg.sender, address(this), amount);

    (uint256 paybackAmount, bool burn) = cachedPool.repay(address(wrappedToken), nftTokenId, amount);

    if (burn) {
      require(borrower == _msgSender(), "WrapperGateway: caller is not borrower");
      _withdrawUnderlyingToken(nftTokenId, borrower);
    }

    return (paybackAmount, burn);
  }

  function auction(
    uint256 nftTokenId,
    uint256 bidPrice,
    address onBehalfOf
  ) external override nonReentrant {
    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedToken), nftTokenId);
    require(loanId != 0, "WrapperGateway: no loan with such nftTokenId");

    (, , address reserve, ) = cachedPoolLoan.getLoanCollateralAndReserve(loanId);

    IERC20Upgradeable(reserve).safeTransferFrom(msg.sender, address(this), bidPrice);

    cachedPool.auction(address(wrappedToken), nftTokenId, bidPrice, onBehalfOf);
  }

  function redeem(
    uint256 nftTokenId,
    uint256 amount,
    uint256 bidFine
  ) external override nonReentrant returns (uint256) {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedToken), nftTokenId);
    require(loanId != 0, "WrapperGateway: no loan with such nftTokenId");

    DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);

    IERC20Upgradeable(loan.reserveAsset).safeTransferFrom(msg.sender, address(this), (amount + bidFine));

    uint256 paybackAmount = cachedPool.redeem(address(wrappedToken), nftTokenId, amount, bidFine);

    if ((amount + bidFine) > paybackAmount) {
      IERC20Upgradeable(loan.reserveAsset).safeTransfer(msg.sender, ((amount + bidFine) - paybackAmount));
    }

    return paybackAmount;
  }

  function liquidate(uint256 nftTokenId, uint256 amount) external override nonReentrant returns (uint256) {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedToken), nftTokenId);
    require(loanId != 0, "WrapperGateway: no loan with such nftTokenId");

    DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);
    require(loan.bidderAddress == _msgSender(), "WrapperGateway: caller is not bidder");

    if (amount > 0) {
      IERC20Upgradeable(loan.reserveAsset).safeTransferFrom(msg.sender, address(this), amount);
    }

    uint256 extraRetAmount = cachedPool.liquidate(address(wrappedToken), nftTokenId, amount);

    _withdrawUnderlyingToken(nftTokenId, loan.bidderAddress);

    if (amount > extraRetAmount) {
      IERC20Upgradeable(loan.reserveAsset).safeTransfer(msg.sender, (amount - extraRetAmount));
    }

    return (extraRetAmount);
  }

  function borrowETH(
    uint256 amount,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode
  ) external override nonReentrant {
    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    _depositUnderlyingToken(nftTokenId);

    wethGateway.borrowETH(amount, address(wrappedToken), nftTokenId, onBehalfOf, referralCode);
  }

  function batchBorrowETH(
    uint256[] calldata amounts,
    uint256[] calldata nftTokenIds,
    address onBehalfOf,
    uint16 referralCode
  ) external override nonReentrant {
    require(nftTokenIds.length == amounts.length, "inconsistent amounts length");

    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    address[] memory nftAssets = new address[](nftTokenIds.length);
    for (uint256 i = 0; i < nftTokenIds.length; i++) {
      nftAssets[i] = address(wrappedToken);
      _depositUnderlyingToken(nftTokenIds[i]);
    }

    wethGateway.batchBorrowETH(amounts, nftAssets, nftTokenIds, onBehalfOf, referralCode);
  }

  function repayETH(uint256 nftTokenId, uint256 amount) external payable override nonReentrant returns (uint256, bool) {
    (uint256 paybackAmount, bool burn) = _repayETH(nftTokenId, amount, 0);

    // refund remaining dust eth
    if (msg.value > paybackAmount) {
      _safeTransferETH(msg.sender, msg.value - paybackAmount);
    }

    return (paybackAmount, burn);
  }

  function batchRepayETH(uint256[] calldata nftTokenIds, uint256[] calldata amounts)
    external
    payable
    override
    nonReentrant
    returns (uint256[] memory, bool[] memory)
  {
    require(nftTokenIds.length == amounts.length, "inconsistent amounts length");

    uint256[] memory repayAmounts = new uint256[](nftTokenIds.length);
    bool[] memory repayAlls = new bool[](nftTokenIds.length);
    uint256 allRepayAmount = 0;

    for (uint256 i = 0; i < nftTokenIds.length; i++) {
      (repayAmounts[i], repayAlls[i]) = _repayETH(nftTokenIds[i], amounts[i], allRepayAmount);
      allRepayAmount += repayAmounts[i];
    }

    // refund remaining dust eth
    if (msg.value > allRepayAmount) {
      _safeTransferETH(msg.sender, msg.value - allRepayAmount);
    }

    return (repayAmounts, repayAlls);
  }

  function _repayETH(
    uint256 nftTokenId,
    uint256 amount,
    uint256 accAmount
  ) internal returns (uint256, bool) {
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedToken), nftTokenId);
    require(loanId != 0, "WrapperGateway: no loan with such nftTokenId");

    address borrower = cachedPoolLoan.borrowerOf(loanId);
    require(borrower == _msgSender(), "WrapperGateway: caller is not borrower");

    (, uint256 repayDebtAmount) = cachedPoolLoan.getLoanReserveBorrowAmount(loanId);
    if (amount < repayDebtAmount) {
      repayDebtAmount = amount;
    }

    require(msg.value >= (accAmount + repayDebtAmount), "msg.value is less than repay amount");

    (uint256 paybackAmount, bool burn) = wethGateway.repayETH{value: repayDebtAmount}(
      address(wrappedToken),
      nftTokenId,
      amount
    );

    if (burn) {
      _withdrawUnderlyingToken(nftTokenId, borrower);
    }

    return (paybackAmount, burn);
  }

  function auctionETH(uint256 nftTokenId, address onBehalfOf) external payable override nonReentrant {
    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    wethGateway.auctionETH{value: msg.value}(address(wrappedToken), nftTokenId, onBehalfOf);
  }

  function redeemETH(
    uint256 nftTokenId,
    uint256 amount,
    uint256 bidFine
  ) external payable override nonReentrant returns (uint256) {
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedToken), nftTokenId);
    require(loanId != 0, "WrapperGateway: no loan with such nftTokenId");

    //DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);

    uint256 paybackAmount = wethGateway.redeemETH{value: msg.value}(address(wrappedToken), nftTokenId, amount, bidFine);

    // refund remaining dust eth
    if (msg.value > paybackAmount) {
      _safeTransferETH(msg.sender, msg.value - paybackAmount);
    }

    return paybackAmount;
  }

  function liquidateETH(uint256 nftTokenId) external payable override nonReentrant returns (uint256) {
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedToken), nftTokenId);
    require(loanId != 0, "WrapperGateway: no loan with such nftTokenId");

    DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);
    require(loan.bidderAddress == _msgSender(), "WrapperGateway: caller is not bidder");

    uint256 extraAmount = wethGateway.liquidateETH{value: msg.value}(address(wrappedToken), nftTokenId);

    _withdrawUnderlyingToken(nftTokenId, loan.bidderAddress);

    // refund remaining dust eth
    if (msg.value > extraAmount) {
      _safeTransferETH(msg.sender, msg.value - extraAmount);
    }

    return extraAmount;
  }

  /**
   * @dev transfer ETH to an address, revert if it fails.
   * @param to recipient of the transfer
   * @param value the amount to send
   */
  function _safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{value: value}(new bytes(0));
    require(success, "ETH_TRANSFER_FAILED");
  }

  /**
   * @dev
   */
  receive() external payable {}

  /**
   * @dev Revert fallback calls
   */
  fallback() external payable {
    revert("Fallback not allowed");
  }
}

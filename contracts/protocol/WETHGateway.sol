// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

import {Errors} from "../libraries/helpers/Errors.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IWETHGateway} from "../interfaces/IWETHGateway.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {IBToken} from "../interfaces/IBToken.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

import {EmergencyTokenRecoveryUpgradeable} from "./EmergencyTokenRecoveryUpgradeable.sol";

contract WETHGateway is IWETHGateway, ERC721HolderUpgradeable, EmergencyTokenRecoveryUpgradeable {
  ILendPoolAddressesProvider internal _addressProvider;

  IWETH internal WETH;

  mapping(address => bool) internal _callerWhitelists;

  uint256 private constant _NOT_ENTERED = 0;
  uint256 private constant _ENTERED = 1;
  uint256 private _status;

  /**
   * @dev Prevents a contract from calling itself, directly or indirectly.
   * Calling a `nonReentrant` function from another `nonReentrant`
   * function is not supported. It is possible to prevent this from happening
   * by making the `nonReentrant` function external, and making it call a
   * `private` function that does the actual work.
   */
  modifier nonReentrant() {
    // On the first call to nonReentrant, _notEntered will be true
    require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

    // Any calls to nonReentrant after this point will fail
    _status = _ENTERED;

    _;

    // By storing the original value once again, a refund is triggered (see
    // https://eips.ethereum.org/EIPS/eip-2200)
    _status = _NOT_ENTERED;
  }

  /**
   * @dev Sets the WETH address and the LendPoolAddressesProvider address. Infinite approves lend pool.
   * @param weth Address of the Wrapped Ether contract
   **/
  function initialize(address addressProvider, address weth) public initializer {
    __ERC721Holder_init();
    __EmergencyTokenRecovery_init();

    _addressProvider = ILendPoolAddressesProvider(addressProvider);

    WETH = IWETH(weth);

    WETH.approve(address(_getLendPool()), type(uint256).max);
  }

  function _getLendPool() internal view returns (ILendPool) {
    return ILendPool(_addressProvider.getLendPool());
  }

  function _getLendPoolLoan() internal view returns (ILendPoolLoan) {
    return ILendPoolLoan(_addressProvider.getLendPoolLoan());
  }

  function authorizeLendPoolNFT(address[] calldata nftAssets) external nonReentrant onlyOwner {
    for (uint256 i = 0; i < nftAssets.length; i++) {
      IERC721Upgradeable(nftAssets[i]).setApprovalForAll(address(_getLendPool()), true);
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

  function depositETH(address onBehalfOf, uint16 referralCode) external payable override nonReentrant {
    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    ILendPool cachedPool = _getLendPool();

    WETH.deposit{value: msg.value}();
    cachedPool.deposit(address(WETH), msg.value, onBehalfOf, referralCode);
  }

  function withdrawETH(uint256 amount, address to) external override nonReentrant {
    _checkValidCallerAndOnBehalfOf(to);

    ILendPool cachedPool = _getLendPool();
    IBToken bWETH = IBToken(cachedPool.getReserveData(address(WETH)).bTokenAddress);

    uint256 userBalance = bWETH.balanceOf(msg.sender);
    uint256 amountToWithdraw = amount;

    // if amount is equal to uint(-1), the user wants to redeem everything
    if (amount == type(uint256).max) {
      amountToWithdraw = userBalance;
    }

    bWETH.transferFrom(msg.sender, address(this), amountToWithdraw);
    cachedPool.withdraw(address(WETH), amountToWithdraw, address(this));
    WETH.withdraw(amountToWithdraw);
    _safeTransferETH(to, amountToWithdraw);
  }

  function borrowETH(
    uint256 amount,
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode
  ) external override nonReentrant {
    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    _borrowETH(amount, nftAsset, nftTokenId, onBehalfOf, referralCode);
  }

  function batchBorrowETH(
    uint256[] calldata amounts,
    address[] calldata nftAssets,
    uint256[] calldata nftTokenIds,
    address onBehalfOf,
    uint16 referralCode
  ) external override nonReentrant {
    require(nftAssets.length == nftTokenIds.length, "inconsistent tokenIds length");
    require(nftAssets.length == amounts.length, "inconsistent amounts length");

    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    for (uint256 i = 0; i < nftAssets.length; i++) {
      _borrowETH(amounts[i], nftAssets[i], nftTokenIds[i], onBehalfOf, referralCode);
    }
  }

  function _borrowETH(
    uint256 amount,
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode
  ) internal {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    // check nft has been used as collateral or not
    uint256 loanId = cachedPoolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    if (loanId == 0) {
      IERC721Upgradeable(nftAsset).safeTransferFrom(msg.sender, address(this), nftTokenId);
    }

    cachedPool.borrow(address(WETH), amount, nftAsset, nftTokenId, onBehalfOf, referralCode);

    WETH.withdraw(amount);
    _safeTransferETH(onBehalfOf, amount);
  }

  function repayETH(
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount
  ) external payable override nonReentrant returns (uint256, bool) {
    // convert eth to weth and make sure enough weth
    uint256 wethSentAmount = _wrapAndTransferWETH(amount);

    (uint256 repayAmount, bool repayAll) = _repayETH(nftAsset, nftTokenId, amount, 0, wethSentAmount);

    // refund remaining dust eth
    _unwrapAndRefundWETH(wethSentAmount, repayAmount);

    return (repayAmount, repayAll);
  }

  function batchRepayETH(
    address[] calldata nftAssets,
    uint256[] calldata nftTokenIds,
    uint256[] calldata amounts
  ) external payable override nonReentrant returns (uint256[] memory, bool[] memory) {
    require(nftAssets.length == amounts.length, "inconsistent amounts length");
    require(nftAssets.length == nftTokenIds.length, "inconsistent tokenIds length");

    // convert eth to weth and make sure enough weth
    uint256 totalSendAmount = 0;
    for (uint256 i = 0; i < nftAssets.length; i++) {
      totalSendAmount += amounts[i];
    }
    uint256 wethSentAmount = _wrapAndTransferWETH(totalSendAmount);

    uint256[] memory repayAmounts = new uint256[](nftAssets.length);
    bool[] memory repayAlls = new bool[](nftAssets.length);
    uint256 allRepayDebtAmount = 0;

    for (uint256 i = 0; i < nftAssets.length; i++) {
      (repayAmounts[i], repayAlls[i]) = _repayETH(
        nftAssets[i],
        nftTokenIds[i],
        amounts[i],
        allRepayDebtAmount,
        wethSentAmount
      );

      allRepayDebtAmount += repayAmounts[i];
    }

    // refund remaining dust eth
    _unwrapAndRefundWETH(wethSentAmount, allRepayDebtAmount);

    return (repayAmounts, repayAlls);
  }

  function _repayETH(
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount,
    uint256 accAmount,
    uint256 wethSentAmount
  ) internal returns (uint256, bool) {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    require(loanId > 0, "collateral loan id not exist");

    (address reserveAsset, uint256 repayDebtAmount) = cachedPoolLoan.getLoanReserveBorrowAmount(loanId);
    require(reserveAsset == address(WETH), "loan reserve not WETH");

    if (amount < repayDebtAmount) {
      repayDebtAmount = amount;
    }

    require(wethSentAmount >= (accAmount + repayDebtAmount), "balance is less than repay amount");

    (uint256 paybackAmount, bool burn) = cachedPool.repay(nftAsset, nftTokenId, amount);

    return (paybackAmount, burn);
  }

  function auctionETH(
    address nftAsset,
    uint256 nftTokenId,
    uint256 bidPrice,
    address onBehalfOf
  ) external payable override nonReentrant {
    _checkValidCallerAndOnBehalfOf(onBehalfOf);

    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    require(loanId > 0, "collateral loan id not exist");

    DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);
    require(loan.reserveAsset == address(WETH), "loan reserve not WETH");

    // convert eth to weth and make sure enough weth
    _wrapAndTransferWETH(bidPrice);

    cachedPool.auction(nftAsset, nftTokenId, bidPrice, onBehalfOf);
  }

  function redeemETH(
    address nftAsset,
    uint256 nftTokenId,
    uint256 amount,
    uint256 bidFine
  ) external payable override nonReentrant returns (uint256) {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    require(loanId > 0, "collateral loan id not exist");

    DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);
    require(loan.reserveAsset == address(WETH), "loan reserve not WETH");

    // convert eth to weth and make sure enough weth
    uint256 wethSentAmount = _wrapAndTransferWETH(amount + bidFine);

    uint256 paybackAmount = cachedPool.redeem(nftAsset, nftTokenId, amount, bidFine);

    // refund remaining dust weth
    _unwrapAndRefundWETH(wethSentAmount, paybackAmount);

    return paybackAmount;
  }

  function liquidateETH(
    address nftAsset,
    uint256 nftTokenId,
    uint256 extraAmount
  ) external payable override nonReentrant returns (uint256) {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    require(loanId > 0, "collateral loan id not exist");

    DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);
    require(loan.reserveAsset == address(WETH), "loan reserve not WETH");

    uint256 wethSentAmount = _wrapAndTransferWETH(extraAmount);

    uint256 paidExtraAmount = cachedPool.liquidate(nftAsset, nftTokenId, extraAmount);

    // refund remaining dust weth
    _unwrapAndRefundWETH(wethSentAmount, paidExtraAmount);

    return (paidExtraAmount);
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
   * @dev Get WETH address used by WETHGateway
   */
  function getWETHAddress() external view override returns (address) {
    return address(WETH);
  }

  function _wrapAndTransferWETH(uint256 amount) internal returns (uint256) {
    uint256 wethSendAmount = 0;
    if (msg.value > 0) {
      wethSendAmount = msg.value;
      WETH.deposit{value: msg.value}();
    }
    if (msg.value < amount) {
      wethSendAmount = amount;
      WETH.transferFrom(msg.sender, address(this), (amount - msg.value));
    }
    return wethSendAmount;
  }

  function _unwrapAndRefundWETH(uint256 sendAmount, uint256 paidAmount) internal {
    if (sendAmount > paidAmount) {
      uint256 remainAmount = sendAmount - paidAmount;
      if (msg.value >= sendAmount) {
        WETH.withdraw(remainAmount);
        _safeTransferETH(msg.sender, (remainAmount));
      } else {
        WETH.transferFrom(address(this), msg.sender, remainAmount);
      }
    }
  }

  /**
   * @dev Only WETH contract is allowed to transfer ETH here. Prevent other addresses to send Ether to this contract.
   */
  receive() external payable {
    require(msg.sender == address(WETH), "Receive not allowed");
  }

  /**
   * @dev Revert fallback calls
   */
  fallback() external payable {
    revert("Fallback not allowed");
  }
}

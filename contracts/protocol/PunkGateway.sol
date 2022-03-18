// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {ERC721HolderUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";

import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IPunks} from "../interfaces/IPunks.sol";
import {IWrappedPunks} from "../interfaces/IWrappedPunks.sol";
import {IPunkGateway} from "../interfaces/IPunkGateway.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {IWETHGateway} from "../interfaces/IWETHGateway.sol";

import {EmergencyTokenRecoveryUpgradeable} from "./EmergencyTokenRecoveryUpgradeable.sol";

contract PunkGateway is IPunkGateway, ERC721HolderUpgradeable, EmergencyTokenRecoveryUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;

  ILendPoolAddressesProvider internal _addressProvider;
  IWETHGateway internal _wethGateway;

  IPunks public punks;
  IWrappedPunks public wrappedPunks;
  address public proxy;

  function initialize(
    address addressProvider,
    address wethGateway,
    address _punks,
    address _wrappedPunks
  ) public initializer {
    __ERC721Holder_init();
    __EmergencyTokenRecovery_init();

    _addressProvider = ILendPoolAddressesProvider(addressProvider);
    _wethGateway = IWETHGateway(wethGateway);

    punks = IPunks(_punks);
    wrappedPunks = IWrappedPunks(_wrappedPunks);
    wrappedPunks.registerProxy();
    proxy = wrappedPunks.proxyInfo(address(this));

    IERC721Upgradeable(address(wrappedPunks)).setApprovalForAll(address(_getLendPool()), true);
    IERC721Upgradeable(address(wrappedPunks)).setApprovalForAll(address(_wethGateway), true);
  }

  function _getLendPool() internal view returns (ILendPool) {
    return ILendPool(_addressProvider.getLendPool());
  }

  function _getLendPoolLoan() internal view returns (ILendPoolLoan) {
    return ILendPoolLoan(_addressProvider.getLendPoolLoan());
  }

  function authorizeLendPoolERC20(address[] calldata tokens) external onlyOwner {
    for (uint256 i = 0; i < tokens.length; i++) {
      IERC20Upgradeable(tokens[i]).approve(address(_getLendPool()), type(uint256).max);
    }
  }

  function _depositPunk(uint256 punkIndex) internal {
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    if (loanId != 0) {
      return;
    }

    address owner = punks.punkIndexToAddress(punkIndex);
    require(owner == _msgSender(), "PunkGateway: not owner of punkIndex");

    punks.buyPunk(punkIndex);
    punks.transferPunk(proxy, punkIndex);

    wrappedPunks.mint(punkIndex);
  }

  function borrow(
    address reserveAsset,
    uint256 amount,
    uint256 punkIndex,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    ILendPool cachedPool = _getLendPool();

    _depositPunk(punkIndex);

    cachedPool.borrow(reserveAsset, amount, address(wrappedPunks), punkIndex, onBehalfOf, referralCode);
    IERC20Upgradeable(reserveAsset).transfer(onBehalfOf, amount);
  }

  function _withdrawPunk(uint256 punkIndex, address onBehalfOf) internal {
    address owner = wrappedPunks.ownerOf(punkIndex);
    require(owner == _msgSender(), "PunkGateway: caller is not owner");
    require(owner == onBehalfOf, "PunkGateway: onBehalfOf is not owner");

    wrappedPunks.safeTransferFrom(onBehalfOf, address(this), punkIndex);
    wrappedPunks.burn(punkIndex);
    punks.transferPunk(onBehalfOf, punkIndex);
  }

  function repay(uint256 punkIndex, uint256 amount) external override returns (uint256, bool) {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");
    (, , address reserve, ) = cachedPoolLoan.getLoanCollateralAndReserve(loanId);
    (, uint256 debt) = cachedPoolLoan.getLoanReserveBorrowAmount(loanId);
    address borrower = cachedPoolLoan.borrowerOf(loanId);

    if (amount > debt) {
      amount = debt;
    }

    IERC20Upgradeable(reserve).transferFrom(msg.sender, address(this), amount);

    (uint256 paybackAmount, bool burn) = cachedPool.repay(address(wrappedPunks), punkIndex, amount);

    if (burn) {
      require(borrower == _msgSender(), "PunkGateway: caller is not borrower");
      _withdrawPunk(punkIndex, borrower);
    }

    return (paybackAmount, burn);
  }

  function auction(
    uint256 punkIndex,
    uint256 bidPrice,
    address onBehalfOf
  ) external override {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    (, , address reserve, ) = cachedPoolLoan.getLoanCollateralAndReserve(loanId);

    IERC20Upgradeable(reserve).transferFrom(msg.sender, address(this), bidPrice);

    cachedPool.auction(address(wrappedPunks), punkIndex, bidPrice, onBehalfOf);
  }

  function redeem(uint256 punkIndex, uint256 amount) external override returns (uint256) {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);

    IERC20Upgradeable(loan.reserveAsset).transferFrom(msg.sender, address(this), amount);

    uint256 paybackAmount = cachedPool.redeem(address(wrappedPunks), punkIndex, amount);

    if (amount > paybackAmount) {
      IERC20Upgradeable(loan.reserveAsset).safeTransfer(msg.sender, (amount - paybackAmount));
    }

    return paybackAmount;
  }

  function liquidate(uint256 punkIndex, uint256 amount) external override returns (uint256) {
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);
    require(loan.bidderAddress == _msgSender(), "PunkGateway: caller is not bidder");

    if (amount > 0) {
      IERC20Upgradeable(loan.reserveAsset).transferFrom(msg.sender, address(this), amount);
    }

    uint256 extraRetAmount = cachedPool.liquidate(address(wrappedPunks), punkIndex, amount);

    _withdrawPunk(punkIndex, loan.bidderAddress);

    if (amount > extraRetAmount) {
      IERC20Upgradeable(loan.reserveAsset).safeTransfer(msg.sender, (amount - extraRetAmount));
    }

    return (extraRetAmount);
  }

  function borrowETH(
    uint256 amount,
    uint256 punkIndex,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    _depositPunk(punkIndex);
    _wethGateway.borrowETH(amount, address(wrappedPunks), punkIndex, onBehalfOf, referralCode);
  }

  function repayETH(uint256 punkIndex, uint256 amount) external payable override returns (uint256, bool) {
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    address borrower = cachedPoolLoan.borrowerOf(loanId);

    (uint256 paybackAmount, bool burn) = _wethGateway.repayETH{value: msg.value}(
      address(wrappedPunks),
      punkIndex,
      amount
    );

    if (burn) {
      require(borrower == _msgSender(), "PunkGateway: caller is not borrower");
      _withdrawPunk(punkIndex, borrower);
    }

    // refund remaining dust eth
    if (msg.value > paybackAmount) {
      _safeTransferETH(msg.sender, msg.value - paybackAmount);
    }

    return (paybackAmount, burn);
  }

  function auctionETH(uint256 punkIndex, address onBehalfOf) external payable override {
    _wethGateway.auctionETH{value: msg.value}(address(wrappedPunks), punkIndex, onBehalfOf);
  }

  function redeemETH(uint256 punkIndex, uint256 amount) external payable override returns (uint256) {
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    //DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);

    uint256 paybackAmount = _wethGateway.redeemETH{value: msg.value}(address(wrappedPunks), punkIndex, amount);

    // refund remaining dust eth
    if (msg.value > paybackAmount) {
      _safeTransferETH(msg.sender, msg.value - paybackAmount);
    }

    return paybackAmount;
  }

  function liquidateETH(uint256 punkIndex) external payable override returns (uint256) {
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    DataTypes.LoanData memory loan = cachedPoolLoan.getLoan(loanId);
    require(loan.bidderAddress == _msgSender(), "PunkGateway: caller is not bidder");

    uint256 extraAmount = _wethGateway.liquidateETH{value: msg.value}(address(wrappedPunks), punkIndex);

    _withdrawPunk(punkIndex, loan.bidderAddress);

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

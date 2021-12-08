// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IPunks} from "../interfaces/IPunks.sol";
import {IWrappedPunks} from "../interfaces/IWrappedPunks.sol";
import {IPunkGateway} from "../interfaces/IPunkGateway.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {IWETHGateway} from "../interfaces/IWETHGateway.sol";

contract PunkGateway is IERC721Receiver, Ownable, IPunkGateway {
  ILendPoolAddressesProvider internal _addressProvider;
  ILendPool internal _pool;
  ILendPoolLoan internal _poolLoan;
  IWETHGateway internal _wethGateway;

  IPunks public punks;
  IWrappedPunks public wrappedPunks;
  address public proxy;

  constructor(
    address addressProvider,
    address wethGateway,
    address _punks,
    address _wrappedPunks
  ) {
    _addressProvider = ILendPoolAddressesProvider(addressProvider);
    _pool = ILendPool(_addressProvider.getLendPool());
    _poolLoan = ILendPoolLoan(_addressProvider.getLendPoolLoan());
    _wethGateway = IWETHGateway(wethGateway);

    punks = IPunks(_punks);
    wrappedPunks = IWrappedPunks(_wrappedPunks);
    wrappedPunks.registerProxy();
    proxy = wrappedPunks.proxyInfo(address(this));

    IERC721(address(wrappedPunks)).setApprovalForAll(address(_pool), true);
    IERC721(address(wrappedPunks)).setApprovalForAll(address(_wethGateway), true);
  }

  function authorizeLendPoolERC20(address token) external onlyOwner {
    IERC20(token).approve(address(_pool), type(uint256).max);
  }

  function _depositPunk(uint256 punkIndex) internal {
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
    _depositPunk(punkIndex);

    _pool.borrow(reserveAsset, amount, address(wrappedPunks), punkIndex, onBehalfOf, referralCode);
    IERC20(reserveAsset).transfer(onBehalfOf, amount);
  }

  function _withdrawPunk(uint256 punkIndex, address onBehalfOf) internal {
    address owner = wrappedPunks.ownerOf(punkIndex);
    require(owner == onBehalfOf, "PunkGateway: invalid owner");

    wrappedPunks.safeTransferFrom(onBehalfOf, address(this), punkIndex);
    wrappedPunks.burn(punkIndex);
    punks.transferPunk(onBehalfOf, punkIndex);
  }

  function repay(uint256 punkIndex, uint256 amount) external override returns (uint256, bool) {
    uint256 loanId = _poolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");
    (, , address reserve, ) = _poolLoan.getLoanCollateralAndReserve(loanId);
    (, uint256 debt) = _poolLoan.getLoanReserveBorrowAmount(loanId);
    address borrower = _poolLoan.borrowerOf(loanId);

    if (amount > debt) {
      amount = debt;
    }

    IERC20(reserve).transferFrom(msg.sender, address(this), amount);

    (uint256 paybackAmount, bool burn) = _pool.repay(address(wrappedPunks), punkIndex, amount);

    if (burn) {
      _withdrawPunk(punkIndex, borrower);
    }

    return (paybackAmount, burn);
  }

  function auction(
    uint256 punkIndex,
    uint256 bidPrice,
    address onBehalfOf
  ) external override {
    uint256 loanId = _poolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    (, , address reserve, ) = _poolLoan.getLoanCollateralAndReserve(loanId);

    IERC20(reserve).transferFrom(msg.sender, address(this), bidPrice);

    _pool.auction(address(wrappedPunks), punkIndex, bidPrice, onBehalfOf);
  }

  function redeem(uint256 punkIndex) external override returns (uint256) {
    (uint256 loanId, , , uint256 bidBorrowAmount, uint256 bidFine) = _pool.getNftAuctionData(
      address(wrappedPunks),
      punkIndex
    );
    require(loanId > 0, "PunkGateway: no loan with such punkIndex");

    DataTypes.LoanData memory loan = _poolLoan.getLoan(loanId);

    IERC20(loan.reserveAsset).transferFrom(msg.sender, address(this), bidBorrowAmount + bidFine);

    uint256 paybackAmount = _pool.redeem(address(wrappedPunks), punkIndex);

    _withdrawPunk(punkIndex, loan.borrower);

    return paybackAmount;
  }

  function liquidate(uint256 punkIndex) external override {
    uint256 loanId = _poolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    DataTypes.LoanData memory loan = _poolLoan.getLoan(loanId);

    _pool.liquidate(address(wrappedPunks), punkIndex);

    _withdrawPunk(punkIndex, loan.bidderAddress);
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
    uint256 loanId = _poolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    address borrower = _poolLoan.borrowerOf(loanId);

    (uint256 paybackAmount, bool burn) = _wethGateway.repayETH{value: msg.value}(
      address(wrappedPunks),
      punkIndex,
      amount
    );

    if (burn) {
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

  function redeemETH(uint256 punkIndex) external payable override returns (uint256) {
    uint256 loanId = _poolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    DataTypes.LoanData memory loan = _poolLoan.getLoan(loanId);

    uint256 paybackAmount = _wethGateway.redeemETH{value: msg.value}(address(wrappedPunks), punkIndex);

    _withdrawPunk(punkIndex, loan.borrower);

    return paybackAmount;
  }

  function liquidateETH(uint256 punkIndex) external payable override {
    uint256 loanId = _poolLoan.getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");

    DataTypes.LoanData memory loan = _poolLoan.getLoan(loanId);

    _wethGateway.liquidateETH{value: msg.value}(address(wrappedPunks), punkIndex);

    _withdrawPunk(punkIndex, loan.bidderAddress);
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external pure override returns (bytes4) {
    operator;
    from;
    tokenId;
    data;
    return IERC721Receiver.onERC721Received.selector;
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
   * @dev transfer ERC20 from the utility contract, for ERC20 recovery in case of stuck tokens due
   * direct transfers to the contract address.
   * @param token token to transfer
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function emergencyTokenTransfer(
    address token,
    address to,
    uint256 amount
  ) external onlyOwner {
    IERC20(token).transfer(to, amount);
  }

  /**
   * @dev transfer native Ether from the utility contract, for native Ether recovery in case of stuck Ether
   * due selfdestructs or transfer ether to pre-computated contract address before deployment.
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function emergencyEtherTransfer(address to, uint256 amount) external onlyOwner {
    _safeTransferETH(to, amount);
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

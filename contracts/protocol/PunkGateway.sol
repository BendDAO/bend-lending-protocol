// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
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
  IPunks public punks;
  IWrappedPunks public wrappedPunks;
  address public proxy;

  constructor(IPunks _punks, IWrappedPunks _wrappedPunks) {
    punks = _punks;
    wrappedPunks = _wrappedPunks;
    wrappedPunks.registerProxy();
    proxy = wrappedPunks.proxyInfo(address(this));
  }

  function authorizeLendPool(address lendPool) external onlyOwner {
    IERC721Upgradeable(address(wrappedPunks)).setApprovalForAll(lendPool, true);
  }

  function authorizeLendPoolERC20(address lendPool, address token) external onlyOwner {
    IERC20(token).approve(lendPool, type(uint256).max);
  }

  function authorizeWETHGateway(address wethGateway) external onlyOwner {
    IERC721Upgradeable(address(wrappedPunks)).setApprovalForAll(wethGateway, true);
  }

  function _depositPunk(uint256 punkIndex) internal {
    address owner = punks.punkIndexToAddress(punkIndex);
    require(owner == _msgSender(), "PunkGateway: not owner of punkIndex");

    punks.buyPunk(punkIndex);
    punks.transferPunk(proxy, punkIndex);

    wrappedPunks.mint(punkIndex);
  }

  function borrow(
    address lendPool,
    address reserveAsset,
    uint256 amount,
    uint256 punkIndex,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    _depositPunk(punkIndex);

    ILendPool(lendPool).borrow(reserveAsset, amount, address(wrappedPunks), punkIndex, onBehalfOf, referralCode);
    IERC20(reserveAsset).transfer(onBehalfOf, amount);
  }

  function _withdrawPunk(uint256 punkIndex) internal {
    address owner = wrappedPunks.ownerOf(punkIndex);
    require(owner == _msgSender(), "PunkGateway: invalid owner");

    wrappedPunks.safeTransferFrom(_msgSender(), address(this), punkIndex);
    wrappedPunks.burn(punkIndex);
    punks.transferPunk(_msgSender(), punkIndex);
  }

  function repay(
    address lendPool,
    address lendPoolLoan,
    uint256 punkIndex,
    uint256 amount,
    address onBehalfOf
  ) external override returns (uint256, bool) {
    uint256 loanId = ILendPoolLoan(lendPoolLoan).getCollateralLoanId(address(wrappedPunks), punkIndex);
    require(loanId != 0, "PunkGateway: no loan with such punkIndex");
    address reserve = ILendPoolLoan(lendPoolLoan).getLoanReserve(loanId);
    uint256 debt = ILendPoolLoan(lendPoolLoan).getLoanReserveBorrowAmount(loanId);

    if (amount > debt) {
      amount = debt;
    }

    IERC20(reserve).transferFrom(msg.sender, address(this), amount);

    (uint256 paybackAmount, bool burn) = ILendPool(lendPool).repay(
      address(wrappedPunks),
      punkIndex,
      amount,
      onBehalfOf
    );

    if (burn) {
      _withdrawPunk(punkIndex);
    }

    return (paybackAmount, burn);
  }

  function borrowETH(
    address wethGateway,
    address lendPool,
    uint256 amount,
    uint256 punkIndex,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    _depositPunk(punkIndex);
    IWETHGateway(wethGateway).borrowETH(lendPool, amount, address(wrappedPunks), punkIndex, onBehalfOf, referralCode);
  }

  function repayETH(
    address wethGateway,
    address lendPool,
    address lendPoolLoan,
    uint256 punkIndex,
    uint256 amount,
    address onBehalfOf
  ) external payable override returns (uint256, bool) {
    (uint256 paybackAmount, bool burn) = IWETHGateway(wethGateway).repayETH{value: msg.value}(
      lendPool,
      lendPoolLoan,
      address(wrappedPunks),
      punkIndex,
      amount,
      onBehalfOf
    );

    if (burn) {
      _withdrawPunk(punkIndex);
    }

    // refund remaining dust eth
    if (msg.value > paybackAmount) {
      _safeTransferETH(msg.sender, msg.value - paybackAmount);
    }

    return (paybackAmount, burn);
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external pure override returns (bytes4) {
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

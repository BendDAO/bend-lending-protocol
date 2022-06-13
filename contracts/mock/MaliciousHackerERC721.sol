// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import {ILendPool} from "../interfaces/ILendPool.sol";
import {IDebtToken} from "../interfaces/IDebtToken.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

/**
 * @title MaliciousHackerERC721
 * @dev Malicious Hacker Logic
 */
contract MaliciousHackerERC721 is IERC721Receiver, ERC165 {
  ILendPool internal _pool;
  uint256 internal _simulateAction;

  uint256 public constant ACTION_DEPOSIT = 1;
  uint256 public constant ACTION_WITHDRAW = 2;
  uint256 public constant ACTION_BORROW = 3;
  uint256 public constant ACTION_REPAY = 4;
  uint256 public constant ACTION_AUCTION = 5;
  uint256 public constant ACTION_REDEEM = 6;
  uint256 public constant ACTION_LIQUIDATE = 7;

  constructor(address pool_) {
    _pool = ILendPool(pool_);
  }

  function approveDelegate(address reserve, address delegatee) public {
    DataTypes.ReserveData memory reserveData = _pool.getReserveData(reserve);
    IDebtToken debtToken = IDebtToken(reserveData.debtTokenAddress);

    debtToken.approveDelegation(delegatee, type(uint256).max);
  }

  function simulateAction(uint256 simulateAction_) public {
    _simulateAction = simulateAction_;
  }

  struct OnERC721ReceivedLocalVars {
    address[] reserves;
    address[] nfts;
    address onBehalfOf;
    address to;
    uint16 referralCode;
    uint256 amount;
    uint256 bidPrice;
    uint256 bidFine;
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external override returns (bytes4) {
    operator;
    from;
    tokenId;
    data;

    OnERC721ReceivedLocalVars memory vars;

    vars.reserves = _pool.getReservesList();
    vars.nfts = _pool.getNftsList();
    vars.onBehalfOf = msg.sender;
    vars.to = msg.sender;
    vars.referralCode = 0;
    vars.amount = 1 ether;
    vars.bidPrice = 2 ether;
    vars.bidFine = 0.1 ether;

    if (_simulateAction == ACTION_DEPOSIT) {
      _pool.deposit(vars.reserves[0], vars.amount, vars.onBehalfOf, vars.referralCode);
    } else if (_simulateAction == ACTION_WITHDRAW) {
      _pool.withdraw(vars.reserves[0], vars.amount, vars.to);
    } else if (_simulateAction == ACTION_BORROW) {
      _pool.borrow(vars.reserves[0], vars.amount, vars.nfts[0], tokenId, vars.onBehalfOf, vars.referralCode);
    } else if (_simulateAction == ACTION_REPAY) {
      _pool.repay(vars.nfts[0], tokenId, vars.amount);
    } else if (_simulateAction == ACTION_AUCTION) {
      _pool.auction(vars.nfts[0], tokenId, vars.bidPrice, vars.onBehalfOf);
    } else if (_simulateAction == ACTION_REDEEM) {
      _pool.redeem(vars.nfts[0], tokenId, vars.amount, vars.bidFine);
    } else if (_simulateAction == ACTION_LIQUIDATE) {
      _pool.liquidate(vars.nfts[0], tokenId, vars.amount);
    }

    return IERC721Receiver.onERC721Received.selector;
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
    return interfaceId == type(IERC721Receiver).interfaceId || super.supportsInterface(interfaceId);
  }
}

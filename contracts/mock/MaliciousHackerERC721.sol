// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {ILendPool} from "../interfaces/ILendPool.sol";
import {IDebtToken} from "../interfaces/IDebtToken.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

/**
 * @title MaliciousHackerERC721
 * @dev Malicious Hacker Logic
 */
contract MaliciousHackerERC721 is IERC721Receiver {
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

    address[] memory reserves = _pool.getReservesList();
    address[] memory nfts = _pool.getNftsList();
    address onBehalfOf = msg.sender;
    address to = msg.sender;
    uint16 referralCode = 0;
    uint256 amount = 1 ether;
    uint256 bidPrice = 2 ether;

    if (_simulateAction == ACTION_DEPOSIT) {
      _pool.deposit(reserves[0], amount, onBehalfOf, referralCode);
    } else if (_simulateAction == ACTION_WITHDRAW) {
      _pool.withdraw(reserves[0], amount, to);
    } else if (_simulateAction == ACTION_BORROW) {
      _pool.borrow(reserves[0], amount, nfts[0], tokenId, onBehalfOf, referralCode);
    } else if (_simulateAction == ACTION_REPAY) {
      _pool.repay(nfts[0], tokenId, amount);
    } else if (_simulateAction == ACTION_AUCTION) {
      _pool.auction(nfts[0], tokenId, bidPrice, onBehalfOf);
    } else if (_simulateAction == ACTION_REDEEM) {
      _pool.redeem(nfts[0], tokenId, amount);
    } else if (_simulateAction == ACTION_LIQUIDATE) {
      _pool.liquidate(nfts[0], tokenId, amount);
    }

    return IERC721Receiver.onERC721Received.selector;
  }
}

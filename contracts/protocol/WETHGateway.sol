// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IWETHGateway} from "../interfaces/IWETHGateway.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract WETHGateway is IWETHGateway, Ownable {
  IWETH internal immutable WETH;

  constructor(address weth) {
    WETH = IWETH(weth);
  }

  function authorizeLendPool(address lendPool) external onlyOwner {
    WETH.approve(lendPool, type(uint256).max);
  }

  function depositETH(address lendPool) external payable override {}

  function withdrawETH(address lendPool, uint256 amount) external override {}

  function repayETH(
    address lendPool,
    uint256 loanId,
    uint256 amount
  ) external payable override {}

  function borrowETH(
    address lendPool,
    uint256 amount,
    address nftAsset,
    uint256 nftTokenId,
    uint256 loanId,
    uint16 referralCode
  ) external override {}
}

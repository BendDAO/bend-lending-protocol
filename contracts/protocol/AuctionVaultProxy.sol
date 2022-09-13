// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IIncentivesController} from "../interfaces/IIncentivesController.sol";
import {IAuctionVaultProxy} from "../interfaces/IAuctionVaultProxy.sol";
import {IAuctionVaultManager} from "../interfaces/IAuctionVaultManager.sol";

contract AuctionVaultProxy is IAuctionVaultProxy, Initializable {
  using SafeERC20 for IERC20;
  IAuctionVaultManager public manager;

  modifier onlyAuthedCaller() {
    require(manager.checkAuthorizedCaller(msg.sender), "Proxy: permission denied");
    _;
  }

  function initialize(address _manager) external override initializer {
    manager = IAuctionVaultManager(_manager);
  }

  function safeTransfer(
    address token,
    address to,
    uint256 amount
  ) external override onlyAuthedCaller {
    IERC20(token).safeTransferFrom(address(this), to, amount);
  }

  function withdrawToken(address token, address to) external override onlyAuthedCaller {
    uint256 amount = IERC20(token).balanceOf(address(this));
    IERC20(token).safeTransfer(to, amount);
  }

  function delegatecall(address dest, bytes memory data)
    external
    override
    onlyAuthedCaller
    returns (bool success, bytes memory returndata)
  {
    (success, returndata) = dest.delegatecall(data);
  }

  function claimRewards(
    address _controller,
    address[] memory _assets,
    address token,
    address to
  ) external override onlyAuthedCaller returns (uint256) {
    uint256 rewardAmount = IIncentivesController(_controller).getRewardsBalance(_assets, address(this));
    uint256 claimedAmount = IIncentivesController(_controller).claimRewards(_assets, rewardAmount);

    IERC20(token).safeTransferFrom(address(this), to, claimedAmount);

    return claimedAmount;
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IIncentivesController} from "../interfaces/IIncentivesController.sol";

contract MockIncentivesController is IIncentivesController {
  bool private _handleActionIsCalled;
  address private _asset;
  uint256 private _totalSupply;
  uint256 private _userBalance;
  uint256 private _dummy;

  /**
   * @dev Called by the corresponding asset on any update that affects the rewards distribution
   * @param asset The address of the user
   * @param totalSupply The total supply of the asset in the lending pool
   * @param userBalance The balance of the user of the asset in the lending pool
   **/
  function handleAction(
    address asset,
    uint256 totalSupply,
    uint256 userBalance
  ) external override {
    _handleActionIsCalled = true;
    _asset = asset;
    _totalSupply = totalSupply;
    _userBalance = userBalance;
  }

  function checkHandleActionIsCorrect(
    address asset,
    uint256 totalSupply,
    uint256 userBalance
  ) public view returns (bool) {
    return _handleActionIsCalled && asset == _asset && totalSupply == _totalSupply && userBalance == _userBalance;
  }

  function checkHandleActionIsCalled() public view returns (bool) {
    return _handleActionIsCalled;
  }

  function resetHandleActionIsCalled() public {
    _handleActionIsCalled = false;
    _asset = address(0);
    _totalSupply = 0;
    _userBalance = 0;
  }

  function REWARD_TOKEN() external view override returns (address) {
    _asset;
    return address(0);
  }

  /**
   * @dev Returns the total of rewards of an user, already accrued + not yet accrued
   * @param _assets The assets to incentivize
   * @param _user The address of the user
   * @return The rewards
   **/
  function getRewardsBalance(address[] calldata _assets, address _user) external view override returns (uint256) {
    _assets;
    _user;

    _asset;
    return 0;
  }

  /**
   * @dev Claims reward for an user, on all the assets of the lending pool, accumulating the pending rewards
   * @param _assets The assets to incentivize
   * @param _amount Amount of rewards to claim
   * @return Rewards claimed
   **/
  function claimRewards(address[] calldata _assets, uint256 _amount) external override returns (uint256) {
    _assets;
    _amount;

    _asset;
    _dummy = 0;
    return 0;
  }

  /**
   * @dev returns the unclaimed rewards of the user
   * @param _user the address of the user
   * @return the unclaimed user rewards
   */
  function getUserUnclaimedRewards(address _user) external view override returns (uint256) {
    _user;

    _asset;
    return 0;
  }
}

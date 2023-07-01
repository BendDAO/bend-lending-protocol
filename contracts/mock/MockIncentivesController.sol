// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IScaledBalanceToken} from "../interfaces/IScaledBalanceToken.sol";
import {IIncentivesController} from "../interfaces/IIncentivesController.sol";

contract MockIncentivesController is IIncentivesController {
  bool private _handleActionIsCalled;
  address private _asset;
  uint256 private _totalSupply;
  uint256 private _userBalance;
  uint256 private _emissionPerSecond;

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

  function configureAssets(IScaledBalanceToken[] calldata _assets, uint256[] calldata _emissionsPerSeconds)
    external
    override
  {
    _asset = address(_assets[0]);
    _emissionPerSecond = _emissionsPerSeconds[0];
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
}

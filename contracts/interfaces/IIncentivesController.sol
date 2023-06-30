// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IScaledBalanceToken} from "./IScaledBalanceToken.sol";

interface IIncentivesController {
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
  ) external;

  function configureAssets(IScaledBalanceToken[] calldata _assets, uint256[] calldata _emissionsPerSecond) external;
}

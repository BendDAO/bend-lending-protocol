// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

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

  function REWARD_TOKEN() external view returns (address);

  /**
   * @dev Returns the total of rewards of an user, already accrued + not yet accrued
   * @param _assets The assets to incentivize
   * @param _user The address of the user
   * @return The rewards
   **/
  function getRewardsBalance(address[] calldata _assets, address _user) external view returns (uint256);

  /**
   * @dev Claims reward for an user, on all the assets of the lending pool, accumulating the pending rewards
   * @param _assets The assets to incentivize
   * @param _amount Amount of rewards to claim
   * @return Rewards claimed
   **/
  function claimRewards(address[] calldata _assets, uint256 _amount) external returns (uint256);

  /**
   * @dev returns the unclaimed rewards of the user
   * @param _user the address of the user
   * @return the unclaimed user rewards
   */
  function getUserUnclaimedRewards(address _user) external view returns (uint256);
}

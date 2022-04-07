// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {PercentageMath} from "../libraries/math/PercentageMath.sol";

/**
 * @title BendCollector
 * @notice Stores all the BEND kept for incentives, just giving approval to the different
 * systems that will pull BEND funds for their specific use case
 * @author Bend
 **/
contract BendCollector is Initializable, OwnableUpgradeable {
  using SafeERC20Upgradeable for IERC20Upgradeable;
  using PercentageMath for uint256;
  address public rewardToken;
  address public feeDistributor;
  uint256 public referRewards;
  uint256 public referRewardsPercentage;
  address public treasury;

  /**
   * @dev initializes the contract upon assignment to the BendUpgradeableProxy
   */
  function initialize() external initializer {
    __Ownable_init();
  }

  function setRewardToken(address _rewardToken) external onlyOwner {
    require(_rewardToken != address(0), Errors.BL_INVALID_REWARDS_TOKEN_ADDRESS);
    rewardToken = _rewardToken;
  }

  function setTreasuryAddress(address _treasury) external onlyOwner {
    require(_treasury != address(0), Errors.BL_INVALID_TREASURY_ADDRESS);
    treasury = _treasury;
  }

  function setFeeDistributorAddress(address _feeDistributor) external onlyOwner {
    require(_feeDistributor != address(0), Errors.BL_INVALID_FEE_DISTRIBUTOR_ADDRESS);
    feeDistributor = _feeDistributor;
  }

  function setReferRewardsPercentage(uint256 _referRewardsPercentage) external onlyOwner {
    require(_referRewardsPercentage <= PercentageMath.PERCENTAGE_FACTOR, Errors.BL_INVALID_REFER_PERCENTAGE);
    referRewardsPercentage = _referRewardsPercentage;
  }

  function distribute() external {
    require(feeDistributor != address(0), Errors.BL_INVALID_FEE_DISTRIBUTOR_ADDRESS);

    uint256 _toDistribute = IERC20Upgradeable(rewardToken).balanceOf(address(this)) - referRewards;
    uint256 _referRewards = _toDistribute.percentMul(referRewardsPercentage);
    uint256 _feeRewards = _toDistribute - _referRewards;

    referRewards += _referRewards;
    if (_feeRewards > 0) {
      IERC20Upgradeable(rewardToken).safeTransfer(feeDistributor, _feeRewards);
    }
  }

  function withdrawReferRewards() external onlyOwner {
    require(treasury != address(0), Errors.BL_INVALID_TREASURY_ADDRESS);
    if (referRewards > 0) {
      IERC20Upgradeable(rewardToken).safeTransfer(treasury, referRewards);
      referRewards = 0;
    }
  }

  function unapprove(address recipient) external onlyOwner {
    IERC20Upgradeable(rewardToken).safeApprove(recipient, 0);
  }
}

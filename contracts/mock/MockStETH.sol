// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IStETH} from "../interfaces/IStETH.sol";

contract MockStETH is IStETH, ERC20 {
  uint256 public constant RATIO_FACTOR = 10000;

  uint256 internal _shareRatio;

  constructor() ERC20("Liquid staked Ether 2.0", "stETH") {
    // 100% = 1e4
    _shareRatio = RATIO_FACTOR;
  }

  function setShareRatio(uint256 ratio_) public {
    _shareRatio = ratio_;
  }

  function etShareRatio() public view returns (uint256) {
    return _shareRatio;
  }

  function balanceOf(address _account) public view override(IERC20, ERC20) returns (uint256) {
    return getPooledEthByShares(super.balanceOf(_account));
  }

  function getPooledEthByShares(uint256 _sharesAmount) public view override returns (uint256) {
    return (_sharesAmount * _shareRatio) / RATIO_FACTOR;
  }

  function getSharesByPooledEth(uint256 _pooledEthAmount) public view override returns (uint256) {
    return (_pooledEthAmount * RATIO_FACTOR) / _shareRatio;
  }

  function submit(
    address /*_referral*/
  ) public payable override returns (uint256) {
    require(msg.value != 0, "ZERO_DEPOSIT");
    uint256 sharesAmount = getSharesByPooledEth(msg.value);
    _mint(msg.sender, sharesAmount);
    return sharesAmount;
  }
}

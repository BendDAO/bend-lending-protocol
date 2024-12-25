// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVeBend {
  struct LockedBalance {
    int256 amount;
    uint256 end;
  }

  function getLocked(address _addr) external view returns (LockedBalance memory);
}

/**
 * @title BendDAO Token's Voting Contract
 * @notice Provides a comprehensive vote count for a given address
 */
contract BendTokenVoting {
  IERC20 public immutable bendToken;
  IVeBend public immutable veBendToken;

  constructor(address bendToken_, address veBendToken_) {
    bendToken = IERC20(bendToken_);
    veBendToken = IVeBend(veBendToken_);
  }

  /**
   * @notice Returns a vote count for a given address
   * @param userAddress The address to return votes for
   */
  function getVotes(address userAddress) public view returns (uint256 votes) {
    votes += bendToken.balanceOf(userAddress);

    IVeBend.LockedBalance memory lockBal = veBendToken.getLocked(userAddress);
    votes += uint256(lockBal.amount);
  }
}

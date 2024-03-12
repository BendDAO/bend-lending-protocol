// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @dev Interface for interacting with WstETH contract
 * Note Not a comprehensive interface
 */
interface IWstETH is IERC20Metadata {
  function stETH() external returns (address);

  function wrap(uint256 _stETHAmount) external returns (uint256);

  function unwrap(uint256 _wstETHAmount) external returns (uint256);

  function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256);

  function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256);

  function stEthPerToken() external view returns (uint256);

  function tokensPerStEth() external view returns (uint256);
}

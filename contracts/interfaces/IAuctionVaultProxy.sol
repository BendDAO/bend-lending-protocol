// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IAuctionVaultProxy {
  function initialize(address _manager) external;

  function safeTransfer(
    address token,
    address to,
    uint256 amount
  ) external;

  function withdrawToken(address token, address to) external;

  function delegatecall(address dest, bytes memory data) external returns (bool, bytes memory);

  function claimRewards(
    address _controller,
    address[] memory _assets,
    address token,
    address to
  ) external returns (uint256);
}

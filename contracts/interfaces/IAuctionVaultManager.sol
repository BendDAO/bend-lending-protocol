// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IAuctionVaultManager {
  event Initialized(address addressProvider);
  event ProxyImplementionUpdated(address newImpl);
  event AuthorizedCallerUpdated(address caller, bool flag);
  event AuthorizedDelegateUpdated(address delegate, bool flag);

  function initialize(address provider, address proxyImpl) external;

  function checkAuthorizedCaller(address caller) external view returns (bool);

  function setAuthorizedCallers(address[] memory callers, bool flag) external;

  function checkAuthorizedDelegate(address delegate) external view returns (bool);

  function setAuthorizedDelegates(address[] memory delegates, bool flag) external;

  function setProxyImplemention(address newImpl) external;

  function getProxy(address nftAsset, address nftTokenId) external view returns (address);

  function registerProxy(address nftAsset, address nftTokenId) external returns (address);

  function upgradeProxy(address nftAsset, address nftTokenId) external returns (address);
}

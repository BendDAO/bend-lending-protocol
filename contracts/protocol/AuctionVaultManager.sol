// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {ClonesUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";

import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {Errors} from "../libraries/helpers/Errors.sol";

import {IAuctionVaultManager} from "../interfaces/IAuctionVaultManager.sol";
import {IAuctionVaultProxy} from "../interfaces/IAuctionVaultProxy.sol";

contract AuctionVaultManager is Initializable, ContextUpgradeable, IAuctionVaultManager {
  using ClonesUpgradeable for address;

  ILendPoolAddressesProvider public addressProvider;
  mapping(address => bool) public authorizedCallers;
  mapping(address => bool) public authorizedDelegates;
  address public proxyImplemention;
  mapping(bytes32 => address) public proxies;

  modifier onlyLendPool() {
    require(_msgSender() == addressProvider.getLendPool(), Errors.CT_CALLER_MUST_BE_LEND_POOL);
    _;
  }

  modifier onlyPoolAdmin() {
    require(_msgSender() == addressProvider.getPoolAdmin(), Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  // called once by the factory at time of deployment
  function initialize(address provider, address proxyImpl) external override initializer {
    __Context_init();

    addressProvider = ILendPoolAddressesProvider(provider);
    proxyImplemention = proxyImpl;

    emit Initialized(provider);
    emit ProxyImplementionUpdated(proxyImpl);
  }

  function checkAuthorizedCaller(address caller) external view override returns (bool) {
    if (authorizedCallers[caller]) {
      return true;
    }

    if (caller == addressProvider.getLendPool()) {
      return true;
    }

    return false;
  }

  function setAuthorizedCallers(address[] callers, bool flag) external override onlyPoolAdmin {
    for (uint256 i = 0; i < callers.length; i++) {
      authorizedCallers[callers[i]] = flag;
      emit AuthorizedCallerUpdated(callers[i], flag);
    }
  }

  function checkAuthorizedDelegate(address delegate) external view override returns (bool) {
    if (authorizedDelegates[caller]) {
      return true;
    }

    return false;
  }

  function setAuthorizedDelegates(address[] delegates, bool flag) external override onlyPoolAdmin {
    for (uint256 i = 0; i < delegates.length; i++) {
      authorizedDelegates[delegates[i]] = flag;
      emit AuthorizedDelegateUpdated(delegates[i], flag);
    }
  }

  function setProxyImplemention(address newImpl) external override onlyPoolAdmin {
    proxyImplemention = newImpl;

    emit ProxyImplementionUpdated(newImpl);
  }

  function registerProxy(address nftAsset, address nftTokenId) external override onlyLendPool returns (address) {
    bytes32 hashKey = keccak256(abi.encodePacked(nftAsset, nftTokenId));
    return _registerProxyFor(hashKey);
  }

  function _registerProxyFor(bytes32 hashKey) internal returns (address) {
    require(address(proxies[hashKey]) == address(0), Errors.LP_AUCTION_VAULT_PROXY_ALREADY_EXIST);
    address proxy = proxyImplemention.clone();

    IAuctionVaultProxy(proxy).initialize(address(this));
    proxies[hashKey] = proxy;
    return proxy;
  }

  function getProxy(address nftAsset, address nftTokenId) external view override returns (address) {
    bytes32 hashKey = keccak256(abi.encodePacked(nftAsset, nftTokenId));
    return proxies[hashKey];
  }
}

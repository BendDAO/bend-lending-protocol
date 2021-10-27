// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IBNFTRegistry} from '../interfaces/IBNFTRegistry.sol';
import {IBNFT} from '../interfaces/IBNFT.sol';
import {BNFT} from './BNFT.sol';
import {InitializableAdminProxy} from '../libraries/proxy/InitializableAdminProxy.sol';

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {IERC721Metadata} from '@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol';

contract BNFTRegistry is IBNFTRegistry, Ownable {
  mapping(address => address) public bNftProxys;
  mapping(address => address) public bNftImpls;
  address[] public bNftProxyLists;
  string public namePrefix;
  string public symbolPrefix;

  constructor(string memory namePrefix_, string memory symbolPrefix_) {
    namePrefix = namePrefix_;
    symbolPrefix = symbolPrefix_;
  }

  function getBNFT(address nftAsset)
    external
    view
    override
    returns (address bNftProxy, address bNftImpl)
  {
    return (bNftProxys[nftAsset], bNftImpls[nftAsset]);
  }

  function getBNFTByIndex(uint16 index)
    external
    view
    override
    returns (address bNftProxy, address bNftImpl)
  {
    require(index < bNftProxyLists.length, 'BNFTRegistry: index range');
    return (bNftProxyLists[index], bNftImpls[bNftProxyLists[index]]);
  }

  function getBNFTProxyList() external view override returns (address[] memory) {
    return bNftProxyLists;
  }

  function allBNFTProxyLength() external view override returns (uint256) {
    return bNftProxyLists.length;
  }

  /**
   * @dev See {IBNFTRegistry-createBNFT}.
   */
  function createBNFT(address nftAsset, bytes memory params)
    external
    override
    returns (address bNftProxy)
  {
    require(nftAsset != address(0), 'BNFTRegistry: asset is zero address');
    require(bNftProxys[nftAsset] == address(0), 'BNFTRegistry: asset exist');

    address bNftImpl = _newBNFTImpl();

    bNftProxy = _createProxyAndInitWithImpl(nftAsset, bNftImpl, params);

    emit BNFTCreated(nftAsset, bNftImpls[nftAsset], bNftProxy, bNftProxyLists.length);
  }

  /**
   * @dev See {IBNFTRegistry-createBNFTWithImpl}.
   */
  function createBNFTWithImpl(
    address nftAsset,
    address bNftImpl,
    bytes memory params
  ) external override onlyOwner returns (address bNftProxy) {
    require(nftAsset != address(0), 'BNFTRegistry: asset is zero address');
    require(bNftImpl != address(0), 'BNFTRegistry: implement is zero address');
    require(bNftProxys[nftAsset] == address(0), 'BNFTRegistry: asset exist');

    bNftProxy = _createProxyAndInitWithImpl(nftAsset, bNftImpl, params);

    emit BNFTCreated(nftAsset, bNftImpls[nftAsset], bNftProxy, bNftProxyLists.length);
  }

  /**
   * @dev See {IBNFTRegistry-upgradeBNFTWithImpl}.
   */
  function upgradeBNFTWithImpl(
    address nftAsset,
    address bNftImpl,
    bytes memory data
  ) external override onlyOwner {
    address bNftProxy = bNftProxys[nftAsset];
    require(bNftProxy != address(0), 'BNFTRegistry: asset nonexist');

    InitializableAdminProxy proxy = InitializableAdminProxy(payable(bNftProxy));

    proxy.upgradeToAndCall(bNftImpl, data);

    bNftImpls[nftAsset] = bNftImpl;

    emit BNFTUpgraded(nftAsset, bNftImpl, bNftProxy, bNftProxyLists.length);
  }

  function _createProxyAndInitWithImpl(
    address nftAsset,
    address bNftImpl,
    bytes memory params
  ) internal returns (address bNftProxy) {
    bytes memory initParams = _buildInitParams(nftAsset, params);

    InitializableAdminProxy proxy = new InitializableAdminProxy(address(this));
    proxy.initialize(bNftImpl, initParams);

    bNftProxy = address(proxy);

    bNftImpls[nftAsset] = bNftImpl;
    bNftProxys[nftAsset] = bNftProxy;
    bNftProxyLists.push(bNftProxy);
  }

  function _newBNFTImpl() internal returns (address bNftImpl) {
    bNftImpl = address(new BNFT());
  }

  function _buildInitParams(address nftAsset, bytes memory params)
    internal
    view
    returns (bytes memory initParams)
  {
    string memory bNftName = string(
      abi.encodePacked(namePrefix, ' ', IERC721Metadata(nftAsset).name())
    );
    string memory bNftSymbol = string(
      abi.encodePacked(symbolPrefix, IERC721Metadata(nftAsset).symbol())
    );

    initParams = abi.encodeWithSelector(
      IBNFT.initialize.selector,
      nftAsset,
      bNftName,
      bNftSymbol,
      params
    );
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IBNFTRegistry} from "../interfaces/IBNFTRegistry.sol";
import {IBNFT} from "../interfaces/IBNFT.sol";
import {BendUpgradeableProxy} from "../libraries/proxy/BendUpgradeableProxy.sol";

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";

contract BNFTRegistry is IBNFTRegistry, Initializable, OwnableUpgradeable {
  mapping(address => address) public bNftProxys;
  mapping(address => address) public bNftImpls;
  address[] public bNftAssetLists;
  string public namePrefix;
  string public symbolPrefix;
  address public bNftGenericImpl;

  function getBNFTAddresses(address nftAsset) external view override returns (address bNftProxy, address bNftImpl) {
    bNftProxy = bNftProxys[nftAsset];
    bNftImpl = bNftImpls[nftAsset];
  }

  function getBNFTAddressesByIndex(uint16 index) external view override returns (address bNftProxy, address bNftImpl) {
    require(index < bNftAssetLists.length, "BNFTR: invalid index");
    bNftProxy = bNftProxys[bNftAssetLists[index]];
    bNftImpl = bNftImpls[bNftAssetLists[index]];
  }

  function getBNFTAssetList() external view override returns (address[] memory) {
    return bNftAssetLists;
  }

  function allBNFTAssetLength() external view override returns (uint256) {
    return bNftAssetLists.length;
  }

  function initialize(
    address genericImpl,
    string memory namePrefix_,
    string memory symbolPrefix_
  ) external override initializer {
    require(genericImpl != address(0), "BNFTR: impl is zero address");

    __Ownable_init();

    bNftGenericImpl = genericImpl;

    namePrefix = namePrefix_;
    symbolPrefix = symbolPrefix_;

    emit Initialized(genericImpl, namePrefix, symbolPrefix);
  }

  /**
   * @dev See {IBNFTRegistry-createBNFT}.
   */
  function createBNFT(address nftAsset, bytes memory params) external override returns (address bNftProxy) {
    require(nftAsset != address(0), "BNFTR: asset is zero address");
    require(bNftProxys[nftAsset] == address(0), "BNFTR: asset exist");
    require(bNftGenericImpl != address(0), "BNFTR: impl is zero address");

    bNftProxy = _createProxyAndInitWithImpl(nftAsset, bNftGenericImpl, params);

    emit BNFTCreated(nftAsset, bNftImpls[nftAsset], bNftProxy, bNftAssetLists.length);
  }

  /**
   * @dev See {IBNFTRegistry-setBNFTGenericImpl}.
   */
  function setBNFTGenericImpl(address genericImpl) external override onlyOwner {
    require(genericImpl != address(0), "BNFTR: impl is zero address");
    bNftGenericImpl = genericImpl;
  }

  /**
   * @dev See {IBNFTRegistry-createBNFTWithImpl}.
   */
  function createBNFTWithImpl(
    address nftAsset,
    address bNftImpl,
    bytes memory params
  ) external override onlyOwner returns (address bNftProxy) {
    require(nftAsset != address(0), "BNFTR: asset is zero address");
    require(bNftImpl != address(0), "BNFTR: implement is zero address");
    require(bNftProxys[nftAsset] == address(0), "BNFTR: asset exist");

    bNftProxy = _createProxyAndInitWithImpl(nftAsset, bNftImpl, params);

    emit BNFTCreated(nftAsset, bNftImpls[nftAsset], bNftProxy, bNftAssetLists.length);
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
    require(bNftProxy != address(0), "BNFTR: asset nonexist");

    BendUpgradeableProxy proxy = BendUpgradeableProxy(payable(bNftProxy));

    if (data.length > 0) {
      proxy.upgradeToAndCall(bNftImpl, data);
    } else {
      proxy.upgradeTo(bNftImpl);
    }

    bNftImpls[nftAsset] = bNftImpl;

    emit BNFTUpgraded(nftAsset, bNftImpl, bNftProxy, bNftAssetLists.length);
  }

  function _createProxyAndInitWithImpl(
    address nftAsset,
    address bNftImpl,
    bytes memory params
  ) internal returns (address bNftProxy) {
    bytes memory initParams = _buildInitParams(nftAsset, params);

    BendUpgradeableProxy proxy = new BendUpgradeableProxy(bNftImpl, address(this), initParams);

    bNftProxy = address(proxy);

    bNftImpls[nftAsset] = bNftImpl;
    bNftProxys[nftAsset] = bNftProxy;
    bNftAssetLists.push(nftAsset);
  }

  function _buildInitParams(address nftAsset, bytes memory params) internal view returns (bytes memory initParams) {
    string memory bNftName = string(abi.encodePacked(namePrefix, " ", IERC721MetadataUpgradeable(nftAsset).name()));
    string memory bNftSymbol = string(abi.encodePacked(symbolPrefix, IERC721MetadataUpgradeable(nftAsset).symbol()));

    initParams = abi.encodeWithSelector(IBNFT.initialize.selector, nftAsset, bNftName, bNftSymbol, params);
  }
}

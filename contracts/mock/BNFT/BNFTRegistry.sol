// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IBNFTRegistry} from "../../interfaces/IBNFTRegistry.sol";
import {IBNFT} from "../../interfaces/IBNFT.sol";

import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract BNFTRegistry is IBNFTRegistry, Initializable, OwnableUpgradeable {
  mapping(address => address) public bNftProxys;
  mapping(address => address) public bNftImpls;
  address[] public bNftAssetLists;
  string public namePrefix;
  string public symbolPrefix;
  address public bNftGenericImpl;
  mapping(address => string) public customSymbols;

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
  function createBNFT(address nftAsset) external override returns (address bNftProxy) {
    _requireAddressIsERC721(nftAsset);
    require(bNftProxys[nftAsset] == address(0), "BNFTR: asset exist");
    require(bNftGenericImpl != address(0), "BNFTR: impl is zero address");

    bNftProxy = _createProxyAndInitWithImpl(nftAsset, bNftGenericImpl);

    emit BNFTCreated(nftAsset, bNftImpls[nftAsset], bNftProxy, bNftAssetLists.length);
  }

  /**
   * @dev See {IBNFTRegistry-setBNFTGenericImpl}.
   */
  function setBNFTGenericImpl(address genericImpl) external override onlyOwner {
    require(genericImpl != address(0), "BNFTR: impl is zero address");
    bNftGenericImpl = genericImpl;

    emit GenericImplementationUpdated(genericImpl);
  }

  /**
   * @dev See {IBNFTRegistry-createBNFTWithImpl}.
   */
  function createBNFTWithImpl(address nftAsset, address bNftImpl)
    external
    override
    onlyOwner
    returns (address bNftProxy)
  {
    _requireAddressIsERC721(nftAsset);
    require(bNftImpl != address(0), "BNFTR: implement is zero address");
    require(bNftProxys[nftAsset] == address(0), "BNFTR: asset exist");

    bNftProxy = _createProxyAndInitWithImpl(nftAsset, bNftImpl);

    emit BNFTCreated(nftAsset, bNftImpls[nftAsset], bNftProxy, bNftAssetLists.length);
  }

  /**
   * @dev See {IBNFTRegistry-upgradeBNFTWithImpl}.
   */
  function upgradeBNFTWithImpl(
    address nftAsset,
    address bNftImpl,
    bytes memory encodedCallData
  ) external override onlyOwner {
    address bNftProxy = bNftProxys[nftAsset];
    require(bNftProxy != address(0), "BNFTR: asset nonexist");

    TransparentUpgradeableProxy proxy = TransparentUpgradeableProxy(payable(bNftProxy));

    if (encodedCallData.length > 0) {
      proxy.upgradeToAndCall(bNftImpl, encodedCallData);
    } else {
      proxy.upgradeTo(bNftImpl);
    }

    bNftImpls[nftAsset] = bNftImpl;

    emit BNFTUpgraded(nftAsset, bNftImpl, bNftProxy, bNftAssetLists.length);
  }

  /**
   * @dev See {IBNFTRegistry-addCustomeSymbols}.
   */
  function addCustomeSymbols(address[] memory nftAssets_, string[] memory symbols_) external override onlyOwner {
    require(nftAssets_.length == symbols_.length, "BNFTR: inconsistent parameters");

    for (uint256 i = 0; i < nftAssets_.length; i++) {
      customSymbols[nftAssets_[i]] = symbols_[i];
    }
  }

  function _createProxyAndInitWithImpl(address nftAsset, address bNftImpl) internal returns (address bNftProxy) {
    bytes memory initParams = _buildInitParams(nftAsset);

    TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(bNftImpl, address(this), initParams);

    bNftProxy = address(proxy);

    bNftImpls[nftAsset] = bNftImpl;
    bNftProxys[nftAsset] = bNftProxy;
    bNftAssetLists.push(nftAsset);
  }

  function _buildInitParams(address nftAsset) internal view returns (bytes memory initParams) {
    string memory nftSymbol = customSymbols[nftAsset];
    if (bytes(nftSymbol).length == 0) {
      nftSymbol = IERC721MetadataUpgradeable(nftAsset).symbol();
    }
    string memory bNftName = string(abi.encodePacked(namePrefix, " ", nftSymbol));
    string memory bNftSymbol = string(abi.encodePacked(symbolPrefix, nftSymbol));

    initParams = abi.encodeWithSelector(IBNFT.initialize.selector, nftAsset, bNftName, bNftSymbol);
  }

  function _requireAddressIsERC721(address nftAsset) internal view {
    require(nftAsset != address(0), "BNFTR: asset is zero address");
    require(AddressUpgradeable.isContract(nftAsset), "BNFTR: asset is not contract");
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface IBNFTRegistry {
  event Initialized(address genericImpl, string namePrefix, string symbolPrefix);
  event GenericImplementationUpdated(address genericImpl);
  event BNFTCreated(address indexed nftAsset, address bNftImpl, address bNftProxy, uint256 totals);
  event BNFTUpgraded(address indexed nftAsset, address bNftImpl, address bNftProxy, uint256 totals);

  function getBNFTAddresses(address nftAsset) external view returns (address bNftProxy, address bNftImpl);

  function getBNFTAddressesByIndex(uint16 index) external view returns (address bNftProxy, address bNftImpl);

  function getBNFTAssetList() external view returns (address[] memory);

  function allBNFTAssetLength() external view returns (uint256);

  function initialize(
    address genericImpl,
    string memory namePrefix_,
    string memory symbolPrefix_
  ) external;

  function setBNFTGenericImpl(address genericImpl) external;

  /**
   * @dev Create bNFT proxy and implement, then initialize it
   * @param nftAsset The address of the underlying asset of the BNFT
   **/
  function createBNFT(address nftAsset) external returns (address bNftProxy);

  /**
   * @dev Create bNFT proxy with already deployed implement, then initialize it
   * @param nftAsset The address of the underlying asset of the BNFT
   * @param bNftImpl The address of the deployed implement of the BNFT
   **/
  function createBNFTWithImpl(address nftAsset, address bNftImpl) external returns (address bNftProxy);

  /**
   * @dev Update bNFT proxy to an new deployed implement, then initialize it
   * @param nftAsset The address of the underlying asset of the BNFT
   * @param bNftImpl The address of the deployed implement of the BNFT
   * @param encodedCallData The encoded function call.
   **/
  function upgradeBNFTWithImpl(
    address nftAsset,
    address bNftImpl,
    bytes memory encodedCallData
  ) external;

  /**
   * @dev Adding custom symbol for some special NFTs like CryptoPunks
   * @param nftAssets_ The addresses of the NFTs
   * @param symbols_ The custom symbols of the NFTs
   **/
  function addCustomeSymbols(address[] memory nftAssets_, string[] memory symbols_) external;
}

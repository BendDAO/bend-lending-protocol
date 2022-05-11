// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

/************
@title INFTOracle interface
@notice Interface for NFT price oracle.*/
interface INFTOracle {
  /* CAUTION: Price uint is ETH based (WEI, 18 decimals) */
  // get asset price
  function getAssetPrice(address _nftContract) external view returns (uint256);

  // get latest timestamp
  function getLatestTimestamp(address _nftContract) external view returns (uint256);

  // get previous price with _back rounds
  function getPreviousPrice(address _nftContract, uint256 _numOfRoundBack) external view returns (uint256);

  // get previous timestamp with _back rounds
  function getPreviousTimestamp(address _nftContract, uint256 _numOfRoundBack) external view returns (uint256);

  function setAssetData(address _nftContract, uint256 _price) external;

  function setPause(address _nftContract, bool val) external;

  function setTwapInterval(uint256 _twapInterval) external;
}

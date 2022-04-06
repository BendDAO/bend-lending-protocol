// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

/************
@title INFTOracle interface
@notice Interface for NFT price oracle.*/
interface INFTOracle {
  /* CAUTION: Price uint is ETH based (WEI, 18 decimals) */
  // get latest price
  function getAssetPrice(address _asset) external view returns (uint256);

  // get latest timestamp
  function getLatestTimestamp(address _asset) external view returns (uint256);

  // get previous price with _back rounds
  function getPreviousPrice(address _asset, uint256 _numOfRoundBack) external view returns (uint256);

  // get previous timestamp with _back rounds
  function getPreviousTimestamp(address _asset, uint256 _numOfRoundBack) external view returns (uint256);

  // get twap price depending on _period
  function getTwapPrice(address _asset, uint256 _interval) external view returns (uint256);

  function setAssetData(
    address _asset,
    uint256 _price,
    uint256 _timestamp,
    uint256 _roundId
  ) external;

  function setPause(address _nftContract, bool val) external;

  function paused(address _nftContract) external view returns (bool);
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface ICryptoPunk {
  function punkIndexToAddress(uint256 punkIndex) external returns (address);

  function punksOfferedForSale(uint256 punkIndex)
    external
    returns (
      bool,
      uint256,
      address,
      uint256,
      address
    );

  function buyPunk(uint256 punkIndex) external payable;

  function transferPunk(address to, uint256 punkIndex) external;
}

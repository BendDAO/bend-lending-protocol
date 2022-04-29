// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface ICryptoPunksMarket {
  struct Offer {
    bool isForSale;
    uint256 punkIndex;
    address seller;
    uint256 minValue; // in ether
    address onlySellTo; // specify to sell only to a specific person
  }

  function buyPunk(uint256 punkIndex) external payable;

  function punksOfferedForSale(uint256 punkIndex) external view returns (Offer memory);

  function punkIndexToAddress(uint256 punkIndex) external view returns (address);

  function offerPunkForSaleToAddress(
    uint256 punkIndex,
    uint256 minSalePriceInWei,
    address toAddress
  ) external;

  function transferPunk(address to, uint256 punkIndex) external;
}

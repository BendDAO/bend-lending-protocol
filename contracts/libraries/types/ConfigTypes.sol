// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

library ConfigTypes {
  struct InitReserveInput {
    address bTokenImpl;
    address debtTokenImpl;
    uint8 underlyingAssetDecimals;
    address interestRateAddress;
    address underlyingAsset;
    address treasury;
    string underlyingAssetName;
    string bTokenName;
    string bTokenSymbol;
    string debtTokenName;
    string debtTokenSymbol;
  }

  struct InitNftInput {
    address underlyingAsset;
  }

  struct ConfigNftInput {
    address asset;
    uint256 baseLTV;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    uint256 redeemDuration;
    uint256 auctionDuration;
    uint256 redeemFine;
    uint256 redeemThreshold;
    uint256 minBidFine;
    uint256 maxSupply;
    uint256 maxTokenId;
    uint256 maxCollateralCap;
  }

  struct UpdateBTokenInput {
    address asset;
    address implementation;
    bytes encodedCallData;
  }

  struct UpdateDebtTokenInput {
    address asset;
    address implementation;
    bytes encodedCallData;
  }
}

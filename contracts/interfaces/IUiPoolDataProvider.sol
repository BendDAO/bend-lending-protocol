// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ILendPoolAddressesProvider} from "./ILendPoolAddressesProvider.sol";
import {IIncentivesController} from "./IIncentivesController.sol";

interface IUiPoolDataProvider {
  struct AggregatedReserveData {
    address underlyingAsset;
    string name;
    string symbol;
    uint256 decimals;
    uint256 reserveFactor;
    bool borrowingEnabled;
    bool isActive;
    bool isFrozen;
    // base data
    uint128 liquidityIndex;
    uint128 variableBorrowIndex;
    uint128 liquidityRate;
    uint128 variableBorrowRate;
    uint40 lastUpdateTimestamp;
    address bTokenAddress;
    address debtTokenAddress;
    address interestRateAddress;
    //
    uint256 availableLiquidity;
    uint256 totalScaledVariableDebt;
    uint256 priceInEth;
    uint256 variableRateSlope1;
    uint256 variableRateSlope2;
    // incentives
    uint256 bEmissionPerSecond;
    uint256 vEmissionPerSecond;
    uint256 bIncentivesLastUpdateTimestamp;
    uint256 vIncentivesLastUpdateTimestamp;
    uint256 bTokenIncentivesIndex;
    uint256 vTokenIncentivesIndex;
  }

  struct UserReserveData {
    address underlyingAsset;
    uint256 scaledBTokenBalance;
    uint256 scaledVariableDebt;
    // incentives
    uint256 bTokenincentivesUserIndex;
    uint256 vTokenincentivesUserIndex;
  }

  struct AggregatedNftData {
    address underlyingAsset;
    string name;
    string symbol;
    uint256 ltv;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    bool isActive;
    bool isFrozen;
    address bNftAddress;
    uint256 priceInEth;
    uint256 totalCollateral;
  }

  struct UserNftData {
    address underlyingAsset;
    address bNftAddress;
    uint256 TotalCollateral;
  }

  struct IncentivesControllerData {
    uint256 userUnclaimedRewards;
    uint256 emissionEndTimestamp;
  }

  struct AggregatedLoanData {
    uint256 totalCollateralETH;
    uint256 totalDebtETH;
    uint256 availableBorrowsETH;
    uint256 ltv;
    uint256 liquidationThreshold;
    uint256 loanId;
    uint256 healthFactor;
  }

  function incentivesController() external view returns (IIncentivesController);

  function getReservesList(ILendPoolAddressesProvider provider) external view returns (address[] memory);

  function getSimpleReservesData(ILendPoolAddressesProvider provider)
    external
    view
    returns (
      AggregatedReserveData[] memory,
      uint256 // emission end timestamp
    );

  function getUserReservesData(ILendPoolAddressesProvider provider, address user)
    external
    view
    returns (
      UserReserveData[] memory,
      uint256 // user unclaimed rewards
    );

  // generic method with full data
  function getReservesData(ILendPoolAddressesProvider provider, address user)
    external
    view
    returns (
      AggregatedReserveData[] memory,
      UserReserveData[] memory,
      IncentivesControllerData memory
    );

  function getNftsList(ILendPoolAddressesProvider provider) external view returns (address[] memory);

  function getSimpleNftsData(ILendPoolAddressesProvider provider) external view returns (AggregatedNftData[] memory);

  function getUserNftsData(ILendPoolAddressesProvider provider, address user)
    external
    view
    returns (UserNftData[] memory);

  // generic method with full data
  function getNftsData(ILendPoolAddressesProvider provider, address user)
    external
    view
    returns (AggregatedNftData[] memory, UserNftData[] memory);

  function getSimpleLoansData(
    ILendPoolAddressesProvider provider,
    address[] memory nftAssets,
    uint256[] memory nftTokenIds
  ) external view returns (AggregatedLoanData[] memory);
}

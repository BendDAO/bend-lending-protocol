// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";
import {IERC721Detailed} from "../interfaces/IERC721Detailed.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IIncentivesController} from "../interfaces/IIncentivesController.sol";
import {IUiPoolDataProvider} from "../interfaces/IUiPoolDataProvider.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {IReserveOracleGetter} from "../interfaces/IReserveOracleGetter.sol";
import {INFTOracleGetter} from "../interfaces/INFTOracleGetter.sol";
import {IBToken} from "../interfaces/IBToken.sol";
import {IDebtToken} from "../interfaces/IDebtToken.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";
import {ReserveConfiguration} from "../libraries/configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../libraries/configuration/NftConfiguration.sol";
import {UserConfiguration} from "../libraries/configuration/UserConfiguration.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {InterestRate} from "../protocol/InterestRate.sol";

contract UiPoolDataProvider is IUiPoolDataProvider {
  using WadRayMath for uint256;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using NftConfiguration for DataTypes.NftConfigurationMap;
  using UserConfiguration for DataTypes.UserConfigurationMap;

  IIncentivesController public immutable override incentivesController;
  IReserveOracleGetter public immutable reserveOracle;
  INFTOracleGetter public immutable nftOracle;

  constructor(
    IIncentivesController _incentivesController,
    IReserveOracleGetter _reserveOracle,
    INFTOracleGetter _nftOracle
  ) {
    incentivesController = _incentivesController;
    reserveOracle = _reserveOracle;
    nftOracle = _nftOracle;
  }

  function getInterestRateStrategySlopes(InterestRate interestRate) internal view returns (uint256, uint256) {
    return (interestRate.variableRateSlope1(), interestRate.variableRateSlope2());
  }

  function getReservesList(ILendPoolAddressesProvider provider) public view override returns (address[] memory) {
    ILendPool lendPool = ILendPool(provider.getLendPool());
    return lendPool.getReservesList();
  }

  function getSimpleReservesData(ILendPoolAddressesProvider provider)
    public
    view
    override
    returns (AggregatedReserveData[] memory, uint256)
  {
    ILendPool lendPool = ILendPool(provider.getLendPool());
    address[] memory reserves = lendPool.getReservesList();
    AggregatedReserveData[] memory reservesData = new AggregatedReserveData[](reserves.length);

    for (uint256 i = 0; i < reserves.length; i++) {
      AggregatedReserveData memory reserveData = reservesData[i];
      reserveData.underlyingAsset = reserves[i];

      // reserve current state
      DataTypes.ReserveData memory baseData = lendPool.getReserveData(reserveData.underlyingAsset);
      reserveData.liquidityIndex = baseData.liquidityIndex;
      reserveData.variableBorrowIndex = baseData.variableBorrowIndex;
      reserveData.liquidityRate = baseData.currentLiquidityRate;
      reserveData.variableBorrowRate = baseData.currentVariableBorrowRate;
      reserveData.lastUpdateTimestamp = baseData.lastUpdateTimestamp;
      reserveData.bTokenAddress = baseData.bTokenAddress;
      reserveData.debtTokenAddress = baseData.debtTokenAddress;
      reserveData.interestRateAddress = baseData.interestRateAddress;
      reserveData.priceInEth = reserveOracle.getAssetPrice(reserveData.underlyingAsset);

      reserveData.availableLiquidity = IERC20Detailed(reserveData.underlyingAsset).balanceOf(reserveData.bTokenAddress);
      reserveData.totalScaledVariableDebt = IDebtToken(reserveData.debtTokenAddress).scaledTotalSupply();

      // reserve configuration
      reserveData.symbol = IERC20Detailed(reserveData.underlyingAsset).symbol();
      reserveData.name = IERC20Detailed(reserveData.underlyingAsset).name();

      (, , , reserveData.decimals, reserveData.reserveFactor) = baseData.configuration.getParamsMemory();
      (reserveData.isActive, reserveData.isFrozen, reserveData.borrowingEnabled, ) = baseData
        .configuration
        .getFlagsMemory();
      (reserveData.variableRateSlope1, reserveData.variableRateSlope2) = getInterestRateStrategySlopes(
        InterestRate(reserveData.interestRateAddress)
      );

      // incentives
      if (address(0) != address(incentivesController)) {
        (
          reserveData.bTokenIncentivesIndex,
          reserveData.bEmissionPerSecond,
          reserveData.bIncentivesLastUpdateTimestamp
        ) = incentivesController.getAssetData(reserveData.bTokenAddress);

        (
          reserveData.vTokenIncentivesIndex,
          reserveData.vEmissionPerSecond,
          reserveData.vIncentivesLastUpdateTimestamp
        ) = incentivesController.getAssetData(reserveData.debtTokenAddress);
      }
    }

    uint256 emissionEndTimestamp;
    if (address(0) != address(incentivesController)) {
      emissionEndTimestamp = incentivesController.DISTRIBUTION_END();
    }

    return (reservesData, emissionEndTimestamp);
  }

  function getUserReservesData(ILendPoolAddressesProvider provider, address user)
    external
    view
    override
    returns (UserReserveData[] memory, uint256)
  {
    ILendPool lendPool = ILendPool(provider.getLendPool());
    address[] memory reserves = lendPool.getReservesList();
    DataTypes.UserConfigurationMap memory userConfig = lendPool.getUserConfiguration(user);

    UserReserveData[] memory userReservesData = new UserReserveData[](user != address(0) ? reserves.length : 0);

    for (uint256 i = 0; i < reserves.length; i++) {
      DataTypes.ReserveData memory baseData = lendPool.getReserveData(reserves[i]);
      // incentives
      if (address(0) != address(incentivesController)) {
        userReservesData[i].bTokenincentivesUserIndex = incentivesController.getUserAssetData(
          user,
          baseData.bTokenAddress
        );
        userReservesData[i].vTokenincentivesUserIndex = incentivesController.getUserAssetData(
          user,
          baseData.debtTokenAddress
        );
      }
      // user reserve data
      userReservesData[i].underlyingAsset = reserves[i];
      userReservesData[i].scaledBTokenBalance = IBToken(baseData.bTokenAddress).scaledBalanceOf(user);

      if (userConfig.isReserveBorrowing(i)) {
        userReservesData[i].scaledVariableDebt = IDebtToken(baseData.debtTokenAddress).scaledBalanceOf(user);
      }
    }

    uint256 userUnclaimedRewards;
    if (address(0) != address(incentivesController)) {
      userUnclaimedRewards = incentivesController.getUserUnclaimedRewards(user);
    }

    return (userReservesData, userUnclaimedRewards);
  }

  function getReservesData(ILendPoolAddressesProvider provider, address user)
    external
    view
    override
    returns (
      AggregatedReserveData[] memory,
      UserReserveData[] memory,
      IncentivesControllerData memory
    )
  {
    ILendPool lendPool = ILendPool(provider.getLendPool());
    address[] memory reserves = lendPool.getReservesList();
    DataTypes.UserConfigurationMap memory userConfig = lendPool.getUserConfiguration(user);

    AggregatedReserveData[] memory reservesData = new AggregatedReserveData[](reserves.length);
    UserReserveData[] memory userReservesData = new UserReserveData[](user != address(0) ? reserves.length : 0);

    for (uint256 i = 0; i < reserves.length; i++) {
      AggregatedReserveData memory reserveData = reservesData[i];
      reserveData.underlyingAsset = reserves[i];

      // reserve current state
      DataTypes.ReserveData memory baseData = lendPool.getReserveData(reserveData.underlyingAsset);
      reserveData.liquidityIndex = baseData.liquidityIndex;
      reserveData.variableBorrowIndex = baseData.variableBorrowIndex;
      reserveData.liquidityRate = baseData.currentLiquidityRate;
      reserveData.variableBorrowRate = baseData.currentVariableBorrowRate;
      reserveData.lastUpdateTimestamp = baseData.lastUpdateTimestamp;
      reserveData.bTokenAddress = baseData.bTokenAddress;
      reserveData.debtTokenAddress = baseData.debtTokenAddress;
      reserveData.interestRateAddress = baseData.interestRateAddress;
      reserveData.priceInEth = reserveOracle.getAssetPrice(reserveData.underlyingAsset);

      reserveData.availableLiquidity = IERC20Detailed(reserveData.underlyingAsset).balanceOf(reserveData.bTokenAddress);
      reserveData.totalScaledVariableDebt = IDebtToken(reserveData.debtTokenAddress).scaledTotalSupply();

      // reserve configuration
      reserveData.symbol = IERC20Detailed(reserveData.underlyingAsset).symbol();
      reserveData.name = IERC20Detailed(reserveData.underlyingAsset).name();

      (, , , reserveData.decimals, reserveData.reserveFactor) = baseData.configuration.getParamsMemory();
      (reserveData.isActive, reserveData.isFrozen, reserveData.borrowingEnabled, ) = baseData
        .configuration
        .getFlagsMemory();
      (reserveData.variableRateSlope1, reserveData.variableRateSlope2) = getInterestRateStrategySlopes(
        InterestRate(reserveData.interestRateAddress)
      );

      // incentives
      if (address(0) != address(incentivesController)) {
        (
          reserveData.bTokenIncentivesIndex,
          reserveData.bEmissionPerSecond,
          reserveData.bIncentivesLastUpdateTimestamp
        ) = incentivesController.getAssetData(reserveData.bTokenAddress);

        (
          reserveData.vTokenIncentivesIndex,
          reserveData.vEmissionPerSecond,
          reserveData.vIncentivesLastUpdateTimestamp
        ) = incentivesController.getAssetData(reserveData.debtTokenAddress);
      }

      if (user != address(0)) {
        // incentives
        if (address(0) != address(incentivesController)) {
          userReservesData[i].bTokenincentivesUserIndex = incentivesController.getUserAssetData(
            user,
            reserveData.bTokenAddress
          );
          userReservesData[i].vTokenincentivesUserIndex = incentivesController.getUserAssetData(
            user,
            reserveData.debtTokenAddress
          );
        }
        // user reserve data
        userReservesData[i].underlyingAsset = reserveData.underlyingAsset;
        userReservesData[i].scaledBTokenBalance = IBToken(reserveData.bTokenAddress).scaledBalanceOf(user);

        if (userConfig.isReserveBorrowing(i)) {
          userReservesData[i].scaledVariableDebt = IDebtToken(reserveData.debtTokenAddress).scaledBalanceOf(user);
        }
      }
    }

    IncentivesControllerData memory incentivesControllerData;

    if (address(0) != address(incentivesController)) {
      if (user != address(0)) {
        incentivesControllerData.userUnclaimedRewards = incentivesController.getUserUnclaimedRewards(user);
      }
      incentivesControllerData.emissionEndTimestamp = incentivesController.DISTRIBUTION_END();
    }

    return (reservesData, userReservesData, incentivesControllerData);
  }

  function getNftsList(ILendPoolAddressesProvider provider) external view override returns (address[] memory) {
    ILendPool lendPool = ILendPool(provider.getLendPool());
    return lendPool.getNftsList();
  }

  function getSimpleNftsData(ILendPoolAddressesProvider provider)
    external
    view
    override
    returns (AggregatedNftData[] memory)
  {
    ILendPool lendPool = ILendPool(provider.getLendPool());
    ILendPoolLoan lendPoolLoan = ILendPoolLoan(provider.getLendPoolLoan());
    address[] memory nfts = lendPool.getNftsList();
    AggregatedNftData[] memory nftsData = new AggregatedNftData[](nfts.length);

    for (uint256 i = 0; i < nfts.length; i++) {
      AggregatedNftData memory nftData = nftsData[i];

      DataTypes.NftData memory baseData = lendPool.getNftData(nfts[i]);

      _fillNftData(nftData, nfts[i], baseData, lendPoolLoan);
    }

    return (nftsData);
  }

  function getUserNftsData(ILendPoolAddressesProvider provider, address user)
    external
    view
    override
    returns (UserNftData[] memory)
  {
    ILendPool lendPool = ILendPool(provider.getLendPool());
    ILendPoolLoan lendPoolLoan = ILendPoolLoan(provider.getLendPoolLoan());
    address[] memory nfts = lendPool.getNftsList();

    UserNftData[] memory userNftsData = new UserNftData[](user != address(0) ? nfts.length : 0);

    for (uint256 i = 0; i < nfts.length; i++) {
      UserNftData memory userNftData = userNftsData[i];

      DataTypes.NftData memory baseData = lendPool.getNftData(nfts[i]);

      _fillUserNftData(userNftData, user, nfts[i], baseData, lendPoolLoan);
    }

    return (userNftsData);
  }

  // generic method with full data
  function getNftsData(ILendPoolAddressesProvider provider, address user)
    external
    view
    override
    returns (AggregatedNftData[] memory, UserNftData[] memory)
  {
    ILendPool lendPool = ILendPool(provider.getLendPool());
    ILendPoolLoan lendPoolLoan = ILendPoolLoan(provider.getLendPoolLoan());
    address[] memory nfts = lendPool.getNftsList();

    AggregatedNftData[] memory nftsData = new AggregatedNftData[](nfts.length);
    UserNftData[] memory userNftsData = new UserNftData[](user != address(0) ? nfts.length : 0);

    for (uint256 i = 0; i < nfts.length; i++) {
      AggregatedNftData memory nftData = nftsData[i];
      UserNftData memory userNftData = userNftsData[i];

      DataTypes.NftData memory baseData = lendPool.getNftData(nfts[i]);

      _fillNftData(nftData, nfts[i], baseData, lendPoolLoan);
      if (user != address(0)) {
        _fillUserNftData(userNftData, user, nfts[i], baseData, lendPoolLoan);
      }
    }

    return (nftsData, userNftsData);
  }

  function _fillNftData(
    AggregatedNftData memory nftData,
    address nftAsset,
    DataTypes.NftData memory baseData,
    ILendPoolLoan lendPoolLoan
  ) internal view {
    nftData.underlyingAsset = nftAsset;

    // nft current state
    nftData.bNftAddress = baseData.bNftAddress;
    nftData.priceInEth = nftOracle.getAssetPrice(nftData.underlyingAsset);

    nftData.totalCollateral = lendPoolLoan.getNftCollateralAmount(nftAsset);

    // nft configuration
    nftData.symbol = IERC721Detailed(nftData.underlyingAsset).symbol();
    nftData.name = IERC721Detailed(nftData.underlyingAsset).name();

    (nftData.ltv, nftData.liquidationThreshold, nftData.liquidationBonus) = baseData.configuration.getParamsMemory();
    (nftData.isActive, nftData.isFrozen) = baseData.configuration.getFlagsMemory();
  }

  function _fillUserNftData(
    UserNftData memory userNftData,
    address user,
    address nftAsset,
    DataTypes.NftData memory baseData,
    ILendPoolLoan lendPoolLoan
  ) internal view {
    userNftData.underlyingAsset = nftAsset;

    // user nft data
    userNftData.bNftAddress = baseData.bNftAddress;

    userNftData.TotalCollateral = lendPoolLoan.getUserNftCollateralAmount(user, nftAsset);
  }
}

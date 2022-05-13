// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";
import {IERC721Detailed} from "../interfaces/IERC721Detailed.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {IDebtToken} from "../interfaces/IDebtToken.sol";
import {ReserveConfiguration} from "../libraries/configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../libraries/configuration/NftConfiguration.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

contract BendProtocolDataProvider {
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using NftConfiguration for DataTypes.NftConfigurationMap;

  address constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  struct ReserveTokenData {
    string tokenSymbol;
    address tokenAddress;
    string bTokenSymbol;
    address bTokenAddress;
    string debtTokenSymbol;
    address debtTokenAddress;
  }

  struct NftTokenData {
    string nftSymbol;
    address nftAddress;
    string bNftSymbol;
    address bNftAddress;
  }

  ILendPoolAddressesProvider public immutable ADDRESSES_PROVIDER;

  constructor(ILendPoolAddressesProvider addressesProvider) {
    ADDRESSES_PROVIDER = addressesProvider;
  }

  function getAllReservesTokenDatas() external view returns (ReserveTokenData[] memory) {
    ILendPool pool = ILendPool(ADDRESSES_PROVIDER.getLendPool());
    address[] memory reserves = pool.getReservesList();
    ReserveTokenData[] memory reservesTokens = new ReserveTokenData[](reserves.length);
    for (uint256 i = 0; i < reserves.length; i++) {
      DataTypes.ReserveData memory reserveData = pool.getReserveData(reserves[i]);
      reservesTokens[i] = ReserveTokenData({
        tokenSymbol: IERC20Detailed(reserves[i]).symbol(),
        tokenAddress: reserves[i],
        bTokenSymbol: IERC20Detailed(reserveData.bTokenAddress).symbol(),
        bTokenAddress: reserveData.bTokenAddress,
        debtTokenSymbol: IERC20Detailed(reserveData.debtTokenAddress).symbol(),
        debtTokenAddress: reserveData.debtTokenAddress
      });
    }
    return reservesTokens;
  }

  function getReserveTokenData(address asset) external view returns (ReserveTokenData memory) {
    ILendPool pool = ILendPool(ADDRESSES_PROVIDER.getLendPool());
    DataTypes.ReserveData memory reserveData = pool.getReserveData(asset);
    return
      ReserveTokenData({
        tokenSymbol: IERC20Detailed(asset).symbol(),
        tokenAddress: asset,
        bTokenSymbol: IERC20Detailed(reserveData.bTokenAddress).symbol(),
        bTokenAddress: reserveData.bTokenAddress,
        debtTokenSymbol: IERC20Detailed(reserveData.debtTokenAddress).symbol(),
        debtTokenAddress: reserveData.debtTokenAddress
      });
  }

  function getAllNftsTokenDatas() external view returns (NftTokenData[] memory) {
    ILendPool pool = ILendPool(ADDRESSES_PROVIDER.getLendPool());
    address[] memory nfts = pool.getNftsList();
    NftTokenData[] memory nftTokens = new NftTokenData[](nfts.length);
    for (uint256 i = 0; i < nfts.length; i++) {
      DataTypes.NftData memory nftData = pool.getNftData(nfts[i]);
      nftTokens[i] = NftTokenData({
        nftSymbol: IERC721Detailed(nfts[i]).symbol(),
        nftAddress: nfts[i],
        bNftSymbol: IERC721Detailed(nftData.bNftAddress).symbol(),
        bNftAddress: nftData.bNftAddress
      });
    }
    return nftTokens;
  }

  function getNftTokenData(address nftAsset) external view returns (NftTokenData memory) {
    ILendPool pool = ILendPool(ADDRESSES_PROVIDER.getLendPool());
    DataTypes.NftData memory nftData = pool.getNftData(nftAsset);
    return
      NftTokenData({
        nftSymbol: IERC20Detailed(nftAsset).symbol(),
        nftAddress: nftAsset,
        bNftSymbol: IERC20Detailed(nftData.bNftAddress).symbol(),
        bNftAddress: nftData.bNftAddress
      });
  }

  function getReserveConfigurationData(address asset)
    external
    view
    returns (
      uint256 decimals,
      uint256 reserveFactor,
      bool borrowingEnabled,
      bool isActive,
      bool isFrozen
    )
  {
    DataTypes.ReserveConfigurationMap memory configuration = ILendPool(ADDRESSES_PROVIDER.getLendPool())
      .getReserveConfiguration(asset);

    (, , , decimals, reserveFactor) = configuration.getParamsMemory();

    (isActive, isFrozen, borrowingEnabled, ) = configuration.getFlagsMemory();
  }

  struct NftConfigurationData {
    uint256 ltv;
    uint256 liquidationThreshold;
    uint256 liquidationBonus;
    uint256 redeemDuration;
    uint256 auctionDuration;
    uint256 redeemFine;
    uint256 redeemThreshold;
    uint256 minBidFine;
    bool isActive;
    bool isFrozen;
  }

  function getNftConfigurationData(address asset) external view returns (NftConfigurationData memory configData) {
    DataTypes.NftConfigurationMap memory configuration = ILendPool(ADDRESSES_PROVIDER.getLendPool())
      .getNftConfiguration(asset);

    (configData.ltv, configData.liquidationThreshold, configData.liquidationBonus) = configuration
      .getCollateralParamsMemory();
    (
      configData.redeemDuration,
      configData.auctionDuration,
      configData.redeemFine,
      configData.redeemThreshold
    ) = configuration.getAuctionParamsMemory();

    (configData.isActive, configData.isFrozen) = configuration.getFlagsMemory();

    (configData.minBidFine) = configuration.getMinBidFineMemory();
  }

  function getReserveData(address asset)
    external
    view
    returns (
      uint256 availableLiquidity,
      uint256 totalVariableDebt,
      uint256 liquidityRate,
      uint256 variableBorrowRate,
      uint256 liquidityIndex,
      uint256 variableBorrowIndex,
      uint40 lastUpdateTimestamp
    )
  {
    DataTypes.ReserveData memory reserve = ILendPool(ADDRESSES_PROVIDER.getLendPool()).getReserveData(asset);

    return (
      IERC20Detailed(asset).balanceOf(reserve.bTokenAddress),
      IERC20Detailed(reserve.debtTokenAddress).totalSupply(),
      reserve.currentLiquidityRate,
      reserve.currentVariableBorrowRate,
      reserve.liquidityIndex,
      reserve.variableBorrowIndex,
      reserve.lastUpdateTimestamp
    );
  }

  function getUserReserveData(address asset, address user)
    external
    view
    returns (
      uint256 currentBTokenBalance,
      uint256 currentVariableDebt,
      uint256 scaledVariableDebt,
      uint256 liquidityRate
    )
  {
    DataTypes.ReserveData memory reserve = ILendPool(ADDRESSES_PROVIDER.getLendPool()).getReserveData(asset);

    currentBTokenBalance = IERC20Detailed(reserve.bTokenAddress).balanceOf(user);
    currentVariableDebt = IERC20Detailed(reserve.debtTokenAddress).balanceOf(user);
    scaledVariableDebt = IDebtToken(reserve.debtTokenAddress).scaledBalanceOf(user);
    liquidityRate = reserve.currentLiquidityRate;
  }

  struct LoanData {
    uint256 loanId;
    uint8 state;
    address borrower;
    address nftAsset;
    uint256 nftTokenId;
    address reserveAsset;
    uint256 scaledAmount;
    uint256 currentAmount;
    uint256 bidStartTimestamp;
    address bidderAddress;
    uint256 bidPrice;
    uint256 bidBorrowAmount;
  }

  function getLoanDataByCollateral(address nftAsset, uint256 nftTokenId)
    external
    view
    returns (LoanData memory loanData)
  {
    loanData.loanId = ILendPoolLoan(ADDRESSES_PROVIDER.getLendPoolLoan()).getCollateralLoanId(nftAsset, nftTokenId);
    DataTypes.LoanData memory loan = ILendPoolLoan(ADDRESSES_PROVIDER.getLendPoolLoan()).getLoan(loanData.loanId);
    _fillLoanData(loanData, loan);
  }

  function getLoanDataByLoanId(uint256 loanId) external view returns (LoanData memory loanData) {
    DataTypes.LoanData memory loan = ILendPoolLoan(ADDRESSES_PROVIDER.getLendPoolLoan()).getLoan(loanId);
    _fillLoanData(loanData, loan);
  }

  function _fillLoanData(LoanData memory loanData, DataTypes.LoanData memory loan) internal view {
    loanData.loanId = loan.loanId;
    loanData.state = uint8(loan.state);
    loanData.borrower = loan.borrower;
    loanData.nftAsset = loan.nftAsset;
    loanData.nftTokenId = loan.nftTokenId;
    loanData.reserveAsset = loan.reserveAsset;
    loanData.scaledAmount = loan.scaledAmount;
    (, loanData.currentAmount) = ILendPoolLoan(ADDRESSES_PROVIDER.getLendPoolLoan()).getLoanReserveBorrowAmount(
      loan.loanId
    );
    loanData.bidStartTimestamp = loan.bidStartTimestamp;
    loanData.bidderAddress = loan.bidderAddress;
    loanData.bidPrice = loan.bidPrice;
    loanData.bidBorrowAmount = loan.bidBorrowAmount;
  }
}

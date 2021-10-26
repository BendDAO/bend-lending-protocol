// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";
import {IERC721Detailed} from "../interfaces/IERC721Detailed.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ReserveConfiguration} from "../libraries/configuration/ReserveConfiguration.sol";
import {NftConfiguration} from "../libraries/configuration/NftConfiguration.sol";
import {UserConfiguration} from "../libraries/configuration/UserConfiguration.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

import "hardhat/console.sol";

contract BendProtocolDataProvider {
    using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
    using NftConfiguration for DataTypes.NftConfigurationMap;
    using UserConfiguration for DataTypes.UserConfigurationMap;

    address constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    struct TokenData {
        string symbol;
        address tokenAddress;
    }

    struct NftData {
        string symbol;
        address nftAddress;
    }

    ILendPoolAddressesProvider public immutable ADDRESSES_PROVIDER;

    constructor(ILendPoolAddressesProvider addressesProvider) {
        ADDRESSES_PROVIDER = addressesProvider;
    }

    function getAllReservesTokens() external view returns (TokenData[] memory) {
        ILendPool pool = ILendPool(ADDRESSES_PROVIDER.getLendPool());
        address[] memory reserves = pool.getReservesList();
        TokenData[] memory reservesTokens = new TokenData[](reserves.length);
        for (uint256 i = 0; i < reserves.length; i++) {
            if (reserves[i] == ETH) {
                reservesTokens[i] = TokenData({
                    symbol: "ETH",
                    tokenAddress: reserves[i]
                });
                continue;
            }
            reservesTokens[i] = TokenData({
                symbol: IERC20Detailed(reserves[i]).symbol(),
                tokenAddress: reserves[i]
            });
        }
        return reservesTokens;
    }

    function getAllNftsTokens() external view returns (NftData[] memory) {
        ILendPool pool = ILendPool(ADDRESSES_PROVIDER.getLendPool());
        address[] memory nfts = pool.getNftsList();
        NftData[] memory nftTokens = new NftData[](nfts.length);
        for (uint256 i = 0; i < nfts.length; i++) {
            nftTokens[i] = NftData({
                symbol: IERC721Detailed(nfts[i]).symbol(),
                nftAddress: nfts[i]
            });
        }
        return nftTokens;
    }

    function getAllBTokens() external view returns (TokenData[] memory) {
        ILendPool pool = ILendPool(ADDRESSES_PROVIDER.getLendPool());
        address[] memory reserves = pool.getReservesList();
        TokenData[] memory bTokens = new TokenData[](reserves.length);
        for (uint256 i = 0; i < reserves.length; i++) {
            DataTypes.ReserveData memory reserveData = pool.getReserveData(
                reserves[i]
            );
            bTokens[i] = TokenData({
                symbol: IERC20Detailed(reserveData.bTokenAddress).symbol(),
                tokenAddress: reserveData.bTokenAddress
            });
        }
        return bTokens;
    }

    function getAllBNfts() external view returns (NftData[] memory) {
        ILendPool pool = ILendPool(ADDRESSES_PROVIDER.getLendPool());
        address[] memory nfts = pool.getNftsList();
        NftData[] memory bNfts = new NftData[](nfts.length);
        for (uint256 i = 0; i < nfts.length; i++) {
            DataTypes.NftData memory nftData = pool.getNftData(nfts[i]);
            bNfts[i] = NftData({
                symbol: IERC721Detailed(nftData.bNftAddress).symbol(),
                nftAddress: nftData.bNftAddress
            });
        }
        return bNfts;
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
        DataTypes.ReserveConfigurationMap memory configuration = ILendPool(
            ADDRESSES_PROVIDER.getLendPool()
        ).getReserveConfiguration(asset);

        (, , , decimals, reserveFactor) = configuration.getParamsMemory();

        (isActive, isFrozen, borrowingEnabled, ) = configuration
            .getFlagsMemory();
    }

    function getNftConfigurationData(address asset)
        external
        view
        returns (
            uint256 ltv,
            uint256 liquidationThreshold,
            uint256 liquidationBonus,
            bool isActive,
            bool isFrozen
        )
    {
        DataTypes.NftConfigurationMap memory configuration = ILendPool(
            ADDRESSES_PROVIDER.getLendPool()
        ).getNftConfiguration(asset);

        (ltv, liquidationThreshold, liquidationBonus) = configuration
            .getParamsMemory();

        (isActive, isFrozen) = configuration.getFlagsMemory();
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
        DataTypes.ReserveData memory reserve = ILendPool(
            ADDRESSES_PROVIDER.getLendPool()
        ).getReserveData(asset);

        return (
            IERC20Detailed(asset).balanceOf(reserve.bTokenAddress),
            ILendPoolLoan(ADDRESSES_PROVIDER.getLendPoolLoan())
                .getReserveBorrowAmount(asset),
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
        DataTypes.ReserveData memory reserve = ILendPool(
            ADDRESSES_PROVIDER.getLendPool()
        ).getReserveData(asset);

        currentBTokenBalance = IERC20Detailed(reserve.bTokenAddress).balanceOf(
            user
        );
        currentVariableDebt = ILendPoolLoan(
            ADDRESSES_PROVIDER.getLendPoolLoan()
        ).getUserReserveBorrowAmount(user, asset);
        scaledVariableDebt = ILendPoolLoan(ADDRESSES_PROVIDER.getLendPoolLoan())
            .getUserReserveBorrowScaledAmount(user, asset);
        liquidityRate = reserve.currentLiquidityRate;
    }

    function getReserveTokensAddresses(address asset)
        external
        view
        returns (address bTokenAddress)
    {
        DataTypes.ReserveData memory reserve = ILendPool(
            ADDRESSES_PROVIDER.getLendPool()
        ).getReserveData(asset);

        return (reserve.bTokenAddress);
    }

    function getNftTokensAddresses(address asset)
        external
        view
        returns (address bNftAddress)
    {
        DataTypes.NftData memory reserve = ILendPool(
            ADDRESSES_PROVIDER.getLendPool()
        ).getNftData(asset);

        return (reserve.bNftAddress);
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
    }

    function getLoanDataByCollateral(address nftAsset, uint256 nftTokenId)
        external
        view
        returns (LoanData memory loanData)
    {
        loanData.loanId = ILendPoolLoan(ADDRESSES_PROVIDER.getLendPoolLoan())
            .getCollateralLoanId(nftAsset, nftTokenId);
        if (loanData.loanId != 0) {
            DataTypes.LoanData memory data = ILendPoolLoan(
                ADDRESSES_PROVIDER.getLendPoolLoan()
            ).getLoan(loanData.loanId);
            loanData.state = uint8(data.state);
            loanData.borrower = data.borrower;
            loanData.nftAsset = data.nftAsset;
            loanData.nftTokenId = data.nftTokenId;
            loanData.reserveAsset = data.reserveAsset;
            loanData.scaledAmount = data.scaledAmount;
            loanData.currentAmount = ILendPoolLoan(
                ADDRESSES_PROVIDER.getLendPoolLoan()
            ).getLoanReserveBorrowAmount(loanData.loanId);
        }
    }

    function getLoanDataByLoanId(uint256 loanId)
        external
        view
        returns (LoanData memory loanData)
    {
        DataTypes.LoanData memory data = ILendPoolLoan(
            ADDRESSES_PROVIDER.getLendPoolLoan()
        ).getLoan(loanId);
        loanData.loanId = loanId;
        loanData.state = uint8(data.state);
        loanData.borrower = data.borrower;
        loanData.nftAsset = data.nftAsset;
        loanData.nftTokenId = data.nftTokenId;
        loanData.reserveAsset = data.reserveAsset;
        loanData.scaledAmount = data.scaledAmount;
        loanData.currentAmount = ILendPoolLoan(
            ADDRESSES_PROVIDER.getLendPoolLoan()
        ).getLoanReserveBorrowAmount(loanId);
    }
}

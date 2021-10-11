// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface ILendPoolConfigurator {
    struct InitReserveInput {
        address wTokenImpl;
        address nftLoanImpl;
        uint8 underlyingAssetDecimals;
        address interestRateAddress;
        address underlyingAsset;
        address treasury;
        address incentivesController;
        address nftLoanAddress;
        string underlyingAssetName;
        string wTokenName;
        string wTokenSymbol;
        bytes params;
    }

    struct InitNftInput {
        address underlyingAsset;
        address nftLoanAddress;
        bytes params;
    }

    struct UpdateWTokenInput {
        address asset;
        address treasury;
        address incentivesController;
        string name;
        string symbol;
        address implementation;
        bytes params;
    }

    /**
     * @dev Emitted when a reserve is initialized.
     * @param asset The address of the underlying asset of the reserve
     * @param wToken The address of the associated aToken contract
     * @param nftLoanToken The address of the associated nft loan token
     * @param interestRateAddress The address of the interest rate strategy for the reserve
     **/
    event ReserveInitialized(
        address indexed asset,
        address indexed wToken,
        address nftLoanToken,
        address interestRateAddress
    );

    /**
     * @dev Emitted when borrowing is enabled on a reserve
     * @param asset The address of the underlying asset of the reserve
     **/
    event BorrowingEnabledOnReserve(address indexed asset);

    /**
     * @dev Emitted when borrowing is disabled on a reserve
     * @param asset The address of the underlying asset of the reserve
     **/
    event BorrowingDisabledOnReserve(address indexed asset);

    /**
     * @dev Emitted when a reserve is activated
     * @param asset The address of the underlying asset of the reserve
     **/
    event ReserveActivated(address indexed asset);

    /**
     * @dev Emitted when a reserve is deactivated
     * @param asset The address of the underlying asset of the reserve
     **/
    event ReserveDeactivated(address indexed asset);

    /**
     * @dev Emitted when a reserve is frozen
     * @param asset The address of the underlying asset of the reserve
     **/
    event ReserveFrozen(address indexed asset);

    /**
     * @dev Emitted when a reserve is unfrozen
     * @param asset The address of the underlying asset of the reserve
     **/
    event ReserveUnfrozen(address indexed asset);

    /**
     * @dev Emitted when a reserve factor is updated
     * @param asset The address of the underlying asset of the reserve
     * @param factor The new reserve factor
     **/
    event ReserveFactorChanged(address indexed asset, uint256 factor);

    /**
     * @dev Emitted when the reserve decimals are updated
     * @param asset The address of the underlying asset of the reserve
     * @param decimals The new decimals
     **/
    event ReserveDecimalsChanged(address indexed asset, uint256 decimals);

    /**
     * @dev Emitted when a reserve interest strategy contract is updated
     * @param asset The address of the underlying asset of the reserve
     * @param strategy The new address of the interest strategy contract
     **/
    event ReserveInterestRateChanged(address indexed asset, address strategy);

    /**
     * @dev Emitted when a nft is initialized.
     * @param asset The address of the underlying asset of the nft
     * @param nftLoanToken The address of the associated nft loan token
     **/
    event NftInitialized(address indexed asset, address nftLoanToken);

    /**
     * @dev Emitted when the collateralization risk parameters for the specified NFT are updated.
     * @param asset The address of the underlying asset of the NFT
     * @param ltv The loan to value of the asset when used as NFT
     * @param liquidationThreshold The threshold at which loans using this asset as NFT will be considered undercollateralized
     * @param liquidationBonus The bonus liquidators receive to liquidate this asset
     **/
    event NftConfigurationChanged(
        address indexed asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    );

    /**
     * @dev Emitted when a NFT is activated
     * @param asset The address of the underlying asset of the NFT
     **/
    event NftActivated(address indexed asset);

    /**
     * @dev Emitted when a NFT is deactivated
     * @param asset The address of the underlying asset of the NFT
     **/
    event NftDeactivated(address indexed asset);

    /**
     * @dev Emitted when a NFT is frozen
     * @param asset The address of the underlying asset of the NFT
     **/
    event NftFrozen(address indexed asset);

    /**
     * @dev Emitted when a NFT is unfrozen
     * @param asset The address of the underlying asset of the NFT
     **/
    event NftUnfrozen(address indexed asset);

    /**
     * @dev Emitted when an aToken implementation is upgraded
     * @param asset The address of the underlying asset of the reserve
     * @param proxy The aToken proxy address
     * @param implementation The new aToken implementation
     **/
    event WTokenUpgraded(
        address indexed asset,
        address indexed proxy,
        address indexed implementation
    );

    /**
     * @dev Emitted when the implementation of a nft loan token is upgraded
     * @param asset The address of the underlying asset of the reserve
     * @param proxy The nft loan token proxy address
     * @param implementation The new nft loan implementation
     **/
    event NFTLoanTokenUpgraded(
        address indexed asset,
        address indexed proxy,
        address indexed implementation
    );
}

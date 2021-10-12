// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

library DataTypes {
    // refer to the whitepaper, section 1.1 basic concepts for a formal description of these properties.
    struct ReserveData {
        //stores the reserve configuration
        ReserveConfigurationMap configuration;
        //the liquidity index. Expressed in ray
        uint128 liquidityIndex;
        //variable borrow index. Expressed in ray
        uint128 variableBorrowIndex;
        //the current supply rate. Expressed in ray
        uint128 currentLiquidityRate;
        //the current variable borrow rate. Expressed in ray
        uint128 currentVariableBorrowRate;
        uint40 lastUpdateTimestamp;
        //tokens addresses
        address bTokenAddress;
        //address of the interest rate strategy
        address interestRateAddress;
        //address of the nft loan
        address nftLoanAddress;
        //the id of the reserve. Represents the position in the list of the active reserves
        uint8 id;
    }

    struct NftData {
        //stores the nft configuration
        NftConfigurationMap configuration;
        //address of the nft loan
        address nftLoanAddress;
        //the id of the nft. Represents the position in the list of the active nfts
        uint8 id;
    }

    struct ReserveConfigurationMap {
        //bit 0-15: LTV
        //bit 16-31: Liq. threshold
        //bit 32-47: Liq. bonus
        //bit 48-55: Decimals
        //bit 56: Reserve is active
        //bit 57: reserve is frozen
        //bit 58: borrowing is enabled
        //bit 59: stable rate borrowing enabled
        //bit 60-63: reserved
        //bit 64-79: reserve factor
        uint256 data;
    }

    struct UserConfigurationMap {
        uint256 reserveData;
        uint256 nftData;
    }

    struct NftConfigurationMap {
        //bit 0-15: LTV
        //bit 16-31: Liq. threshold
        //bit 32-47: Liq. bonus
        //bit 56: NFT is active
        //bit 57: NFT is frozen
        uint256 data;
    }

    struct LoanData {
        //the id of the nft loan, ERC721 Token ID also.
        uint256 loanId;
        //address of nft contract
        address nftContract;
        //the id of nft token
        uint256 nftTokenId;
        //address of reserve asset token
        address reserveAsset;
        //scaled borrow amount. Expressed in ray
        uint256 scaledAmount;
    }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {Errors} from "../helpers/Errors.sol";
import {DataTypes} from "../types/DataTypes.sol";

/**
 * @title UserConfiguration library
 * @author NFTLend
 * @notice Implements the bitmap logic to handle the user configuration
 */
library UserConfiguration {
    uint256 internal constant BORROWING_MASK =
        0x5555555555555555555555555555555555555555555555555555555555555555;

    uint256 internal constant PLEDGING_MASK =
        0x5555555555555555555555555555555555555555555555555555555555555555;

    /**
     * @dev Sets if the user is borrowing the reserve identified by reserveIndex
     * @param self The configuration object
     * @param reserveIndex The index of the reserve in the bitmap
     * @param borrowing True if the user is borrowing the reserve, false otherwise
     **/
    function setReserveBorrowing(
        DataTypes.UserConfigurationMap storage self,
        uint256 reserveIndex,
        bool borrowing
    ) internal {
        require(reserveIndex < 128, Errors.UL_INVALID_INDEX);
        self.reserveData =
            (self.reserveData & ~(1 << (reserveIndex * 2))) |
            (uint256(borrowing ? 1 : 0) << (reserveIndex * 2));
    }

    /**
     * @dev Sets if the user is using as collateral the reserve identified by reserveIndex
     * @param self The configuration object
     * @param reserveIndex The index of the reserve in the bitmap
     * @param usingAsCollateral True if the user is usin the reserve as collateral, false otherwise
     **/
    function setUsingReserveAsCollateral(
        DataTypes.UserConfigurationMap storage self,
        uint256 reserveIndex,
        bool usingAsCollateral
    ) internal {
        require(reserveIndex < 128, Errors.UL_INVALID_INDEX);
        self.reserveData =
            (self.reserveData & ~(1 << (reserveIndex * 2 + 1))) |
            (uint256(usingAsCollateral ? 1 : 0) << (reserveIndex * 2 + 1));
    }

    /**
     * @dev Used to validate if a user has been using the reserve for borrowing or as collateral
     * @param self The configuration object
     * @param reserveIndex The index of the reserve in the bitmap
     * @return True if the user has been using a reserve for borrowing or as collateral, false otherwise
     **/
    function isUsingReserveAsCollateralOrBorrowing(
        DataTypes.UserConfigurationMap memory self,
        uint256 reserveIndex
    ) internal pure returns (bool) {
        require(reserveIndex < 128, Errors.UL_INVALID_INDEX);
        return (self.reserveData >> (reserveIndex * 2)) & 3 != 0;
    }

    /**
     * @dev Used to validate if a user has been using the reserve for borrowing
     * @param self The configuration object
     * @param reserveIndex The index of the reserve in the bitmap
     * @return True if the user has been using a reserve for borrowing, false otherwise
     **/
    function isReserveBorrowing(
        DataTypes.UserConfigurationMap memory self,
        uint256 reserveIndex
    ) internal pure returns (bool) {
        require(reserveIndex < 128, Errors.UL_INVALID_INDEX);
        return (self.reserveData >> (reserveIndex * 2)) & 1 != 0;
    }

    /**
     * @dev Used to validate if a user has been using the reserve as collateral
     * @param self The configuration object
     * @param reserveIndex The index of the reserve in the bitmap
     * @return True if the user has been using a reserve as collateral, false otherwise
     **/
    function isUsingReserveAsCollateral(
        DataTypes.UserConfigurationMap memory self,
        uint256 reserveIndex
    ) internal pure returns (bool) {
        require(reserveIndex < 128, Errors.UL_INVALID_INDEX);
        return (self.reserveData >> (reserveIndex * 2 + 1)) & 1 != 0;
    }

    /**
     * @dev Used to validate if a user has been borrowing from any reserve
     * @param self The configuration object
     * @return True if the user has been borrowing any reserve, false otherwise
     **/
    function isReserveBorrowingAny(DataTypes.UserConfigurationMap memory self)
        internal
        pure
        returns (bool)
    {
        return self.reserveData & BORROWING_MASK != 0;
    }

    /**
     * @dev Used to validate if a user has not been using any reserve
     * @param self The configuration object
     * @return True if the user has been borrowing any reserve, false otherwise
     **/
    function isReserveEmpty(DataTypes.UserConfigurationMap memory self)
        internal
        pure
        returns (bool)
    {
        return self.reserveData == 0;
    }

    /**
     * @dev Sets if the user is using as collateral the nft identified by nftIndex
     * @param self The configuration object
     * @param nftIndex The index of the nft in the bitmap
     * @param usingAsCollateral True if the user is usin the nft as collateral, false otherwise
     **/
    function setUsingNftAsCollateral(
        DataTypes.UserConfigurationMap storage self,
        uint256 nftIndex,
        bool usingAsCollateral
    ) internal {
        require(nftIndex < 128, Errors.UL_INVALID_INDEX);
        self.nftData =
            (self.nftData & ~(1 << (nftIndex * 2 + 1))) |
            (uint256(usingAsCollateral ? 1 : 0) << (nftIndex * 2 + 1));
    }

    /**
     * @dev Used to validate if a user has been using the nft as collateral
     * @param self The configuration object
     * @param nftIndex The index of the nft in the bitmap
     * @return True if the user has been using a nft as collateral, false otherwise
     **/
    function isUsingNftAsCollateral(
        DataTypes.UserConfigurationMap memory self,
        uint256 nftIndex
    ) internal pure returns (bool) {
        require(nftIndex < 128, Errors.UL_INVALID_INDEX);
        return (self.nftData >> (nftIndex * 2 + 1)) & 1 != 0;
    }

    /**
     * @dev Used to validate if a user has not been using any nft
     * @param self The configuration object
     * @return True if the user has been borrowing any nft, false otherwise
     **/
    function isNftEmpty(DataTypes.UserConfigurationMap memory self)
        internal
        pure
        returns (bool)
    {
        return self.nftData == 0;
    }

    /**
     * @dev Used to validate if a user has not been using any reserve and nft
     * @param self The configuration object
     * @return True if the user has been borrowing any reserve and nft, false otherwise
     **/
    function isEmpty(DataTypes.UserConfigurationMap memory self)
        internal
        pure
        returns (bool)
    {
        return self.reserveData == 0 && self.nftData == 0;
    }
}

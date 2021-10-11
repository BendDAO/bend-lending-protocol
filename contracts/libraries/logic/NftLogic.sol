// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {Errors} from "../helpers/Errors.sol";
import {DataTypes} from "../types/DataTypes.sol";

/**
 * @title NftLogic library
 * @author NFTLend
 * @notice Implements the logic to update the nft state
 */
library NftLogic {
    /**
     * @dev Initializes a nft
     * @param nft The nft object
     * @param nftLoanAddress The address of the nft loan contract
     **/
    function init(DataTypes.NftData storage nft, address nftLoanAddress)
        external
    {
        require(
            nft.nftLoanAddress == address(0),
            Errors.RL_RESERVE_ALREADY_INITIALIZED
        );

        nft.nftLoanAddress = nftLoanAddress;
    }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IBNFT is IERC721Upgradeable {
    /**
     * @dev Emitted when an bNFT is initialized
     * @param underlyingAsset The address of the underlying asset
     * @param params A set of encoded parameters for additional initialization
     **/
    event Initialized(address indexed underlyingAsset, bytes params);

    /**
     * @dev Emitted on mint
     * @param nftContract address of the underlying asset of NFT
     * @param nftTokenId token id of the underlying asset of NFT
     **/
    event Mint(
        address indexed user,
        address indexed nftContract,
        uint256 nftTokenId
    );

    /**
     * @dev Emitted on burn
     * @param user The address initiating the burn
     * @param nftContract address of the underlying asset of NFT
     * @param nftTokenId token id of the underlying asset of NFT
     **/
    event Burn(
        address indexed user,
        address indexed nftContract,
        uint256 nftTokenId
    );

    function mint(uint256 nftTokenId) external;

    function burn(uint256 nftTokenId) external;
}

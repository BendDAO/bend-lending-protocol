// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";

interface IBNFT is IERC721Upgradeable, IERC721MetadataUpgradeable {
    /**
     * @dev Emitted when an bNFT is initialized
     * @param underlyingAsset The address of the underlying asset
     * @param params A set of encoded parameters for additional initialization
     **/
    event Initialized(address indexed underlyingAsset, bytes params);

    /**
     * @dev Emitted on mint
     * @param nftAsset address of the underlying asset of NFT
     * @param nftTokenId token id of the underlying asset of NFT
     **/
    event Mint(
        address indexed user,
        address indexed nftAsset,
        uint256 nftTokenId
    );

    /**
     * @dev Emitted on burn
     * @param user The address initiating the burn
     * @param nftAsset address of the underlying asset of NFT
     * @param nftTokenId token id of the underlying asset of NFT
     **/
    event Burn(
        address indexed user,
        address indexed nftAsset,
        uint256 nftTokenId
    );

    /**
     * @dev Initializes the bNFT
     * @param underlyingAsset The address of the underlying asset of this bNFT (E.g. PUNK for bPUNK)
     */
    function initialize(
        address underlyingAsset,
        string calldata bNftName,
        string calldata bNftSymbol,
        bytes calldata params
    ) external;

    function mint(uint256 nftTokenId) external;

    function burn(uint256 nftTokenId) external;
}

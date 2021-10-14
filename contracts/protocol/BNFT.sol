// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IBNFT} from "../interfaces/IBNFT.sol";

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {IERC721MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";

/**
 * @title BNFT contract
 * @dev Implements the methods for the bNFT protocol
 **/
contract BNFT is IBNFT, ERC721Upgradeable {
    address internal _underlyingAsset;

    /**
     * @dev Initializes the bNFT
     * @param underlyingAsset The address of the underlying asset of this bNFT (E.g. PUNK for bPUNK)
     */
    function initialize(
        address underlyingAsset,
        string calldata bNftName,
        string calldata bNftSymbol,
        bytes calldata params
    ) external initializer {
        __ERC721_init(bNftName, bNftSymbol);

        _underlyingAsset = underlyingAsset;

        emit Initialized(underlyingAsset, params);
    }

    /**
     * @dev Mints bNFT token to the user address
     * @param tokenId token id of the underlying asset of NFT
     **/
    function mint(uint256 tokenId) external override {
        require(
            IERC721Upgradeable(_underlyingAsset).ownerOf(tokenId) ==
                _msgSender(),
            "BNFT: callers is not owner"
        );

        // Receive NFT Tokens
        IERC721Upgradeable(_underlyingAsset).transferFrom(
            _msgSender(),
            address(this),
            tokenId
        );

        // mint bNFT to user
        _mint(_msgSender(), tokenId);

        emit Mint(_msgSender(), _underlyingAsset, tokenId);
    }

    /**
     * @dev Burns user bNFT token
     * @param tokenId token id of the underlying asset of NFT
     **/
    function burn(uint256 tokenId) external override {
        require(_exists(tokenId), "BNFT: nonexist token");
        require(ownerOf(tokenId) == _msgSender(), "BNFT: callers is not owner");

        IERC721Upgradeable(_underlyingAsset).transferFrom(
            address(this),
            _msgSender(),
            tokenId
        );

        _burn(tokenId);

        emit Burn(_msgSender(), _underlyingAsset, tokenId);
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        return IERC721MetadataUpgradeable(_underlyingAsset).tokenURI(tokenId);
    }

    /**
     * @dev Being non transferrable, the bNFT token does not implement any of the
     * standard ERC721 functions for transfer and allowance.
     **/
    function approve(address to, uint256 tokenId)
        public
        virtual
        override(ERC721Upgradeable, IERC721Upgradeable)
    {
        to;
        tokenId;
        revert("APPROVAL_NOT_SUPPORTED");
    }

    function setApprovalForAll(address operator, bool approved)
        public
        virtual
        override(ERC721Upgradeable, IERC721Upgradeable)
    {
        operator;
        approved;
        revert("APPROVAL_NOT_SUPPORTED");
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override(ERC721Upgradeable, IERC721Upgradeable) {
        from;
        to;
        tokenId;
        revert("TRANSFER_NOT_SUPPORTED");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public virtual override(ERC721Upgradeable, IERC721Upgradeable) {
        from;
        to;
        tokenId;
        revert("TRANSFER_NOT_SUPPORTED");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public virtual override(ERC721Upgradeable, IERC721Upgradeable) {
        from;
        to;
        tokenId;
        _data;
        revert("TRANSFER_NOT_SUPPORTED");
    }

    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721Upgradeable) {
        from;
        to;
        tokenId;
        revert("TRANSFER_NOT_SUPPORTED");
    }
}

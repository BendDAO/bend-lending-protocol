// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IBNFTFactory {
    event BNFTCreated(
        address indexed nftAsset,
        address bNftImpl,
        address bNftProxy,
        uint256 totals
    );
    event BNFTUpgraded(
        address indexed nftAsset,
        address bNftImpl,
        address bNftProxy,
        uint256 totals
    );

    function getBNFT(address nftAsset)
        external
        view
        returns (address bNftProxy, address bNftImpl);

    function getBNFTByIndex(uint16 index)
        external
        view
        returns (address bNftProxy, address bNftImpl);

    function getBNFTProxyList() external view returns (address[] memory);

    function allBNFTProxyLength() external view returns (uint256);

    /**
     * @dev Create bNFT proxy and implement, then initialize it
     * @param nftAsset The address of the underlying asset of the BNFT
     * @param params The additional parameters for the initialize
     **/
    function createBNFT(address nftAsset, bytes memory params)
        external
        returns (address bNftProxy);

    /**
     * @dev Create bNFT proxy with already deployed implement, then initialize it
     * @param nftAsset The address of the underlying asset of the BNFT
     * @param bNftImpl The address of the deployed implement of the BNFT
     * @param params The additional parameters for the initialize
     **/
    function createBNFTWithImpl(
        address nftAsset,
        address bNftImpl,
        bytes memory params
    ) external returns (address bNftProxy);

    /**
     * @dev Update bNFT proxy to an new deployed implement, then initialize it
     * @param nftAsset The address of the underlying asset of the BNFT
     * @param bNftImpl The address of the deployed implement of the BNFT
     * @param params The additional parameters for the initialize
     **/
    function upgradeBNFTWithImpl(
        address nftAsset,
        address bNftImpl,
        bytes memory params
    ) external;
}

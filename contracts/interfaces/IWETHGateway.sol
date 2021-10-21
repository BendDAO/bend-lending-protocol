// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IWETHGateway {
    function depositETH(
        address lendPool,
        address onBehalfOf,
        uint16 referralCode
    ) external payable;

    function withdrawETH(
        address lendPool,
        uint256 amount,
        address to
    ) external;

    function borrowETH(
        address lendPool,
        uint256 amount,
        address nftAsset,
        uint256 nftTokenId,
        uint256 loanId,
        uint16 referralCode,
        address to
    ) external;

    function repayETH(
        address lendPool,
        address lendPoolLoan,
        uint256 loanId,
        uint256 amount,
        address onBehalfOf
    ) external payable returns (uint256, bool);
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IWETHGateway {
    function depositETH(address lendPool) external payable;

    function withdrawETH(address lendPool, uint256 amount) external;

    function repayETH(
        address lendPool,
        uint256 loanId,
        uint256 amount
    ) external payable;

    function borrowETH(
        address lendPool,
        uint256 amount,
        address nftAsset,
        uint256 nftTokenId,
        uint256 loanId,
        uint16 referralCode
    ) external;
}

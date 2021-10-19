// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IPunkGateway {
    /**
     * @dev Allows users to borrow a specific `amount` of the reserve underlying asset, provided that the borrower
     * already deposited enough collateral
     * - E.g. User borrows 100 USDC, receiving the 100 USDC in his wallet
     *   and lock collateral asset in contract
     * @param reserveAsset The address of the underlying asset to borrow
     * @param amount The amount to be borrowed
     * @param punkIndex The index of the CryptoPunk to deposit
     * @param loanId The loan ID of the NFT loans
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *   0 if the action is executed directly by the user, without any middle-man
     **/
    function borrow(
        address reserveAsset,
        uint256 amount,
        uint256 punkIndex,
        uint256 loanId,
        uint16 referralCode
    ) external;

    /**
     * @notice Repays a borrowed `amount` on a specific reserve, burning the equivalent loan owned
     * - E.g. User repays 100 USDC, burning loan and receives collateral asset
     * @param loanId The loan ID of the NFT loans
     * @param amount The amount to repay
     * @return The final amount repaid
     **/
    function repay(uint256 loanId, uint256 amount) external returns (uint256);
}

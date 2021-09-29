// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface ILendPool {
    /**
     * @dev Emitted on deposit()
     * @param reserve The address of the underlying asset of the reserve
     * @param user The address initiating the deposit
     * @param amount The amount deposited
     * @param referral The referral code used
     **/
    event Deposit(
        address indexed reserve,
        address user,
        uint256 amount,
        uint16 indexed referral
    );

    /**
     * @dev Emitted on withdraw()
     * @param reserve The address of the underlyng asset being withdrawn
     * @param user The address initiating the withdrawal, owner of aTokens
     * @param to Address that will receive the underlying
     * @param amount The amount to be withdrawn
     **/
    event Withdraw(
        address indexed reserve,
        address indexed user,
        address indexed to,
        uint256 amount
    );

    /**
     * @dev Emitted on borrow() and flashLoan() when debt needs to be opened
     * @param reserve The address of the underlying asset being borrowed
     * @param user The address of the user initiating the borrow(), receiving the funds on borrow() or just
     * initiator of the transaction on flashLoan()
     * @param amount The amount borrowed out
     * @param collateralAsset The address of the underlying asset used as collateral
     * @param tokenId The token id of the underlying asset used as collateral
     * @param referral The referral code used
     **/
    event Borrow(
        address indexed reserve,
        address user,
        uint256 amount,
        address collateralAsset,
        uint256 tokenId,
        uint16 indexed referral
    );

    /**
     * @dev Emitted on repay()
     * @param collateralAsset The address of the underlying asset used as collateral
     * @param tokenId The token ID of the underlying asset used as collateral
     * @param reserve The address of the underlying asset of the reserve
     * @param user The beneficiary of the repayment, getting his debt reduced
     * @param repayer The address of the user initiating the repay(), providing the funds
     * @param amount The amount repaid
     **/
    event Repay(
        address indexed collateralAsset,
        uint256 tokenId,
        address indexed reserve,
        address indexed user,
        address repayer,
        uint256 amount
    );

    /**
     * @dev Emitted when a borrower is liquidated. This event is emitted by the LendingPool via
     * LendingPoolCollateral manager using a DELEGATECALL
     * This allows to have the events in the generated ABI for LendingPool.
     * @param collateralAsset The address of the underlying asset used as collateral
     * @param tokenId The token ID of the underlying asset used as collateral
     * @param user The address of the borrower getting liquidated
     * @param reserve The address of the underlying asset of the reserve
     * @param repayAmount The amount of WToken repaid by the liquidator
     * @param returnToBorrowerAmount The amount of WToken received by the borrower
     * @param liquidator The address of the liquidator
     **/
    event Liquidate(
        address indexed collateralAsset,
        uint256 tokenId,
        address indexed user,
        address indexed reserve,
        uint256 repayAmount,
        uint256 returnToBorrowerAmount,
        address liquidator
    );

    /**
     * @dev Emitted when the pause is triggered.
     */
    event Paused();

    /**
     * @dev Emitted when the pause is lifted.
     */
    event Unpaused();

    /**
     * @dev Emitted when the state of a reserve is updated. NOTE: This event is actually declared
     * in the ReserveLogic library and emitted in the updateInterestRates() function. Since the function is internal,
     * the event will actually be fired by the LendingPool contract. The event is therefore replicated here so it
     * gets added to the LendingPool ABI
     * @param reserve The address of the underlying asset of the reserve
     * @param liquidityRate The new liquidity rate
     * @param variableBorrowRate The new variable borrow rate
     * @param liquidityIndex The new liquidity index
     * @param variableBorrowIndex The new variable borrow index
     **/
    event ReserveDataUpdated(
        address indexed reserve,
        uint256 liquidityRate,
        uint256 variableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex
    );

    /**
     * @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
     * - E.g. User deposits 100 USDC and gets in return 100 aUSDC
     * @param asset The address of the underlying asset to deposit
     * @param amount The amount to be deposited
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *   0 if the action is executed directly by the user, without any middle-man
     **/
    function deposit(
        address asset,
        uint256 amount,
        uint16 referralCode
    ) external;

    /**
     * @dev Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
     * E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
     * @param asset The address of the underlying asset to withdraw
     * @param amount The underlying amount to be withdrawn
     *   - Send the value type(uint256).max in order to withdraw the whole aToken balance
     * @param to Address that will receive the underlying, same as msg.sender if the user
     *   wants to receive it on his own wallet, or a different address if the beneficiary is a
     *   different wallet
     * @return The final amount withdrawn
     **/
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /**
     * @dev Allows users to borrow a specific `amount` of the reserve underlying asset, provided that the borrower
     * already deposited enough collateral
     * - E.g. User borrows 100 USDC, receiving the 100 USDC in his wallet
     *   and lock collateral asset in contract
     * @param asset The address of the underlying asset to borrow
     * @param amount The amount to be borrowed
     * @param collateralAsset The address of the underlying asset used as collateral
     * @param tokenId The token ID of the underlying asset used as collateral
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *   0 if the action is executed directly by the user, without any middle-man
     **/
    function borrow(
        address asset,
        uint256 amount,
        address collateralAsset,
        uint256 tokenId,
        uint16 referralCode
    ) external;

    /**
     * @notice Repays a borrowed `amount` on a specific reserve, burning the equivalent loan owned
     * - E.g. User repays 100 USDC, burning loan and receives collateral asset
     * @param collateralAsset The address of the underlying asset used as collateral
     * @param tokenId The token ID of the underlying asset used as collateral
     * @param amount The amount to repay
     * @return The final amount repaid
     **/
    function repay(
        address collateralAsset,
        uint256 tokenId,
        uint256 amount
    ) external returns (uint256);

    /**
     * @dev Function to liquidate a non-healthy position collateral-wise
     * - The caller (liquidator) buy collateral asset of the user getting liquidated, and receives
     *   the collateral asset
     * @param collateralAsset The address of the underlying asset used as collateral
     * @param tokenId The token ID of the underlying borrowed asset
     * @param user The address of the borrower getting liquidated
     **/
    function liquidate(
        address collateralAsset,
        uint256 tokenId,
        address user
    ) external;

    function setPause(bool val) external;

    function paused() external view returns (bool);
}

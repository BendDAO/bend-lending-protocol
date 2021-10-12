// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ILendPoolAddressesProvider} from "./ILendPoolAddressesProvider.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

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
     * @param user The address initiating the withdrawal, owner of bTokens
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
     * @param nftAsset The address of the underlying NFT used as collateral
     * @param nftTokenId The token id of the underlying NFT used as collateral
     * @param loanId The loan ID of the NFT loans
     * @param referral The referral code used
     **/
    event Borrow(
        address indexed reserve,
        address indexed user,
        uint256 amount,
        address nftAsset,
        uint256 nftTokenId,
        uint256 loanId,
        uint256 borrowRate,
        uint16 indexed referral
    );

    /**
     * @dev Emitted on repay()
     * @param loanId The loan ID of the NFT loans
     * @param reserve The address of the underlying asset of the reserve
     * @param user The beneficiary of the repayment, getting his debt reduced
     * @param repayer The address of the user initiating the repay(), providing the funds
     * @param amount The amount repaid
     **/
    event Repay(
        uint256 indexed loanId,
        address indexed reserve,
        address indexed user,
        address repayer,
        uint256 amount
    );

    /**
     * @dev Emitted when a borrower is liquidated. This event is emitted by the LendingPool via
     * LendingPoolCollateral manager using a DELEGATECALL
     * This allows to have the events in the generated ABI for LendingPool.
     * @param loanId The loan ID of the NFT loans
     * @param user The address of the borrower getting liquidated
     * @param reserve The address of the underlying asset of the reserve
     * @param repayAmount The amount of bToken repaid by the liquidator
     * @param borrowerAmount The amount of bToken received by the borrower
     * @param liquidator The address of the liquidator
     **/
    event Liquidate(
        uint256 indexed loanId,
        address indexed user,
        address indexed reserve,
        uint256 repayAmount,
        uint256 borrowerAmount,
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
     * @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying bTokens.
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
     * @dev Withdraws an `amount` of underlying asset from the reserve, burning the equivalent bTokens owned
     * E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
     * @param asset The address of the underlying asset to withdraw
     * @param amount The underlying amount to be withdrawn
     *   - Send the value type(uint256).max in order to withdraw the whole bToken balance
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
     * @param nftAsset The address of the underlying NFT used as collateral
     * @param nftTokenId The token ID of the underlying NFT used as collateral
     * @param loanId The loan ID of the NFT loans
     * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
     *   0 if the action is executed directly by the user, without any middle-man
     **/
    function borrow(
        address asset,
        uint256 amount,
        address nftAsset,
        uint256 nftTokenId,
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

    /**
     * @dev Function to liquidate a non-healthy position collateral-wise
     * - The caller (liquidator) buy collateral asset of the user getting liquidated, and receives
     *   the collateral asset
     * @param loanId The loan ID of the NFT loans
     **/
    function liquidate(uint256 loanId) external;

    /**
     * @dev Validates and finalizes an bToken transfer
     * - Only callable by the overlying bToken of the `asset`
     * @param asset The address of the underlying asset of the bToken
     * @param from The user from which the bTokens are transferred
     * @param to The user receiving the bTokens
     * @param amount The amount being transferred/withdrawn
     * @param balanceFromBefore The bToken balance of the `from` user before the transfer
     * @param balanceToBefore The bToken balance of the `to` user before the transfer
     */
    function finalizeTransfer(
        address asset,
        address from,
        address to,
        uint256 amount,
        uint256 balanceFromBefore,
        uint256 balanceToBefore
    ) external;

    function getReserveConfiguration(address asset)
        external
        view
        returns (DataTypes.ReserveConfigurationMap memory);

    function getUserConfiguration(address user)
        external
        view
        returns (DataTypes.UserConfigurationMap memory);

    function getNftConfiguration(address asset)
        external
        view
        returns (DataTypes.NftConfigurationMap memory);

    /**
     * @dev Returns the normalized income normalized income of the reserve
     * @param asset The address of the underlying asset of the reserve
     * @return The reserve's normalized income
     */
    function getReserveNormalizedIncome(address asset)
        external
        view
        returns (uint256);

    /**
     * @dev Returns the normalized variable debt per unit of asset
     * @param asset The address of the underlying asset of the reserve
     * @return The reserve normalized variable debt
     */
    function getReserveNormalizedVariableDebt(address asset)
        external
        view
        returns (uint256);

    /**
     * @dev Returns the state and configuration of the reserve
     * @param asset The address of the underlying asset of the reserve
     * @return The state of the reserve
     **/
    function getReserveData(address asset)
        external
        view
        returns (DataTypes.ReserveData memory);

    function getReservesList() external view returns (address[] memory);

    function getNftData(address asset)
        external
        view
        returns (DataTypes.NftData memory);

    function getNftsList() external view returns (address[] memory);

    /**
     * @dev Set the _pause state of a reserve
     * - Only callable by the LendingPoolConfigurator contract
     * @param val `true` to pause the reserve, `false` to un-pause it
     */
    function setPause(bool val) external;

    /**
     * @dev Returns if the LendingPool is paused
     */
    function paused() external view returns (bool);

    function getAddressesProvider()
        external
        view
        returns (ILendPoolAddressesProvider);

    function initReserve(
        address asset,
        address bTokenAddress,
        address nftLoanAddress,
        address interestRateAddress
    ) external;

    function initNft(address asset, address nftLoanAddress) external;

    function setReserveInterestRateAddress(address asset, address rateAddress)
        external;

    function setNftLoanAddress(address asset, address loanAddress) external;

    function setReserveConfiguration(address asset, uint256 configuration)
        external;

    function setNftConfiguration(address asset, uint256 configuration) external;
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {DataTypes} from "../libraries/types/DataTypes.sol";

interface ILendPoolLoan {
    /**
     * @dev Emitted on initialization to share location of dependent notes
     */
    event Initialized();

    /**
     * @dev Emitted when a loan is created
     */
    event LoanCreated(
        address indexed user,
        address nftAsset,
        uint256 nftTokenId,
        address reserveAsset,
        uint256 amount,
        uint256 borrowIndex
    );

    /**
     * @dev Emitted when a loan is updated
     */
    event LoanUpdated(
        address indexed user,
        uint256 indexed loanId,
        address reserveAsset,
        uint256 amountAdded,
        uint256 amountTaken,
        uint256 borrowIndex
    );

    /**
     * @dev Emitted when a loan is repaid by the borrower
     */
    event LoanRepaid(
        address indexed user,
        uint256 indexed loanId,
        address nftAsset,
        uint256 nftTokenId,
        address reserveAsset,
        uint256 amount
    );

    /**
     * @dev Emitted when a loan is liquidate by the liquidator
     */
    event LoanLiquidated(
        address indexed user,
        uint256 indexed loanId,
        address nftAsset,
        uint256 nftTokenId,
        address reserveAsset,
        uint256 amount
    );

    /**
     * @dev Create store a loan object with some params
     */
    function createLoan(
        address nftAsset,
        uint256 nftTokenId,
        address bNftAddress,
        address reserveAsset,
        uint256 amount,
        uint256 borrowIndex
    ) external returns (uint256);

    /**
     * @dev Update the given loan with some params
     *
     * Requirements:
     *  - The caller must be a holder of the loan
     *  - The loan must be in state Active
     */
    function updateLoan(
        address user,
        uint256 loanId,
        uint256 amountAdded,
        uint256 amountTaken,
        uint256 borrowIndex
    ) external;

    /**
     * @dev Repay the given loan
     *
     * Requirements:
     *  - The caller must be a holder of the loan
     *  - The caller must send in principal + interest
     *  - The loan must be in state Active
     */
    function repayLoan(
        address user,
        uint256 loanId,
        address bNftAddress
    ) external;

    /**
     * @dev Liquidate the given loan
     *
     * Requirements:
     *  - The caller must send in principal + interest
     *  - The loan must be in state Active
     */
    function liquidateLoan(
        address user,
        uint256 loanId,
        address bNftAddress
    ) external;

    function getLoan(uint256 loanId)
        external
        view
        returns (DataTypes.LoanData calldata loanData);

    function getLoanReserve(uint256 loanId) external view returns (address);

    function getLoanReserveBorrowScaledAmount(uint256 loanId)
        external
        view
        returns (uint256);

    function getLoanReserveBorrowAmount(uint256 loanId)
        external
        view
        returns (uint256);

    function getLoanCollateral(uint256 loanId)
        external
        view
        returns (address, uint256);

    function getReserveBorrowScaledAmount(address reserveAsset)
        external
        view
        returns (uint256);

    function getUserReserveBorrowScaledAmount(
        address user,
        address reserveAsset
    ) external view returns (uint256);

    function getUserReserveBorrowAmount(address user, address reserveAsset)
        external
        view
        returns (uint256);

    function getUserNftCollateralAmount(address user, address nftAsset)
        external
        view
        returns (uint256);
}

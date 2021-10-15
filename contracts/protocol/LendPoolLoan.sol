// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {IBNFT} from "../interfaces/IBNFT.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";

import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

contract LendPoolLoan is Initializable, ILendPoolLoan, ContextUpgradeable {
    using WadRayMath for uint256;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    ILendPool private _pool;

    CountersUpgradeable.Counter private _loanIdTracker;
    mapping(uint256 => DataTypes.LoanData) private _loans;

    // scaled total borrow amount. Expressed in ray
    mapping(address => uint256) _reserveBorrowScaledAmount;
    // scaled total borrow amount. Expressed in ray
    mapping(address => mapping(address => uint256))
        private _userReserveBorrowScaledAmounts;
    mapping(address => mapping(address => uint256))
        private _userNftCollateralAmounts;

    /**
     * @dev Only lending pool can call functions marked by this modifier
     **/
    modifier onlyLendPool() {
        require(
            _msgSender() == address(_getLendPool()),
            Errors.CT_CALLER_MUST_BE_LENDING_POOL
        );
        _;
    }

    // called once by the factory at time of deployment
    function initialize(address _lendPool) external initializer {
        __Context_init();

        _pool = ILendPool(_lendPool);

        // Avoid having loanId = 0
        _loanIdTracker.increment();
    }

    /**
     * @inheritdoc ILendPoolLoan
     */
    function createLoan(
        address user,
        address nftContract,
        uint256 nftTokenId,
        address bNftAddress,
        address reserveAsset,
        uint256 amount,
        uint256 borrowIndex
    ) external override onlyLendPool returns (uint256) {
        uint256 amountScaled = amount.rayDiv(borrowIndex);

        uint256 loanId = _loanIdTracker.current();
        _loanIdTracker.increment();

        // Receive Collateral Tokens
        IERC721Upgradeable(nftContract).transferFrom(
            _msgSender(),
            address(this),
            nftTokenId
        );

        IBNFT(bNftAddress).mint(nftTokenId);

        // Save Info
        _loans[loanId] = DataTypes.LoanData({
            loanId: loanId,
            state: DataTypes.LoanState.Active,
            nftContract: nftContract,
            nftTokenId: nftTokenId,
            reserveAsset: reserveAsset,
            scaledAmount: amountScaled
        });

        _reserveBorrowScaledAmount[reserveAsset] += _loans[loanId].scaledAmount;

        _userReserveBorrowScaledAmounts[user][reserveAsset] += _loans[loanId]
            .scaledAmount;

        _userNftCollateralAmounts[user][nftContract] += 1;

        emit LoanCreated(
            user,
            nftContract,
            nftTokenId,
            reserveAsset,
            amount,
            borrowIndex
        );

        return (loanId);
    }

    /**
     * @inheritdoc ILendPoolLoan
     */
    function updateLoan(
        address user,
        uint256 loanId,
        uint256 amountAdded,
        uint256 amountTaken,
        uint256 borrowIndex
    ) external override onlyLendPool {
        DataTypes.LoanData memory loan = _loans[loanId];
        // Ensure valid loan state
        require(
            loan.state == DataTypes.LoanState.Active,
            "LendPoolLoan:Invalid loan state"
        );

        uint256 amountScaled = 0;

        if (amountAdded > 0) {
            amountScaled = amountAdded.rayDiv(borrowIndex);
            require(amountScaled != 0, "LendPoolLoan: invalid added amount");

            loan.scaledAmount += amountScaled;

            _reserveBorrowScaledAmount[loan.reserveAsset] += loan.scaledAmount;
            _userReserveBorrowScaledAmounts[user][loan.reserveAsset] += loan
                .scaledAmount;
        }

        if (amountTaken > 0) {
            amountScaled = amountTaken.rayDiv(borrowIndex);
            require(amountScaled != 0, "LendPoolLoan: invalid taken amount");

            require(
                loan.scaledAmount >= amountScaled,
                "LendPoolLoan: taken amount exceeds"
            );
            loan.scaledAmount -= amountScaled;

            require(
                _reserveBorrowScaledAmount[loan.reserveAsset] >=
                    loan.scaledAmount,
                Errors.LP_INVALIED_SCALED_TOTAL_BORROW_AMOUNT
            );
            _reserveBorrowScaledAmount[loan.reserveAsset] -= loan.scaledAmount;

            require(
                _userReserveBorrowScaledAmounts[user][loan.reserveAsset] >=
                    loan.scaledAmount,
                Errors.LP_INVALIED_USER_SCALED_AMOUNT
            );
            _userReserveBorrowScaledAmounts[user][loan.reserveAsset] -= loan
                .scaledAmount;
        }

        emit LoanUpdated(
            user,
            loanId,
            loan.reserveAsset,
            amountAdded,
            amountTaken,
            borrowIndex
        );
    }

    /**
     * @inheritdoc ILendPoolLoan
     */
    function repayLoan(
        address user,
        uint256 loanId,
        address bNftAddress
    ) external override onlyLendPool {
        _terminateLoan(user, loanId, bNftAddress, true);
    }

    /**
     * @inheritdoc ILendPoolLoan
     */
    function liquidateLoan(
        address user,
        uint256 loanId,
        address bNftAddress
    ) external override onlyLendPool {
        _terminateLoan(user, loanId, bNftAddress, false);
    }

    function getLoan(uint256 loanId)
        external
        view
        override
        returns (DataTypes.LoanData memory loanData)
    {
        return _loans[loanId];
    }

    function getLoanReserve(uint256 loanId)
        external
        view
        override
        returns (address)
    {
        return _loans[loanId].reserveAsset;
    }

    function getLoanReserveBorrowAmount(uint256 loanId)
        external
        view
        override
        returns (uint256)
    {
        uint256 scaledAmount = _loans[loanId].scaledAmount;
        if (scaledAmount == 0) {
            return 0;
        }

        return
            scaledAmount.rayMul(
                _pool.getReserveNormalizedVariableDebt(
                    _loans[loanId].reserveAsset
                )
            );
    }

    function getLoanReserveBorrowScaledAmount(uint256 loanId)
        external
        view
        override
        returns (uint256)
    {
        return _loans[loanId].scaledAmount;
    }

    function getLoanCollateral(uint256 loanId)
        external
        view
        override
        returns (address, uint256)
    {
        return (_loans[loanId].nftContract, _loans[loanId].nftTokenId);
    }

    function getReserveBorrowScaledAmount(address reserve)
        external
        view
        override
        returns (uint256)
    {
        return _reserveBorrowScaledAmount[reserve];
    }

    function getUserReserveBorrowScaledAmount(address user, address reserve)
        external
        view
        override
        returns (uint256)
    {
        return _userReserveBorrowScaledAmounts[user][reserve];
    }

    function getUserReserveBorrowAmount(address user, address reserve)
        external
        view
        override
        returns (uint256)
    {
        uint256 scaledAmount = _userReserveBorrowScaledAmounts[user][reserve];
        if (scaledAmount == 0) {
            return 0;
        }

        return
            scaledAmount.rayMul(
                _pool.getReserveNormalizedVariableDebt(reserve)
            );
    }

    function getUserNftCollateralAmount(address user, address nftContract)
        external
        view
        override
        returns (uint256)
    {
        return _userNftCollateralAmounts[user][nftContract];
    }

    function _getLendPool() internal view returns (ILendPool) {
        return _pool;
    }

    function _terminateLoan(
        address user,
        uint256 loanId,
        address bNftAddress,
        bool isRepay
    ) internal {
        DataTypes.LoanData memory loan = _loans[loanId];
        // Ensure valid loan state
        require(
            loan.state == DataTypes.LoanState.Active,
            "LendPoolLoan:Invalid loan state"
        );

        // state changes and cleanup
        // NOTE: these must be performed before assets are released to prevent reentrance
        if (isRepay) {
            _loans[loanId].state = DataTypes.LoanState.Repaid;
        } else {
            _loans[loanId].state = DataTypes.LoanState.Defaulted;
        }

        // Ensure scaled amount is valid
        require(
            _reserveBorrowScaledAmount[loan.reserveAsset] >= loan.scaledAmount,
            Errors.LP_INVALIED_SCALED_TOTAL_BORROW_AMOUNT
        );
        _reserveBorrowScaledAmount[loan.reserveAsset] -= loan.scaledAmount;

        require(
            _userReserveBorrowScaledAmounts[user][loan.reserveAsset] >=
                loan.scaledAmount,
            Errors.LP_INVALIED_USER_SCALED_AMOUNT
        );
        _userReserveBorrowScaledAmounts[user][loan.reserveAsset] -= loan
            .scaledAmount;

        require(
            _userNftCollateralAmounts[user][loan.nftContract] >= 1,
            Errors.LP_INVALIED_USER_NFT_AMOUNT
        );
        _userNftCollateralAmounts[user][loan.nftContract] -= 1;

        // collateral redistribution
        IBNFT(bNftAddress).burn(loan.nftTokenId);

        IERC721Upgradeable(loan.nftContract).transferFrom(
            address(this),
            _msgSender(),
            loan.nftTokenId
        );

        if (isRepay) {
            emit LoanRepaid(
                user,
                loanId,
                loan.nftContract,
                loan.nftTokenId,
                loan.reserveAsset,
                loan.scaledAmount
            );
        } else {
            emit LoanLiquidated(
                user,
                loanId,
                loan.nftContract,
                loan.nftTokenId,
                loan.reserveAsset,
                loan.scaledAmount
            );
        }
    }
}

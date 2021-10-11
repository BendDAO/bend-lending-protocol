// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {INFTLoan} from "../interfaces/INFTLoan.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {Errors} from "../libraries/helpers/Errors.sol";
import {WadRayMath} from "../libraries/math/WadRayMath.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract NFTLoan is Initializable, INFTLoan, ERC721 {
    using WadRayMath for uint256;
    using Counters for Counters.Counter;

    ILendPool private _pool;

    Counters.Counter private _loanIdTracker;
    mapping(uint256 => DataTypes.LoanData) private _loans;
    // scaled total borrow amount. Expressed in ray
    uint256 scaledTotalAmount;

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

    constructor() ERC721("NFTLoan", "NFTL") {}

    // called once by the factory at time of deployment
    function initialize(address _lendPool) external initializer {
        _pool = ILendPool(_lendPool);
    }

    /**
     * @dev Mints loan to the `user` address
     * -  Only callable by the LendingPool
     * @param user The address receiving the loan
     * @param amount The amount of debt being minted
     * @param borrowIndex The variable borrow index of the reserve
     **/
    function mintLoan(
        address user,
        address nftTokenAddress,
        uint256 nftTokenId,
        address assetAddress,
        uint256 amount,
        uint256 borrowIndex
    ) external override onlyLendPool returns (uint256) {
        uint256 amountScaled = amount.rayDiv(borrowIndex);

        uint256 loanId = _loanIdTracker.current();
        _loanIdTracker.increment();

        // Receive Collateral Tokens
        IERC721(nftTokenAddress).transferFrom(
            msg.sender,
            address(this),
            nftTokenId
        );

        // Save Info
        _loans[loanId] = DataTypes.LoanData({
            loanId: loanId,
            nftTokenAddress: nftTokenAddress,
            nftTokenId: nftTokenId,
            assetAddress: assetAddress,
            scaledAmount: amountScaled
        });

        _mint(user, loanId);

        scaledTotalAmount += _loans[loanId].scaledAmount;

        emit MintLoan(
            user,
            nftTokenAddress,
            nftTokenId,
            assetAddress,
            amount,
            borrowIndex
        );

        return (loanId);
    }

    /**
     * @dev Burns user variable debt
     * - Only callable by the LendingPool
     * @param user The user whose debt is getting burned
     * @param loanId The id of loan
     * @param borrowIndex The variable debt index of the reserve
     **/
    function burnLoan(
        address user,
        uint256 loanId,
        uint256 borrowIndex
    ) external override onlyLendPool {
        require(_exists(loanId), "NFTLoan: nonexist loan");

        DataTypes.LoanData memory loan = _loans[loanId];

        IERC721(loan.nftTokenAddress).transferFrom(
            address(this),
            msg.sender,
            loan.nftTokenId
        );

        _burn(loanId);

        require(
            scaledTotalAmount >= loan.scaledAmount,
            Errors.LP_INVALIED_SCALED_TOTAL_BORROW_AMOUNT
        );
        scaledTotalAmount -= loan.scaledAmount;

        delete _loans[loanId];

        emit BurnLoan(
            user,
            loanId,
            loan.nftTokenAddress,
            loan.nftTokenId,
            loan.assetAddress,
            loan.scaledAmount
        );
    }

    function updateLoan(
        address user,
        uint256 loanId,
        uint256 amountAdded,
        uint256 amountTaken,
        uint256 borrowIndex
    ) external override onlyLendPool {
        require(_exists(loanId), "NFTLoan: nonexist loan");

        DataTypes.LoanData memory loan = _loans[loanId];

        uint256 amountScaled = 0;

        if (amountAdded > 0) {
            amountScaled = amountAdded.rayDiv(borrowIndex);
            require(amountScaled != 0, "NFTLoan: invalid added amount");

            loan.scaledAmount += amountScaled;

            scaledTotalAmount += loan.scaledAmount;
        }

        if (amountTaken > 0) {
            amountScaled = amountTaken.rayDiv(borrowIndex);
            require(amountScaled != 0, "NFTLoan: invalid taken amount");

            require(
                loan.scaledAmount >= amountScaled,
                "NFTLoan: taken amount exceeds"
            );
            loan.scaledAmount -= amountScaled;

            require(
                scaledTotalAmount >= loan.scaledAmount,
                Errors.LP_INVALIED_SCALED_TOTAL_BORROW_AMOUNT
            );
            scaledTotalAmount -= loan.scaledAmount;
        }

        emit UpdateLoan(
            user,
            loanId,
            loan.assetAddress,
            amountAdded,
            amountTaken,
            borrowIndex
        );
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
        return _loans[loanId].assetAddress;
    }

    function getLoanAmount(uint256 loanId)
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
                    _loans[loanId].assetAddress
                )
            );
    }

    function getLoanScaledAmount(uint256 loanId)
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
        return (_loans[loanId].nftTokenAddress, _loans[loanId].nftTokenId);
    }

    function getScaledTotalAmount() external view override returns (uint256) {
        return scaledTotalAmount;
    }

    function _getLendPool() internal view returns (ILendPool) {
        return _pool;
    }
}

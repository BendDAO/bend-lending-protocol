// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IPunks} from "../interfaces/IPunks.sol";
import {IWrappedPunks} from "../interfaces/IWrappedPunks.sol";
import {IPunkGateway} from "../interfaces/IPunkGateway.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

contract PunkGateway is Initializable, Ownable, IPunkGateway {
    IPunks public punks;
    IWrappedPunks public wrappedPunks;
    address public proxy;

    constructor(IPunks _punks, IWrappedPunks _wrappedPunks) {
        punks = _punks;
        wrappedPunks = _wrappedPunks;
        wrappedPunks.registerProxy();
        proxy = wrappedPunks.proxyInfo(address(this));
    }

    function borrow(
        address lendPool,
        address reserveAsset,
        uint256 amount,
        uint256 punkIndex,
        uint256 loanId,
        uint16 referralCode
    ) external override {
        address owner = punks.punkIndexToAddress(punkIndex);
        require(owner == _msgSender(), "PunkGateway: not owner");

        punks.buyPunk(punkIndex);
        punks.transferPunk(proxy, punkIndex);

        wrappedPunks.mint(punkIndex);
        wrappedPunks.approve(address(lendPool), punkIndex);

        ILendPool(lendPool).borrow(
            reserveAsset,
            amount,
            address(wrappedPunks),
            punkIndex,
            loanId,
            referralCode
        );
    }

    function repay(
        address lendPool,
        address lendPoolLoan,
        uint256 loanId,
        uint256 amount
    ) external override returns (uint256, bool) {
        DataTypes.LoanData memory loan = ILendPoolLoan(lendPoolLoan).getLoan(
            loanId
        );
        (uint256 paybackAmount, bool isUpdate) = ILendPool(lendPool).repay(
            loanId,
            amount
        );

        if (!isUpdate) {
            address owner = wrappedPunks.ownerOf(loan.nftTokenId);
            require(owner == address(this), "PunkGateway: invalid owner");

            wrappedPunks.burn(loan.nftTokenId);
            punks.transferPunk(_msgSender(), loan.nftTokenId);
        }

        return (paybackAmount, isUpdate);
    }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IPunks} from "../interfaces/IPunks.sol";
import {IWrappedPunks} from "../interfaces/IWrappedPunks.sol";
import {IPunkGateway} from "../interfaces/IPunkGateway.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";

contract PunkGateway is Initializable, ContextUpgradeable, IPunkGateway {
    ILendPoolAddressesProvider public addressProvider;
    IPunks public punks;
    IWrappedPunks public wrappedPunks;
    address public proxy;

    function initialize(
        ILendPoolAddressesProvider _addressProvider,
        IPunks _punks,
        IWrappedPunks _wrappedPunks
    ) external initializer {
        __Context_init();

        addressProvider = _addressProvider;
        punks = _punks;
        wrappedPunks = _wrappedPunks;
        wrappedPunks.registerProxy();
        proxy = wrappedPunks.proxyInfo(address(this));
    }

    function borrow(
        address reserveAsset,
        uint256 amount,
        uint256 punkIndex,
        uint256 loanId,
        uint16 referralCode
    ) external override {
        address owner = punks.punkIndexToAddress(punkIndex);
        require(owner == _msgSender(), "PunkGateway: not owner");

        ILendPool lendPool = ILendPool(addressProvider.getLendPool());
        require(address(lendPool) != address(0), "PunkGateway: no LendPool");

        punks.buyPunk(punkIndex);
        punks.transferPunk(proxy, punkIndex);

        wrappedPunks.mint(punkIndex);
        wrappedPunks.approve(address(lendPool), punkIndex);

        lendPool.borrow(
            reserveAsset,
            amount,
            address(wrappedPunks),
            punkIndex,
            loanId,
            referralCode
        );
    }

    function repay(uint256 loanId, uint256 amount)
        external
        override
        returns (uint256, bool)
    {
        ILendPool lendPool = ILendPool(addressProvider.getLendPool());
        require(address(lendPool) != address(0), "PunkGateway: no LendPool");
        ILendPoolLoan lendPoolLoan = ILendPoolLoan(
            addressProvider.getLendPoolLoan()
        );
        require(
            address(lendPoolLoan) != address(0),
            "PunkGateway: no LendPoolLoan"
        );

        DataTypes.LoanData memory loan = lendPoolLoan.getLoan(loanId);
        (uint256 paybackAmount, bool isUpdate) = lendPool.repay(loanId, amount);

        // TODO: check repay result
        if (!isUpdate) {
            address owner = wrappedPunks.ownerOf(loan.nftTokenId);
            require(owner == address(this), "PunkGateway: invalid owner");

            wrappedPunks.burn(loan.nftTokenId);
            punks.transferPunk(_msgSender(), loan.nftTokenId);
        }

        return (paybackAmount, isUpdate);
    }
}

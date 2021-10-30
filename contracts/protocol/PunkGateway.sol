// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IPunks} from "../interfaces/IPunks.sol";
import {IWrappedPunks} from "../interfaces/IWrappedPunks.sol";
import {IPunkGateway} from "../interfaces/IPunkGateway.sol";
import {DataTypes} from "../libraries/types/DataTypes.sol";
import {IWETHGateway} from "../interfaces/IWETHGateway.sol";

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

  function _depositPunk(address lendPool, uint256 punkIndex) internal {
    address owner = punks.punkIndexToAddress(punkIndex);
    require(owner == _msgSender(), "PunkGateway: not owner");

    punks.buyPunk(punkIndex);
    punks.transferPunk(proxy, punkIndex);

    wrappedPunks.mint(punkIndex);
    wrappedPunks.approve(address(lendPool), punkIndex);
  }

  function borrow(
    address lendPool,
    address reserveAsset,
    uint256 amount,
    uint256 punkIndex,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    _depositPunk(lendPool, punkIndex);

    ILendPool(lendPool).borrow(reserveAsset, amount, address(wrappedPunks), punkIndex, onBehalfOf, referralCode);
  }

  function _withdrawPunk(uint256 punkIndex) internal {
    address owner = wrappedPunks.ownerOf(punkIndex);
    require(owner == address(this), "PunkGateway: invalid owner");

    wrappedPunks.burn(punkIndex);
    punks.transferPunk(_msgSender(), punkIndex);
  }

  function repay(
    address lendPool,
    uint256 punkIndex,
    uint256 amount,
    address onBehalfOf
  ) external override returns (uint256, bool) {
    (uint256 paybackAmount, bool isUpdate) = ILendPool(lendPool).repay(
      address(wrappedPunks),
      punkIndex,
      amount,
      onBehalfOf
    );

    if (!isUpdate) {
      _withdrawPunk(punkIndex);
    }

    return (paybackAmount, isUpdate);
  }

  function borrowETH(
    address wethGateway,
    address lendPool,
    uint256 amount,
    uint256 punkIndex,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    _depositPunk(lendPool, punkIndex);
    IWETHGateway(wethGateway).borrowETH(lendPool, amount, address(wrappedPunks), punkIndex, onBehalfOf, referralCode);
  }

  function repayETH(
    address wethGateway,
    address lendPool,
    address lendPoolLoan,
    uint256 punkIndex,
    uint256 amount,
    address onBehalfOf
  ) external payable override returns (uint256, bool) {
    (uint256 paybackAmount, bool isUpdate) = IWETHGateway(wethGateway).repayETH{value: msg.value}(
      lendPool,
      lendPoolLoan,
      address(wrappedPunks),
      punkIndex,
      amount,
      onBehalfOf
    );

    if (!isUpdate) {
      _withdrawPunk(punkIndex);
    }

    return (paybackAmount, isUpdate);
  }
}
